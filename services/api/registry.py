"""GET /models and POST /models/versions/{id}/promote: the model registry for the Models page
(API-007, API-008).

Signed-in users only (current_user on the router). Versions are registered by record_run.py (one
staging version per recorded training run) or the seed; Promote is the only route that changes a
stage. A model is a name in the models table, a version is one row.

Promote changes the REGISTRY only (which version is approved for production): the API keeps serving
the weights in MODEL_PATH, read at startup (predict.py). The Deployments slices make serving follow
the stage.

Traffic is never invented: only the version the API has loaded (app.state.model, MODEL_PATH) serves
/predict, so only it can have a share, measured by request_metrics.py since the API started. Every
other version is "not serving".
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import current_user, require_role
from db import get_db
from models import Experiment, Model
from predict import LoadedModel
from request_metrics import RequestMetrics

NOT_SERVING = "not serving"
NO_REQUESTS = "no requests yet"
# Same text as dashboard.py NOT_LABELLED: only labelled (non-DEV) results are averaged.
NOT_LABELLED = "no labelled evaluation yet"

# Both roles that exist today may promote (docs/product.md: ML engineers "register and deploy model
# versions"). Naming them means a role added later gets 403 without changing the route.
PROMOTE_ROLES = ("admin", "ml_engineer")

router = APIRouter(prefix="/models", dependencies=[Depends(current_user)])


class Version(BaseModel):
    id: int
    version: str
    stage: str
    accuracy: float | None
    dataset_kind: str | None  # of the linked experiment; dev = not a valid performance estimate
    size_bytes: int | None
    experiment_id: int | None
    stage_changed_at: datetime | None
    created_at: datetime
    traffic: float | None  # percent of measured /predict requests
    traffic_reason: str | None


class ModelEntry(BaseModel):
    name: str
    description: str | None
    framework: str
    source: str
    versions: list[Version]


class Stats(BaseModel):
    total_models: int
    in_production: int
    in_staging: int
    avg_accuracy: float | None
    avg_accuracy_reason: str | None


class Registry(BaseModel):
    models: list[ModelEntry]
    stats: Stats


def served_predictions(metrics: RequestMetrics | None) -> int:
    """How many /predict answers this API process has measured (request_metrics.py keeps them)."""
    if metrics is None:
        return 0
    # RequestMetrics.summary() has no all-time /predict count, so read a snapshot of its samples.
    with metrics._lock:
        return sum(1 for sample in metrics._samples if sample.path == "/predict")


def traffic(row: Model, loaded: LoadedModel | None, predictions: int) -> tuple[float | None, str | None]:
    if loaded is None or row.version != loaded.metadata.get("model_version"):
        return None, NOT_SERVING
    if predictions == 0:
        return None, NO_REQUESTS
    return 100.0, None  # the one loaded model answers every /predict


def stats(rows: list[tuple[Model, str | None]]) -> dict:
    labelled = [m.accuracy for m, kind in rows if m.accuracy is not None and kind != "dev"]
    return {
        "total_models": len({m.name for m, _ in rows}),
        "in_production": sum(m.stage == "production" for m, _ in rows),
        "in_staging": sum(m.stage == "staging" for m, _ in rows),
        "avg_accuracy": round(sum(labelled) / len(labelled), 4) if labelled else None,
        "avg_accuracy_reason": None if labelled else NOT_LABELLED,
    }


def registry_rows(db: Session, name: str | None = None) -> list[tuple[Model, str | None]]:
    """Every version (or one model's) with its experiment's dataset_kind, newest first."""
    # Rows inserted together share created_at, so the id (later insert = higher) breaks the tie.
    query = (
        select(Model, Experiment.dataset_kind)
        .outerjoin(Experiment, Model.experiment_id == Experiment.id)
        .order_by(Model.created_at.desc(), Model.id.desc())
    )
    if name is not None:
        query = query.where(Model.name == name)
    return [(m, kind) for m, kind in db.execute(query)]


def model_entries(request: Request, rows: list[tuple[Model, str | None]]) -> list[dict]:
    """The rows grouped by model name, in the order of each model's newest version."""
    loaded = getattr(request.app.state, "model", None)
    predictions = served_predictions(getattr(request.app.state, "metrics", None))

    models: dict[str, dict] = {}
    for m, kind in rows:
        entry = models.setdefault(
            m.name,
            {"name": m.name, "description": m.description, "framework": m.framework, "source": m.source,
             "versions": []},
        )
        share, reason = traffic(m, loaded, predictions)
        entry["versions"].append(
            {"id": m.id, "version": m.version, "stage": m.stage, "accuracy": m.accuracy, "dataset_kind": kind,
             "size_bytes": m.size_bytes, "experiment_id": m.experiment_id, "stage_changed_at": m.stage_changed_at,
             "created_at": m.created_at, "traffic": share, "traffic_reason": reason}
        )
    return list(models.values())


@router.get("", response_model=Registry)
def list_models(request: Request, db: Session = Depends(get_db)) -> dict:
    rows = registry_rows(db)
    return {"models": model_entries(request, rows), "stats": stats(rows)}


def set_stage(db: Session, row: Model, stage: str, now: datetime) -> None:
    row.stage = stage
    row.stage_changed_at = now
    db.flush()  # written inside the open transaction; the commit (or rollback) decides


@router.post(
    "/versions/{version_id}/promote",
    response_model=ModelEntry,
    dependencies=[Depends(require_role(*PROMOTE_ROLES))],
)
def promote(version_id: int, request: Request, db: Session = Depends(get_db)) -> dict:
    """staging → production; the model's previous production version → archived, in one transaction."""
    found = db.get(Model, version_id)
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="model version not found")

    try:
        # Lock every version of this model until the commit: a second promote of the same model waits
        # here and then reads the stages this one wrote, so there is never more than one production
        # version (and the staging check below cannot go stale). populate_existing re-reads `found`.
        versions = db.scalars(
            select(Model).where(Model.name == found.name).with_for_update().execution_options(populate_existing=True)
        ).all()
        row = next(v for v in versions if v.id == version_id)
        if row.stage != "staging":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"only a staging version can be promoted; {row.name} {row.version} is {row.stage}",
            )
        now = datetime.now(UTC)
        for previous in [v for v in versions if v.stage == "production"]:
            set_stage(db, previous, "archived", now)
        set_stage(db, row, "production", now)
        db.commit()
    except Exception:
        db.rollback()  # releases the lock; nothing written stays
        raise

    [entry] = model_entries(request, registry_rows(db, row.name))
    return entry
