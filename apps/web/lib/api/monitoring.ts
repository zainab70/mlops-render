import { apiUrl, SESSION_COOKIE } from "./config";
import type { ApiResult } from "./experiments";

/** The statistics GET /monitoring watches (services/api/monitoring.py STATISTICS), in its order. */
export type Statistic =
  "mean" | "std" | "width" | "height" | "predicted_class" | "confidence";

/** One ISO week of drift: a PSI per statistic, or null for all of them with the reason. */
export type DriftWeek = {
  /** "2026-W43" */
  week: string;
  /** Its Monday, "2026-10-19" (UTC). */
  start: string;
  /** Successful answers that week. */
  predictions: number;
  psi: Record<Statistic, number | null>;
  reason: string | null;
};

/** One row of the drift table: the newest week's PSI and the words that go with it. */
export type DriftRow = {
  statistic: Statistic;
  psi: number | null;
  threshold: number;
  /** "up" | "down" | "stable" */
  trend: string | null;
  /** "high" | "medium" | "low" */
  severity: string | null;
  /** psi / threshold (can be above 1). */
  progress: number | null;
  reason: string | null;
};

/** GET /monitoring (services/api/monitoring.py, API-010). Field names are the API's. */
export type MonitoringData = {
  /** The served model; null when none is loaded. label = the DEV label for a DEV model. */
  model: {
    model_version: string;
    dataset_kind: string | null;
    label: string | null;
  } | null;
  threshold: number;
  min_predictions: number;
  /** The last 6 ISO weeks, oldest first. */
  drift: DriftWeek[];
  table: DriftRow[];
  /** The last 7 days, oldest first: stored answers and errors (status >= 400). */
  volume: { date: string; predictions: number; errors: number }[];
  stats: {
    monitored: number;
    high: number;
    medium: number;
    average_psi: number | null;
    reason: string | null;
  };
};

/** GET /monitoring on the server with the session cookie. Never throws: the page shows an error state. */
export async function getMonitoring(
  sessionToken: string | undefined,
): Promise<ApiResult<MonitoringData>> {
  try {
    const response = await fetch(`${apiUrl()}/monitoring`, {
      headers: { cookie: `${SESSION_COOKIE}=${sessionToken ?? ""}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        kind: "error",
        message: `The API answered HTTP ${response.status}.`,
      };
    }
    return { kind: "ok", data: (await response.json()) as MonitoringData };
  } catch {
    return { kind: "error", message: "The API could not be reached." };
  }
}
