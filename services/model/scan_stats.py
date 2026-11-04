"""The numbers measured on every scan, for drift monitoring (API-009, ML-005, API-010).

The ONE place a scan is measured: the API (prediction_log.py) measures each uploaded scan with
measure(), and train.py (ML-005) measures the training scans with the same function, so training and
serving can never measure differently. Only numbers leave here, never pixels.

    mean, std    of the grayscale pixels scaled to 0–1 (brightness and contrast)
    width, height of the image as uploaded, in pixels

BIN_EDGES are fixed, so the reference (training) and the live shares per bin are always comparable.
"""

from PIL import Image, ImageStat

STATISTICS = ("mean", "std", "width", "height")

# Fixed bin edges per statistic: values below the first or above the last edge fall into the first or
# last bin. Grayscale fractions in steps of 0.1; sizes in pixels around typical MRI slice sizes.
BIN_EDGES: dict[str, tuple[float, ...]] = {
    "mean": (0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0),
    "std": (0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5),
    "width": (0, 64, 128, 176, 208, 256, 384, 512, 1024, 4096),
    "height": (0, 64, 128, 176, 208, 256, 384, 512, 1024, 4096),
}


def measure(image: Image.Image) -> dict[str, float]:
    """Mean and std of the grayscale pixels (0–1), width and height of an uploaded scan."""
    # ImageStat runs in C; stddev is the population standard deviation, over 0–255 grayscale values.
    stat = ImageStat.Stat(image.convert("L"))
    return {
        "mean": round(stat.mean[0] / 255.0, 6),
        "std": round(stat.stddev[0] / 255.0, 6),
        "width": float(image.width),
        "height": float(image.height),
    }
