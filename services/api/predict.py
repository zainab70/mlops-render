"""The trained CNN behind the API: API-003P.

The weights are loaded ONCE, when the app starts (main.py's lifespan calls load_from_env), from the
folder MODEL_PATH that train.py wrote (model.pt + metadata.json). Missing or unreadable weights never
stop the app: /health keeps answering and GET /model and POST /predict answer 503 "model not loaded".

The task the model solves (ML-006) is in its metadata.json; a folder from before ML-006 gets the
brain-MRI default from model.py's task_of(). GET /model answers it, so nothing here names a disease.

The network itself is not copied here: SmallCNN, load_model and to_tensor come from
services/model/model.py. In the Docker image that file sits next to this one; locally (pytest,
e2e_server.py, uvicorn) it is found in the sibling folder services/model.
"""

import copy
import io
import json
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path

import torch
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field

from auth import current_user

try:
    import model as cnn
    import reference
    import scan_stats
except ModuleNotFoundError:
    sys.path.append(str(Path(__file__).resolve().parent.parent / "model"))
    import model as cnn
    import reference
    import scan_stats

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_FORMATS = {"PNG", "JPEG"}  # as Pillow names them after reading the bytes
NOTICE = "Research demo — not a diagnostic device."
REQUIRED_METADATA = ("classes", "input_size", "dataset_kind", "model_version")

router = APIRouter(dependencies=[Depends(current_user)])


@dataclass(frozen=True)
class LoadedModel:
    network: cnn.SmallCNN  # /predict (and /explain's class) run here; it never carries a hook
    metadata: dict
    # Grad-CAM (explain.py) hooks into the network it explains. A hook on `network` would also see
    # every /predict forward pass running at the same time, so Grad-CAM gets its own in-memory copy
    # (same weights, made once at load: not a second load from disk).
    explainer: cnn.SmallCNN
    # train.py's test-split results (metrics.json beside metadata.json), or None when the file is
    # missing or unreadable. Only the Dashboard reads it (dashboard.py, API-005).
    metrics: dict | None = None
    # What the training scans and test predictions looked like (reference.json, ML-005), or None when
    # the file is missing or unreadable. Only Monitoring reads it (monitoring.py, API-010).
    reference: dict | None = None

    @property
    def task(self) -> dict:
        """The task in metadata.json, or the brain-MRI default for a folder from before ML-006."""
        return cnn.task_of(self.metadata)

    @property
    def channels(self) -> int:
        return self.task["channels"]


def read_json(folder: Path, name: str) -> dict | None:
    try:
        return json.loads((folder / name).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (OSError, ValueError) as exc:
        logger.warning("%s in %s not read: %s", name, folder, exc)
        return None


def load_from_env() -> LoadedModel | None:
    """MODEL_PATH → the model in eval mode, or None (logged) when it cannot be used."""
    path = os.environ.get("MODEL_PATH", "").strip()
    if not path:
        logger.warning("MODEL_PATH is not set: /model and /predict answer 503 until it is")
        return None
    try:
        network, metadata = cnn.load_model(Path(path))
        missing = [key for key in REQUIRED_METADATA if key not in metadata]
        if missing:
            raise ValueError(f"metadata.json is missing {missing}")
        cnn.task_of(metadata)  # an incomplete task is an unusable model, like a missing key
    except Exception as exc:  # any unreadable weights file: the app must still start
        logger.warning("model not loaded from MODEL_PATH=%s: %s", path, exc)
        return None
    logger.info("model %s loaded from %s", metadata["model_version"], path)
    return LoadedModel(network, metadata, explainer=copy.deepcopy(network), metrics=read_json(Path(path), "metrics.json"),
                       reference=read_json(Path(path), reference.REFERENCE_FILE))


def loaded_model(request: Request) -> LoadedModel:
    loaded = getattr(request.app.state, "model", None)
    if loaded is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="model not loaded")
    return loaded


class Task(BaseModel):
    """What the served model classifies (ML-006); the Scan page shows it instead of fixed text."""

    title: str
    modality: str
    channels: int
    class_labels: dict[str, str]  # class name → display name


class ModelInfo(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    classes: list[str]
    input_size: int
    dataset_kind: str
    model_version: str
    task: Task


class Prediction(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), populate_by_name=True)

    class_: str = Field(alias="class")
    confidence: float
    probabilities: dict[str, float]
    model_version: str
    notice: str


@router.get("/model", response_model=ModelInfo)
def describe(loaded: LoadedModel = Depends(loaded_model)) -> ModelInfo:
    return ModelInfo(**{key: loaded.metadata[key] for key in REQUIRED_METADATA}, task=Task(**loaded.task))


def read_scan(upload: UploadFile) -> Image.Image:
    """The uploaded bytes → a decoded PNG or JPEG. Pillow decides the format, not the file name."""
    data = upload.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"The file is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        image = None
    if image is None or image.format not in ALLOWED_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="The file is not a PNG or JPEG image.",
        )
    return image


# A plain `def`: FastAPI runs it in a worker thread, so the CNN never blocks the event loop.
@router.post("/predict", response_model=Prediction)
def predict(request: Request, file: UploadFile = File(...), loaded: LoadedModel = Depends(loaded_model)) -> Prediction:
    image = read_scan(file)
    note_scan(request, image)
    prediction = classify(loaded, image)
    request.state.prediction = prediction
    return prediction


def note_scan(request: Request, image: Image.Image) -> None:
    """The numbers prediction_log.py stores for this answer, measured by the shared scan_stats.py."""
    request.state.scan_stats = scan_stats.measure(image)


def classify(loaded: LoadedModel, image: Image.Image) -> Prediction:
    """One forward pass of the loaded CNN; shared by /predict and /explain (explain.py)."""
    classes = loaded.metadata["classes"]
    tensor = cnn.to_tensor(image, loaded.metadata["input_size"], loaded.channels).unsqueeze(0)
    with torch.no_grad():
        probabilities = torch.softmax(loaded.network(tensor), dim=1)[0].tolist()
    best = max(range(len(classes)), key=lambda i: probabilities[i])
    return Prediction(
        class_=classes[best],
        confidence=probabilities[best],
        probabilities=dict(zip(classes, probabilities, strict=True)),
        model_version=loaded.metadata["model_version"],
        notice=NOTICE,
    )
