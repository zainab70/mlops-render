"""GET /monitoring: drift, prediction volume and errors for the Monitoring page: API-010.

Signed-in users only (current_user on the router), read-only. Two sources:
- the stored answers in PostgreSQL `predictions` (prediction_log.py, API-009);
- reference.json beside the weights (train.py, ML-005), loaded once with the model (predict.py).

Drift is the PSI (population stability index) per ISO week between the reference's share per bin and
the week's share per bin of the same statistic. The live values are counted with services/model/
reference.py and the edges named in reference.json, so training and serving count the same way.

    PSI = Σ (actual − expected) · ln(actual / expected)     over the bins
    0.1 is a small shift, 0.2 (THRESHOLD) a real one.

A week with fewer than MIN_PREDICTIONS stored predictions gets no number but a reason: a few scans
can look very different from the training data by chance alone.
"""

import math
from collections.abc import Sequence
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import current_user
from dashboard import DEV_LABEL
from db import get_db
from models import PredictionLog

# Through predict, which puts services/model on the path outside the image (like prediction_log.py).
from predict import LoadedModel, reference, scan_stats

THRESHOLD = 0.2  # PSI above this is a real shift
MEDIUM_SHARE = 0.7  # above 70 % of the threshold → medium
MEDIUM_ABOVE = round(MEDIUM_SHARE * THRESHOLD, 6)  # 0.14, not the float 0.13999999999999999
TREND_TOLERANCE = 0.02  # a change within ±0.02 against the week before is "stable"
MIN_PREDICTIONS = 30  # fewer successful predictions in a week → no PSI
SHARE_FLOOR = 1e-4  # an empty bin counts as this share, so ln() never sees 0
WEEKS = 6
DAYS = 7

STATISTICS = (*scan_stats.STATISTICS, "predicted_class", "confidence")
NOT_ENOUGH = "not enough predictions"
NO_REFERENCE = "no reference statistics (retrain with ML-005)"

router = APIRouter(dependencies=[Depends(current_user)])


def now() -> datetime:
    """The clock (tests replace it)."""
    return datetime.now(UTC)


class ModelInfo(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    dataset_kind: str | None
    label: str | None


class Week(BaseModel):
    week: str  # ISO week, e.g. "2026-W43"
    start: date  # its Monday (UTC)
    predictions: int  # successful answers that week
    psi: dict[str, float | None]  # per statistic
    reason: str | None


class DriftRow(BaseModel):
    statistic: str
    psi: float | None
    threshold: float
    trend: str | None  # up | down | stable
    severity: str | None  # high | medium | low
    progress: float | None  # psi / threshold
    reason: str | None


class Day(BaseModel):
    date: date
    predictions: int  # stored answers, errors included
    errors: int  # status >= 400


class Stats(BaseModel):
    monitored: int
    high: int
    medium: int
    average_psi: float | None
    reason: str | None


class Monitoring(BaseModel):
    model: ModelInfo | None
    threshold: float
    min_predictions: int
    drift: list[Week]
    table: list[DriftRow]
    volume: list[Day]
    stats: Stats


# --- PSI and the words on the table ---


def psi(actual: Sequence[float], expected: Sequence[float]) -> float:
    total = 0.0
    for a, e in zip(actual, expected, strict=True):
        a, e = max(a, SHARE_FLOOR), max(e, SHARE_FLOOR)
        total += (a - e) * math.log(a / e)
    return round(total, 4)


def trend(latest: float | None, before: float | None) -> str | None:
    if latest is None or before is None:
        return None
    change = round(latest - before, 6)  # 0.10 - 0.08 is 0.020000000000000004 as a float
    if change > TREND_TOLERANCE:
        return "up"
    if change < -TREND_TOLERANCE:
        return "down"
    return "stable"


def severity(value: float | None) -> str | None:
    if value is None:
        return None
    if value > THRESHOLD:
        return "high"
    if value > MEDIUM_ABOVE:
        return "medium"
    return "low"


# --- the shares of one week against the reference ---


def shares(ref: dict, statistic: str, rows: Sequence[PredictionLog]) -> tuple[list[float], list[float]]:
    """(actual, expected) share per bin of one statistic, with the bins reference.json names."""
    predictions = ref["test_predictions"]
    if statistic == "predicted_class":
        # One bin per class of the reference; a class the reference does not know is not counted.
        classes = list(predictions["class_shares"])
        known = [row.predicted_class for row in rows if row.predicted_class in classes]
        actual = [known.count(label) / len(known) if known else 0.0 for label in classes]
        return actual, [predictions["class_shares"][label] for label in classes]
    histogram = predictions["confidence"] if statistic == "confidence" else ref["training_scans"]["statistics"][statistic]
    values = [getattr(row, statistic) for row in rows]
    return reference.histogram(values, histogram["edges"])["shares"], histogram["shares"]


def week_psi(ref: dict | None, rows: Sequence[PredictionLog]) -> tuple[dict[str, float | None], str | None]:
    if ref is None:
        return dict.fromkeys(STATISTICS), NO_REFERENCE
    if len(rows) < MIN_PREDICTIONS:
        return dict.fromkeys(STATISTICS), NOT_ENOUGH
    return {name: psi(*shares(ref, name, rows)) for name in STATISTICS}, None


def monday(day: date) -> date:
    return day - timedelta(days=day.weekday())


def drift(ref: dict | None, rows: Sequence[PredictionLog], today: date) -> list[dict]:
    """The current ISO week and the WEEKS - 1 before it, oldest first; successful answers only."""
    weeks = []
    for back in range(WEEKS - 1, -1, -1):
        start = monday(today) - timedelta(weeks=back)
        chosen = [row for row in rows if row.status < 400 and monday(_day(row)) == start]
        values, reason = week_psi(ref, chosen)
        year, number, _ = start.isocalendar()
        weeks.append({"week": f"{year}-W{number:02d}", "start": start, "predictions": len(chosen),
                      "psi": values, "reason": reason})
    return weeks


def table(weeks: Sequence[dict]) -> list[dict]:
    """Per statistic: the newest week with a PSI, its trend against the week right before it."""
    rows = []
    for name in STATISTICS:
        values = [week["psi"][name] for week in weeks]
        newest = max((i for i, value in enumerate(values) if value is not None), default=None)
        if newest is None:
            reason = next((week["reason"] for week in reversed(weeks) if week["reason"]), NOT_ENOUGH)
            rows.append({"statistic": name, "psi": None, "threshold": THRESHOLD, "trend": None,
                         "severity": None, "progress": None, "reason": reason})
            continue
        latest = values[newest]
        before = values[newest - 1] if newest > 0 else None
        rows.append({"statistic": name, "psi": latest, "threshold": THRESHOLD, "trend": trend(latest, before),
                     "severity": severity(latest), "progress": round(latest / THRESHOLD, 4), "reason": None})
    return rows


def volume(rows: Sequence[PredictionLog], today: date) -> list[dict]:
    """Stored answers and errors (status >= 400) per UTC day, the last DAYS days, oldest first."""
    days = [today - timedelta(days=back) for back in range(DAYS - 1, -1, -1)]
    return [{"date": day,
             "predictions": sum(1 for row in rows if _day(row) == day),
             "errors": sum(1 for row in rows if _day(row) == day and row.status >= 400)} for day in days]


def stats(rows: Sequence[dict]) -> dict:
    values = [row["psi"] for row in rows if row["psi"] is not None]
    return {
        "monitored": len(rows),
        "high": sum(1 for row in rows if row["severity"] == "high"),
        "medium": sum(1 for row in rows if row["severity"] == "medium"),
        "average_psi": round(sum(values) / len(values), 4) if values else None,
        "reason": None if values else rows[0]["reason"],
    }


def model_info(loaded: LoadedModel | None) -> dict | None:
    if loaded is None:
        return None
    kind = loaded.metadata.get("dataset_kind")
    return {"model_version": loaded.metadata["model_version"], "dataset_kind": kind,
            "label": DEV_LABEL if kind == "dev" else None}


def _day(row: PredictionLog) -> date:
    return row.created_at.astimezone(UTC).date()


@router.get("/monitoring", response_model=Monitoring)
def monitoring(request: Request, db: Session = Depends(get_db)) -> dict:
    today = now().date()
    since = min(monday(today) - timedelta(weeks=WEEKS - 1), today - timedelta(days=DAYS - 1))
    start = datetime(since.year, since.month, since.day, tzinfo=UTC)
    rows = list(db.scalars(select(PredictionLog).where(PredictionLog.created_at >= start)))
    loaded = getattr(request.app.state, "model", None)
    ref = loaded.reference if loaded is not None else None
    weeks = drift(ref, rows, today)
    drift_table = table(weeks)
    return {
        "model": model_info(loaded),
        "threshold": THRESHOLD,
        "min_predictions": MIN_PREDICTIONS,
        "drift": weeks,
        "table": drift_table,
        "volume": volume(rows, today),
        "stats": stats(drift_table),
    }
