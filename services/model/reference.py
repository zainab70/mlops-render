"""What the training scans and the test predictions looked like, for drift monitoring (ML-005).

train.py writes reference.json next to model.pt. API-010 compares the live scans and predictions that
API-009 stores with it: the same scan_stats.measure(), the same scan_stats.BIN_EDGES and the same
histogram() here, so training and serving are always measured and counted the same way. Only numbers
leave here, never pixels.
"""

import json
from bisect import bisect_right
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path

from PIL import Image

import scan_stats

REFERENCE_FILE = "reference.json"

# The highest softmax probability per scan (the API's "confidence"), in steps of 0.1.
CONFIDENCE_EDGES: tuple[float, ...] = (0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0)


def bin_of(value: float, edges: Sequence[float]) -> int:
    """Bins are [edge, next edge); below the first edge → first bin, from the last edge up → last bin."""
    return min(max(bisect_right(edges, value) - 1, 0), len(edges) - 2)


def histogram(values: Sequence[float], edges: Sequence[float]) -> dict:
    """Count and share per bin; the shares sum to 1."""
    counts = [0] * (len(edges) - 1)
    for value in values:
        counts[bin_of(value, edges)] += 1
    return {"edges": list(edges), "counts": counts, "shares": [count / len(values) for count in counts]}


def scan_reference(paths: Iterable[Path]) -> dict:
    """Share per bin of each scan statistic, every scan measured by scan_stats.measure as stored."""
    measured = []
    for path in paths:
        with Image.open(path) as image:
            measured.append(scan_stats.measure(image))
    return {
        "images": len(measured),
        "statistics": {
            name: histogram([values[name] for values in measured], scan_stats.BIN_EDGES[name])
            for name in scan_stats.STATISTICS
        },
    }


def prediction_reference(predicted: Sequence[int], confidences: Sequence[float], classes: Sequence[str]) -> dict:
    """Share of each predicted class and the confidence histogram of the test split."""
    counts = [0] * len(classes)
    for index in predicted:
        counts[index] += 1
    return {
        "images": len(predicted),
        "class_shares": {label: count / len(predicted) for label, count in zip(classes, counts, strict=True)},
        "confidence": histogram(confidences, CONFIDENCE_EDGES),
    }


def write(out: Path, metadata: Mapping, scans: dict, predictions: dict) -> Path:
    """reference.json in the weights folder; sorted keys and no wall-clock time, so a rerun is identical."""
    reference = {
        # A DEV run keeps dataset_kind "dev": its reference describes development data only.
        "dataset_kind": metadata["dataset_kind"],
        "model_version": metadata["model_version"],
        "training_scans": scans,
        "test_predictions": predictions,
    }
    path = out / REFERENCE_FILE
    path.write_text(json.dumps(reference, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path
