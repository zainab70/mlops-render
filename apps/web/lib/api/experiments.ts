import { apiUrl, SESSION_COOKIE } from "./config";

/** The Filter's choices: the `status` query of GET /experiments (services/api/experiments.py). */
export const STATUSES = ["running", "completed", "failed"] as const;
export type ExperimentStatus = (typeof STATUSES)[number];

/** One row of GET /experiments (API-006). Field names are the API's. */
export type ExperimentRow = {
  id: number;
  name: string;
  status: string;
  /** "training" = recorded from a real run folder (record_run.py); "demo" = an invented seed row. */
  source: string;
  /** "dev" = development data, not a valid performance estimate. */
  dataset_kind: string | null;
  /** Balanced accuracy, a fraction. */
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  duration_seconds: number | null;
  created_at: string;
};

/** GET /experiments/{id}: the row plus how it was trained. */
export type ExperimentDetails = ExperimentRow & {
  parameters: Record<string, unknown> | null;
  epochs: number;
  model_version: string | null;
};

export type ApiResult<T> =
  { kind: "ok"; data: T } | { kind: "error"; message: string };

export function isStatus(value: unknown): value is ExperimentStatus {
  return STATUSES.includes(value as ExperimentStatus);
}

/** The query string for a status filter ("" for all), shared by the list and the CSV export. */
export function statusQuery(status: ExperimentStatus | null): string {
  return status ? `?status=${status}` : "";
}

/**
 * The Export link: GET /experiments/export.csv through the Next /api proxy (proxy.ts), so the
 * browser sends the session cookie along and the file equals the table.
 */
export function exportHref(status: ExperimentStatus | null): string {
  return `/api/experiments/export.csv${statusQuery(status)}`;
}

/** GET on the server with the session cookie. Never throws: the page shows an error state. */
async function get<T>(
  path: string,
  sessionToken: string | undefined,
  notFound: string,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${apiUrl()}${path}`, {
      headers: { cookie: `${SESSION_COOKIE}=${sessionToken ?? ""}` },
      cache: "no-store",
    });
    if (response.status === 404) return { kind: "error", message: notFound };
    if (!response.ok) {
      return {
        kind: "error",
        message: `The API answered HTTP ${response.status}.`,
      };
    }
    return { kind: "ok", data: (await response.json()) as T };
  } catch {
    return { kind: "error", message: "The API could not be reached." };
  }
}

/** GET /experiments, newest first; `status` filters (null = all). */
export function getExperiments(
  sessionToken: string | undefined,
  status: ExperimentStatus | null,
): Promise<ApiResult<ExperimentRow[]>> {
  return get(`/experiments${statusQuery(status)}`, sessionToken, "Not found.");
}

/** GET /experiments/{id}. */
export function getExperiment(
  sessionToken: string | undefined,
  id: number,
): Promise<ApiResult<ExperimentDetails>> {
  return get(
    `/experiments/${id}`,
    sessionToken,
    `There is no experiment #${id}.`,
  );
}
