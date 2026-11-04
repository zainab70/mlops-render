"""Grad-CAM: which parts of the image pushed a class score up (ML-003).

1. Run the image through the CNN and keep the output of its last convolution block
   (64 small feature maps).
2. Ask how much the chosen class score changes when each feature map changes (its
   gradient), and average that over the map: one importance weight per feature map.
3. Add up the feature maps with those weights, keep only the positive part, stretch
   it to the image's size and scale it to [0, 1].

It shows where the model looked, not why a disease is there; a wrong prediction can
light up the wrong place.
"""

import io
from dataclasses import dataclass

import torch
import torch.nn.functional as F
from PIL import Image

from model import SmallCNN

OVERLAY_ALPHA = 0.45  # how strongly the colours cover the scan


@dataclass
class Explanation:
    heatmap: torch.Tensor  # H x W, values in [0, 1], same size as the input tensor
    class_index: int  # the class the map explains
    probabilities: list[float]  # softmax over all classes, in metadata order


def grad_cam(model: SmallCNN, image: torch.Tensor, class_index: int | None = None) -> Explanation:
    """Heat-map for one C x H x W image (C = the model's channels). Default class: the predicted one."""
    classes = model.head.out_features
    if class_index is not None and not 0 <= class_index < classes:
        raise ValueError(f"class index {class_index} is outside 0..{classes - 1}")

    model.eval()
    captured: dict[str, torch.Tensor] = {}
    handle = model.features.register_forward_hook(lambda _module, _inputs, output: captured.update(maps=output))
    try:
        with torch.enable_grad():
            scores = model(image.unsqueeze(0))[0]
            chosen = int(scores.argmax()) if class_index is None else class_index
            # autograd.grad returns the gradient without storing .grad on the weights.
            (gradients,) = torch.autograd.grad(scores[chosen], captured["maps"])
    finally:
        handle.remove()

    maps = captured["maps"].detach()
    weights = gradients.mean(dim=(2, 3), keepdim=True)
    cam = torch.relu((weights * maps).sum(dim=1, keepdim=True))
    cam = F.interpolate(cam, size=tuple(image.shape[-2:]), mode="bilinear", align_corners=False)[0, 0]
    top = cam.max()
    heatmap = (cam / top).clamp(0.0, 1.0) if top > 0 else torch.zeros_like(cam)
    probabilities = torch.softmax(scores.detach(), dim=0).tolist()
    return Explanation(heatmap, chosen, probabilities)


def _palette() -> list[int]:
    """256 colours from dark blue (0) through cyan, yellow to red (1), drawn by hand."""
    colours: list[int] = []
    for level in range(256):
        t = level / 255
        for centre in (3, 2, 1):  # red, green, blue
            colours.append(round(255 * min(1.0, max(0.0, 1.5 - abs(4 * t - centre)))))
    return colours


PALETTE = _palette()


def overlay(image: Image.Image, heatmap: torch.Tensor, alpha: float = OVERLAY_ALPHA) -> bytes:
    """The scan in grayscale with the coloured heat-map on top, as PNG bytes at the scan's own size."""
    base = image.convert("L").convert("RGB")
    height, width = heatmap.shape
    levels = (heatmap * 255).round().to(torch.uint8).flatten().tolist()
    heat = Image.frombytes("L", (width, height), bytes(levels)).resize(base.size, Image.Resampling.BILINEAR)
    coloured = heat.convert("P")
    coloured.putpalette(PALETTE)
    blended = Image.blend(base, coloured.convert("RGB"), alpha)
    buffer = io.BytesIO()
    blended.save(buffer, format="PNG")
    return buffer.getvalue()
