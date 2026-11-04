/**
 * Scan page (WEB-006) against POST /predict (API-003P) and POST /explain (API-004).
 * Runs in the browser, so it calls the same-origin proxy (/api/...) and the session
 * cookie goes along by itself. The web app never sees the model: FastAPI runs the CNN
 * and Grad-CAM and answers with JSON (/predict) and a PNG (/explain).
 */
import { errorMessage } from "./admin";

/** Must match MAX_UPLOAD_BYTES in services/api/predict.py. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** The API's own message for a too-large file (predict.read_scan). */
export const TOO_LARGE_MESSAGE = "The file is larger than 10 MB.";

export type Prediction = {
  class: string;
  confidence: number;
  probabilities: Record<string, number>;
  model_version: string;
  notice: string;
};

export type ScanOutcome =
  | { kind: "ok"; prediction: Prediction; heatmap: Blob }
  | { kind: "error"; message: string };

function upload(path: string, file: File): Promise<Response> {
  const body = new FormData();
  body.append("file", file);
  return fetch(path, { method: "POST", body, cache: "no-store" });
}

async function failure(response: Response): Promise<ScanOutcome> {
  const body = (await response.json().catch(() => ({}))) as {
    detail?: unknown;
  };
  return { kind: "error", message: errorMessage(body.detail) };
}

/** The prediction and its Grad-CAM heat-map for one scan, or the API's error message. */
export async function analyzeScan(file: File): Promise<ScanOutcome> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { kind: "error", message: TOO_LARGE_MESSAGE };
  }
  try {
    const [predicted, explained] = await Promise.all([
      upload("/api/predict", file),
      upload("/api/explain", file),
    ]);
    if (!predicted.ok) return await failure(predicted);
    if (!explained.ok) return await failure(explained);
    return {
      kind: "ok",
      prediction: (await predicted.json()) as Prediction,
      heatmap: await explained.blob(),
    };
  } catch {
    return {
      kind: "error",
      message: "Cannot reach the server. Please try again.",
    };
  }
}

/** 0.8734 → "87.3%". */
export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(1)}%`;
}
