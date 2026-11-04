"""GET /deployments: the running API service and the seeded demo rows, for the Deployments page: API-011.

Signed-in users only (current_user on the router), read-only. One real deployment: THIS API service,
serving the model in MODEL_PATH. Its numbers come from the stored answers in PostgreSQL `predictions`
(prediction_log.py, API-009), so they survive restarts. "since" is when this process started
(request_metrics.py). The seeded `deployments` rows follow, labelled demo, with their stored fields
and no measured traffic.

There is no uptime percentage: the API cannot see the time it was down, only when it started.

Windows (UTC): requests, p50 / p95 / p99 and throughput over the last 7 days (today and the 6 before);
success rate over the last 24 hours; latency per hour for the last 24 hours (this hour and the 23
before).
"""

from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import current_user
from db import get_db
from models import Deployment, Model, PredictionLog
from predict import LoadedModel
from request_metrics import percentile

LIVE_NAME = "MLOps Hub API"
LIVE_ENDPOINT = "/predict"
DAYS = 7
HOURS = 24

NO_MODEL = "no model loaded"
NO_REQUESTS = "no requests yet"
NOT_KNOWN = "not known to the API"
NOT_REGISTERED = "the served model is not in the registry"
NO_REQUESTS_24H = "no requests in the last 24 hours"
NO_REQUESTS_7D = "no requests in the last 7 days"
DEMO_TRAFFIC = "demo row: no measured traffic"

router = APIRouter(dependencies=[Depends(current_user)])


def now() -> datetime:
    """The clock (tests replace it)."""
    return datetime.now(UTC)


class Latency(BaseModel):
    p50: float
    p95: float
    p99: float


class DeploymentOut(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: int | None  # the deployments row; None for the live API
    name: str
    source: str  # live | demo
    status: str  # healthy | degraded | stopped
    environment: str | None
    endpoint: str | None
    model_version: str | None
    version_id: int | None  # the models row it serves (the Details link)
    region: str | None
    replicas: int | None
    since: datetime
    requests: int | None
    success_rate: float | None  # a fraction
    latency_ms: Latency | None
    reasons: dict[str, str]  # field → why it has no value


class Stats(BaseModel):
    total_requests: int  # last 7 days
    success_rate: float | None  # last 24 hours, a fraction
    p50_ms: float | None  # last 7 days
    served_since: datetime
    reasons: dict[str, str]


class Hour(BaseModel):
    hour: datetime  # its start (UTC)
    requests: int
    p50: float | None
    p95: float | None
    p99: float | None


class LatencyChart(BaseModel):
    hours: list[Hour]
    reason: str | None


class Day(BaseModel):
    date: date
    requests: int


class Throughput(BaseModel):
    days: list[Day]
    reason: str | None


class Deployments(BaseModel):
    deployments: list[DeploymentOut]
    stats: Stats
    latency: LatencyChart
    throughput: Throughput


def latency(rows: list[PredictionLog]) -> dict | None:
    """p50 / p95 / p99 of the stored latencies, nearest rank like the Dashboard (request_metrics.py)."""
    values = sorted(row.latency_ms for row in rows)
    return {f"p{p}": round(percentile(values, p), 1) for p in (50, 95, 99)} if values else None


def success_rate(rows: list[PredictionLog]) -> float | None:
    return round(sum(1 for row in rows if row.status < 400) / len(rows), 4) if rows else None


def _at(row: PredictionLog) -> datetime:
    return row.created_at.astimezone(UTC)


def served_version(db: Session, loaded: LoadedModel | None) -> int | None:
    """The models row whose version is the loaded model_version (the newest, if registered twice)."""
    if loaded is None:
        return None
    query = select(Model.id).where(Model.version == loaded.metadata["model_version"]).order_by(Model.id.desc())
    return db.scalars(query.limit(1)).first()


def live(db: Session, loaded: LoadedModel | None, since: datetime, week: list[PredictionLog]) -> dict:
    reasons = {"region": NOT_KNOWN, "replicas": NOT_KNOWN, "environment": NOT_KNOWN}
    version_id = served_version(db, loaded)
    if loaded is None:
        reasons["model_version"] = NO_MODEL
        reasons["version_id"] = NO_MODEL
    elif version_id is None:
        reasons["version_id"] = NOT_REGISTERED
    if not week:
        for field in ("requests", "success_rate", "latency_ms"):
            reasons[field] = NO_REQUESTS
    return {
        "id": None,
        "name": LIVE_NAME,
        "source": "live",
        "status": "healthy",  # this route answered
        "environment": None,
        "endpoint": LIVE_ENDPOINT,
        "model_version": loaded.metadata["model_version"] if loaded else None,
        "version_id": version_id,
        "region": None,
        "replicas": None,
        "since": since,
        "requests": len(week),
        "success_rate": success_rate(week),
        "latency_ms": latency(week),
        "reasons": reasons,
    }


def demo(row: Deployment, version: str | None) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "source": "demo",
        "status": row.status,
        "environment": row.environment,
        "endpoint": None,
        "model_version": version,
        "version_id": row.model_id,
        "region": None,
        "replicas": row.replicas,
        "since": row.created_at,
        "requests": None,
        "success_rate": None,
        "latency_ms": None,
        "reasons": {"endpoint": NOT_KNOWN, "region": NOT_KNOWN, "requests": DEMO_TRAFFIC,
                    "success_rate": DEMO_TRAFFIC, "latency_ms": DEMO_TRAFFIC},
    }


def hours(rows: list[PredictionLog], current: datetime) -> dict:
    """This hour and the 23 before it, oldest first; an hour without answers has null latencies."""
    this_hour = current.replace(minute=0, second=0, microsecond=0)
    out = []
    for back in range(HOURS - 1, -1, -1):
        start = this_hour - timedelta(hours=back)
        chosen = [row for row in rows if start <= _at(row) < start + timedelta(hours=1)]
        values = latency(chosen) or {"p50": None, "p95": None, "p99": None}
        out.append({"hour": start, "requests": len(chosen), **values})
    recent = [row for row in rows if _at(row) > current - timedelta(hours=HOURS)]
    return {"hours": out, "reason": None if recent else NO_REQUESTS_24H}


def days(rows: list[PredictionLog], today: date) -> dict:
    """Stored answers per UTC day, today and the 6 before, oldest first."""
    dates = [today - timedelta(days=back) for back in range(DAYS - 1, -1, -1)]
    out = [{"date": day, "requests": sum(1 for row in rows if _at(row).date() == day)} for day in dates]
    return {"days": out, "reason": None if rows else NO_REQUESTS_7D}


@router.get("/deployments", response_model=Deployments)
def deployments(request: Request, db: Session = Depends(get_db)) -> dict:
    current = now()
    today = current.date()
    week_start = datetime(today.year, today.month, today.day, tzinfo=UTC) - timedelta(days=DAYS - 1)
    # One query: the last 24 hours always lie inside these 7 days.
    week =list(db.scalars(select(PredictionLog).where(PredictionLog.created_at >= week_start)))
    last_24h = [row for row in week if _at(row) > current - timedelta(hours=HOURS)]

    loaded = getattr(request.app.state, "model", None)
    since = datetime.fromtimestamp(request.app.state.metrics.started_at, UTC)
    seeded = db.execute(
        select(Deployment, Model.version).join(Model, Deployment.model_id == Model.id).order_by(Deployment.id)
    ).all()

    p50 = latency(week)
    stats_reasons = {}
    if not last_24h:
        stats_reasons["success_rate"] = NO_REQUESTS_24H
    if p50 is None:
        stats_reasons["p50_ms"] = NO_REQUESTS
    return {
        "deployments": [live(db, loaded, since, week)] + [demo(row, version) for row, version in seeded],
        "stats": {
            "total_requests": len(week),
            "success_rate": success_rate(last_24h),
            "p50_ms": p50["p50"] if p50 else None,
            "served_since": since,
            "reasons": stats_reasons,
        },
        "latency": hours(week, current),
        "throughput": days(week, today),
    }
