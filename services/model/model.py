"""The CNN and image loading (ML-002).

A small network on purpose: three convolution blocks learn edges, then textures,
then shapes; global average pooling makes it work for any input size; one linear
layer turns the 64 features into a score per class. `features` stays a separate
block so Grad-CAM (ML-003) can read its last convolution.

The task a model solves (ML-006) is data, not code: train.py writes it into metadata.json as
`task` (title, modality, a display name per class, channels). A model folder from before ML-006 has
no `task`; task_of() gives it DEFAULT_TASK, the brain-MRI task it was trained for. This lives here,
not in a new file, because this is the one training file the API image copies.
"""

import json
from collections.abc import Mapping, Sequence
from pathlib import Path

import torch
from PIL import Image
from torch import nn

INPUT_SIZE = 96  # the DEV images are 96x96; other sizes are resized to this
CHANNELS = (1, 3)  # grayscale or colour (RGB)

# The task of every model trained before ML-006 (and of a training run without task.json).
DEFAULT_TASK = {
    "title": "Alzheimer's disease stage from brain MRI",
    "modality": "MRI",
    "channels": 1,
}


def display_name(label: str) -> str:
    """A class folder or manifest label as people read it: "Very_Mild_Demented" → "Very Mild Demented"."""
    return label.replace("_", " ").strip()


def make_task(fields: Mapping, classes: Sequence[str]) -> dict:
    """A complete task for these classes; class labels not given get their display_name."""
    given = fields.get("class_labels") or {}
    return {
        "title": fields["title"],
        "modality": fields["modality"],
        "channels": fields["channels"],
        "class_labels": {name: given.get(name) or display_name(name) for name in classes},
    }


def task_of(metadata: Mapping) -> dict:
    """The task in metadata.json, or DEFAULT_TASK for a model folder written before ML-006."""
    return make_task(metadata.get("task") or DEFAULT_TASK, metadata["classes"])


class SmallCNN(nn.Module):
    def __init__(self, num_classes: int, channels: int = 1):
        super().__init__()
        if channels not in CHANNELS:
            raise ValueError(f"channels must be 1 or 3, not {channels}")
        self.features = nn.Sequential(
            nn.Conv2d(channels, 16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
        )
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.head = nn.Linear(64, num_classes)

    def forward(self, images: torch.Tensor) -> torch.Tensor:
        return self.head(torch.flatten(self.pool(self.features(images)), 1))


def to_tensor(image: Image.Image, size: int, channels: int = 1) -> torch.Tensor:
    """Any Pillow image → a channels x size x size tensor with values in [0, 1] (1 = grayscale, 3 = RGB)."""
    if channels not in CHANNELS:
        raise ValueError(f"channels must be 1 or 3, not {channels}")
    converted = image.convert("L" if channels == 1 else "RGB").resize((size, size), Image.Resampling.BILINEAR)
    pixels = torch.frombuffer(bytearray(converted.tobytes()), dtype=torch.uint8)
    # Pillow stores pixels row by row with the channels last; the CNN wants the channels first.
    return pixels.reshape(size, size, channels).permute(2, 0, 1).contiguous().float() / 255.0


def load_image(path: str, size: int, channels: int = 1) -> torch.Tensor:
    with Image.open(path) as image:
        return to_tensor(image, size, channels)


def load_model(weights_dir: Path) -> tuple[SmallCNN, dict]:
    """model.pt + metadata.json from train.py → the model in eval mode and its metadata.

    This pair is the whole hand-over from training to anything that predicts (explain.py,
    and FastAPI in API-003).
    """
    model_file, metadata_file = weights_dir / "model.pt", weights_dir / "metadata.json"
    if not model_file.is_file() or not metadata_file.is_file():
        raise FileNotFoundError(f"no model.pt / metadata.json in {weights_dir}: run train.py first")
    metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
    model = SmallCNN(len(metadata["classes"]), task_of(metadata)["channels"])
    model.load_state_dict(torch.load(model_file, weights_only=True))
    model.eval()
    return model, metadata
