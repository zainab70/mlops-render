import os
import time
from collections.abc import Mapping
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, status
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

import prediction_log
from admin import router as admin_router
from auth import current_user
from auth import router as auth_router
from dashboard import router as dashboard_router
from db import get_database_url
from deployments import router as deployments_router
from experiments import router as experiments_router
from explain import router as explain_router
from monitoring import router as monitoring_router
from notifications import router as notifications_router
from predict import load_from_env
from predict import router as predict_router
from registry import router as registry_router
from request_metrics import RequestMetrics
from search import router as search_router
from security import get_session_secret


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast at startup with a clear message if required configuration is missing.
    get_database_url()
    get_session_secret()
    # The CNN is loaded once here, not per request. None (no usable MODEL_PATH) never stops the
    # app: /model and /predict then answer 503 "model not loaded" (predict.py).
    app.state.model = load_from_env()
    # The /predict + /explain timings for the Dashboard start counting now (request_metrics.py).
    app.state.metrics = RequestMetrics()
    yield


API_DOCS_ENV = "API_DOCS"


def docs_settings(env: Mapping[str, str]) -> dict[str, str | None]:
    """/docs, /redoc and /openapi.json exist only when API_DOCS is exactly 'true' (SEC-003): the API
    map is not shown to strangers. db.py has already loaded the local .env, so it can switch them on."""
    if env.get(API_DOCS_ENV) == "true":
        return {}
    return {"docs_url": None, "redoc_url": None, "openapi_url": None}


app = FastAPI(lifespan=lifespan, **docs_settings(os.environ))


@app.middleware("http")
async def time_counted_requests(request: Request, call_next):
    # Every /predict and /explain answer is timed, errors included; the recorder ignores other paths.
    started = time.perf_counter()
    status_code = 500  # if the route raises, the client gets a 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        latency_ms = (time.perf_counter() - started) * 1000
        metrics = getattr(request.app.state, "metrics", None)
        if metrics is not None:
            metrics.record(request.url.path, status_code, latency_ms)
        # One stored row per /predict and /explain answer (API-009); the DB write runs off the event loop.
        if prediction_log.should_store(request.url.path, status_code):
            await run_in_threadpool(prediction_log.write, request, request.url.path, status_code, latency_ms)


@app.exception_handler(RequestValidationError)
async def validation_error_without_input(request: Request, exc: RequestValidationError) -> JSONResponse:
    # FastAPI's default 422 repeats what was sent ("input"), which could be a password.
    # Keep only where and what is wrong.
    errors = [{"loc": e["loc"], "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": errors})

# Public: /health and /auth/login. Everything else needs a signed-in user (Depends(current_user)).
app.include_router(auth_router)
# Admin-only (require_admin on the router): list and create users.
app.include_router(admin_router)
# Signed-in: GET /search over experiments, models and deployments.
app.include_router(search_router)
# Signed-in: the user's own notifications, unread count and mark-as-read.
app.include_router(notifications_router)
# Signed-in: GET /model describes the loaded CNN, POST /predict classifies an uploaded scan.
app.include_router(predict_router)
# Signed-in: POST /explain returns the Grad-CAM overlay PNG, from the same loaded model.
app.include_router(explain_router)
# Signed-in: GET /dashboard, the Dashboard's counts, model summary and /predict + /explain timings.
app.include_router(dashboard_router)
# Signed-in, read-only: GET /monitoring, PSI drift per week against reference.json, volume and errors.
app.include_router(monitoring_router)
# Signed-in, read-only: GET /deployments, this API service (from the stored answers) and the demo rows.
app.include_router(deployments_router)
# Signed-in, read-only: GET /experiments (list), /experiments/{id} (details), /experiments/export.csv.
app.include_router(experiments_router)
# Signed-in, read-only: GET /models, the model versions (recorded runs + seed) and the quick stats.
app.include_router(registry_router)


@app.get("/", dependencies=[Depends(current_user)])
def home(request: Request):
    # The served model's task (ML-006), so the greeting never names a disease the model does not solve.
    loaded = getattr(request.app.state, "model", None)
    if loaded is None:
        return {"message": "Hello from the MLOps API (no model loaded)"}
    return {"message": f"Hello from the MLOps API: {loaded.task['title']}"}


@app.get("/health")
def health():
    return {"status": "ok"}
