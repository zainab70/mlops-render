"""GET /dashboard: everything the Dashboard shows that is real today: API-005.

Signed-in users only (current_user on the router), read-only. One answer, four sources:
- stats and recent_experiments: counted and read from PostgreSQL;
- api: this process is up (the route answered) and how long since it started;
- model: the model folder loaded at startup (metadata.json + metrics.json, predict.py). Accuracy is
  a number ONLY for DEV data, and then always with the DEV label; otherwise it is null with a reason;
- traffic: the API's own in-memory timings of /predict and /explain (request_metrics.py), which
  reset when the API restarts (traffic.since).
"""

from datetime import date, datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from auth import current_user
from db import get_db
from models import Deployment, Experiment, Model
from predict import LoadedModel
from request_metrics import RequestMetrics

RECENT_EXPERIMENTS = 5
# Same text as services/model/model_card.py DEV_LABEL (a test keeps them equal).
DEV_LABEL = "development data — not a valid performance estimate"
ACCURACY_METRIC = "balanced_accuracy"  # the accuracy number train.py writes to metrics.json
NO_METRICS = "no metrics file"
NOT_LABELLED = "no labelled evaluation yet"

router = APIRouter(dependencies=[Depends(current_user)])


class Stats(BaseModel):
    experiments_running: int
    experiments_total: int
    models_production: int
    models_staging: int
    deployments_healthy: int
    deployments_total: int


class RecentExperiment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    status: str
    accuracy: float | None
    created_at: datetime


class ApiStatus(BaseModel):
    status: str
    uptime_seconds: float


class ModelSummary(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    dataset_kind: str | None
    accuracy: float | None
    accuracy_metric: str | None
    label: str | None
    accuracy_reason: str | None


class Day(BaseModel):
    date: date
    requests: int


class Latency(BaseModel):
    p50: float
    p95: float
    p99: float


class Traffic(BaseModel):
    since: datetime
    days: list[Day]
    success_rate: float | None
    latency_ms: Latency | None
    requests_last_minute: int
    predictions_last_minute: int


class Dashboard(BaseModel):
    stats: Stats
    recent_experiments: list[RecentExperiment]
    api: ApiStatus
    model: ModelSummary | None
    traffic: Traffic


def _count(db: Session, table, *where) -> int:
    return db.scalar(select(func.count()).select_from(table).where(*where))


def stats(db: Session) -> dict:
    return {
        "experiments_running": _count(db, Experiment, Experiment.status == "running"),
        "experiments_total": _count(db, Experiment),
        "models_production": _count(db, Model, Model.stage == "production"),
        "models_staging": _count(db, Model, Model.stage == "staging"),
        "deployments_healthy": _count(db, Deployment, Deployment.status == "healthy"),
        "deployments_total": _count(db, Deployment),
    }


def recent_experiments(db: Session) -> list[Experiment]:
    # Rows inserted together share created_at, so the id (later insert = higher) breaks the tie.
    query = select(Experiment).order_by(Experiment.created_at.desc(), Experiment.id.desc())
    return list(db.scalars(query.limit(RECENT_EXPERIMENTS)))


def model_summary(loaded: LoadedModel | None) -> dict | None:
    if loaded is None:
        return None
    kind = loaded.metadata.get("dataset_kind")
    summary = {
        "model_version": loaded.metadata["model_version"],
        "dataset_kind": kind,
        "accuracy": None,
        "accuracy_metric": None,
        "label": None,
        "accuracy_reason": None,
    }
    if loaded.metrics is None or ACCURACY_METRIC not in loaded.metrics:
        summary["accuracy_reason"] = NO_METRICS
    elif kind != "dev":
        # Only DEV results are labelled so far; a number without its label is never shown.
        summary["accuracy_reason"] = NOT_LABELLED
    else:
        summary.update(accuracy=loaded.metrics[ACCURACY_METRIC], accuracy_metric=ACCURACY_METRIC, label=DEV_LABEL)
    return summary


@router.get("/dashboard", response_model=Dashboard)
def dashboard(request: Request, db: Session = Depends(get_db)) -> dict:
    metrics: RequestMetrics = request.app.state.metrics
    return {
        "stats": stats(db),
        "recent_experiments": recent_experiments(db),
        "api": {"status": "ok", "uptime_seconds": metrics.uptime_seconds()},
        "model": model_summary(getattr(request.app.state, "model", None)),
        "traffic": metrics.summary(),
    }
