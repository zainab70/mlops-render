"""Store every /predict and /explain answer, errors included: API-009.

The routes note what they learned on request.state: predict.note_scan() measures the decoded scan
with services/model/scan_stats.py (the same function train.py uses, ML-005), and the prediction.
main.py's middleware calls write() once the answer is ready, with its status and latency. A request
that fails before that (413, 415, 503) is stored with an empty result and empty numbers. A
signed-out request (401) is not stored: nobody could see it on the pages it is for. Only numbers are
stored, never the scan itself.

Writing never changes the answer: a failing database write is logged and dropped.
"""

import logging

from fastapi import Request

from db import get_db
from models import PredictionLog

# Through predict, which puts services/model on the path outside the image (like explain.py's imports).
from predict import scan_stats

LOGGED_PATHS = ("/predict", "/explain")
NOT_STORED = (401,)

log = logging.getLogger(__name__)


def should_store(path: str, status: int) -> bool:
    return path in LOGGED_PATHS and status not in NOT_STORED


def row_for(request: Request, path: str, status: int, latency_ms: float) -> PredictionLog:
    stats = getattr(request.state, "scan_stats", None) or {}
    prediction = getattr(request.state, "prediction", None)
    return PredictionLog(
        path=path,
        status=status,
        latency_ms=round(latency_ms, 3),
        model_version=prediction.model_version if prediction else None,
        predicted_class=prediction.class_ if prediction else None,
        confidence=prediction.confidence if prediction else None,
        **{name: stats.get(name) for name in scan_stats.STATISTICS},
    )


def write(request: Request, path: str, status: int, latency_ms: float) -> None:
    """One INSERT for this answer (blocking: main.py runs it in a worker thread)."""
    if not should_store(path, status):
        return
    # The same session source the routes use, so a test's database override applies here too.
    sessions = request.app.dependency_overrides.get(get_db, get_db)()
    try:
        session = next(sessions)
        session.add(row_for(request, path, status, latency_ms))
        session.commit()
    except Exception:
        log.exception("could not store the %s answer (status %s); the answer was sent anyway", path, status)
    finally:
        sessions.close()
