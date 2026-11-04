import { apiUrl, SESSION_COOKIE } from "./config";
import type { ApiResult } from "./experiments";

/** One version of GET /models (API-007). Field names are the API's. */
export type ModelVersion = {
  id: number;
  version: string;
  /** "staging" | "production" | "archived" */
  stage: string;
  /** Balanced accuracy, a fraction. */
  accuracy: number | null;
  /** Of the linked experiment; "dev" = development data, not a valid performance estimate. */
  dataset_kind: string | null;
  size_bytes: number | null;
  experiment_id: number | null;
  /** When the version got its stage (API-008); for a production version: when it became production. */
  stage_changed_at: string | null;
  created_at: string;
  /** Percent of measured /predict requests; only the version the API serves can have a share. */
  traffic: number | null;
  traffic_reason: string | null;
};

/** One model (a name) with its versions, newest first. */
export type ModelEntry = {
  name: string;
  description: string | null;
  framework: string;
  /** "training" = registered by record_run.py; "demo" = an invented seed row. */
  source: string;
  versions: ModelVersion[];
};

export type RegistryStats = {
  total_models: number;
  in_production: number;
  in_staging: number;
  avg_accuracy: number | null;
  avg_accuracy_reason: string | null;
};

export type Registry = { models: ModelEntry[]; stats: RegistryStats };

/** GET /models on the server with the session cookie. Never throws: the page shows an error state. */
export async function getModels(
  sessionToken: string | undefined,
): Promise<ApiResult<Registry>> {
  try {
    const response = await fetch(`${apiUrl()}/models`, {
      headers: { cookie: `${SESSION_COOKIE}=${sessionToken ?? ""}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        kind: "error",
        message: `The API answered HTTP ${response.status}.`,
      };
    }
    return { kind: "ok", data: (await response.json()) as Registry };
  } catch {
    return { kind: "error", message: "The API could not be reached." };
  }
}

/** Promote's URL: from the browser through the Next /api proxy, so the session cookie goes along. */
export function promoteHref(versionId: number): string {
  return `/api/models/versions/${versionId}/promote`;
}

/** POST promote; on failure the API's own message (409 "only a staging version can be promoted; ..."). */
export async function promoteVersion(
  versionId: number,
): Promise<ApiResult<ModelEntry>> {
  try {
    const response = await fetch(promoteHref(versionId), { method: "POST" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        kind: "error",
        message:
          body && typeof body.detail === "string"
            ? body.detail
            : `The API answered HTTP ${response.status}.`,
      };
    }
    return { kind: "ok", data: body as ModelEntry };
  } catch {
    return { kind: "error", message: "The API could not be reached." };
  }
}
