"""POST /explain: the Grad-CAM overlay for an uploaded scan: API-004.

Same model, same checks as /predict (predict.py): signed in (401), model loaded (503), at most
10 MB (413), PNG or JPEG (415). The answer is the overlay PNG at the scan's own size; the
prediction travels in headers so the body stays a plain image.

Grad-CAM itself is not copied here: grad_cam and overlay come from services/model/gradcam.py,
found the same way as model.py (importing predict puts services/model on the path when needed).
"""

import threading

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import Response

from auth import current_user
from predict import LoadedModel, classify, cnn, loaded_model, note_scan, read_scan

# After predict: importing predict is what makes services/model importable outside the image.
from gradcam import grad_cam, overlay

# HTTP header values must be Latin-1, so a plain hyphen here instead of predict.NOTICE's em dash.
HEADER_NOTICE = "Research demo - not a diagnostic device."

# grad_cam adds a temporary hook to the network it explains, so it runs on loaded.explainer, a
# copy that no other forward pass uses: /predict and classify() below run on loaded.network and
# are never seen by the hook. The lock keeps two /explain requests off that one copy at a time.
_grad_cam_lock = threading.Lock()

router = APIRouter(dependencies=[Depends(current_user)])


# A plain `def`: FastAPI runs it in a worker thread, so Grad-CAM never blocks the event loop.
@router.post(
    "/explain",
    response_class=Response,
    responses={200: {"content": {"image/png": {}}, "description": "The Grad-CAM overlay at the scan's size"}},
)
def explain(request: Request, file: UploadFile = File(...), loaded: LoadedModel = Depends(loaded_model)) -> Response:
    image = read_scan(file)
    note_scan(request, image)  # stored with this answer by prediction_log.py (API-009)
    prediction = classify(loaded, image)
    request.state.prediction = prediction
    class_index = loaded.metadata["classes"].index(prediction.class_)
    tensor = cnn.to_tensor(image, loaded.metadata["input_size"], loaded.channels)
    with _grad_cam_lock:
        explanation = grad_cam(loaded.explainer, tensor, class_index)
    return Response(
        content=overlay(image, explanation.heatmap),
        media_type="image/png",
        headers={
            "X-Predicted-Class": prediction.class_,
            "X-Confidence": str(prediction.confidence),
            "X-Model-Version": prediction.model_version,
            "X-Notice": HEADER_NOTICE,
            "Cache-Control": "no-store",
        },
    )
