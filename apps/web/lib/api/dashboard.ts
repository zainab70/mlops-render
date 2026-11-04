import { apiUrl, SESSION_COOKIE } from "./config";

/** GET /dashboard (services/api/dashboard.py, API-005). Field names are the API's. */
export type DashboardData = {
  stats: {
    experiments_running: number;
    experiments_total: number;
    models_production: number;
    models_staging: number;
    deployments_healthy: number;
    deployments_total: number;
  };
  recent_experiments: {
    id: number;
    name: string;
    status: string;
    accuracy: number | null;
    created_at: string;
  }[];
  api: { status: string; uptime_seconds: number };
  model: {
    model_version: string;
    dataset_kind: string | null;
    accuracy: number | null;
    accuracy_metric: string | null;
    label: string | null;
    accuracy_reason: string | null;
  } | null;
  traffic: {
    since: string;
    days: { date: string; requests: number }[];
    success_rate: number | null;
    latency_ms: { p50: number; p95: number; p99: number } | null;
    requests_last_minute: number;
    predictions_last_minute: number;
  };
};

export type DashboardResult =
  { kind: "ok"; data: DashboardData } | { kind: "error"; message: string };

/** The real GET /health, timed on the server: its round trip is the "Response Time". */
export type HealthResult =
  { kind: "ok"; status: string; ms: number } | { kind: "unreachable" };

/** GET /dashboard on the server, with the session cookie. Never throws: the page shows an error state. */
export async function getDashboard(
  sessionToken: string | undefined,
): Promise<DashboardResult> {
  try {
    const response = await fetch(`${apiUrl()}/dashboard`, {
      headers: { cookie: `${SESSION_COOKIE}=${sessionToken ?? ""}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        kind: "error",
        message: `The API answered HTTP ${response.status}.`,
      };
    }
    return { kind: "ok", data: (await response.json()) as DashboardData };
  } catch {
    return { kind: "error", message: "The API could not be reached." };
  }
}

const HEALTH_TIMEOUT_MS = 3000;

export async function checkHealth(): Promise<HealthResult> {
  const started = performance.now();
  try {
    const response = await fetch(`${apiUrl()}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!response.ok) return { kind: "unreachable" };
    const body = (await response.json()) as { status?: string };
    if (body.status !== "ok") return { kind: "unreachable" };
    return { kind: "ok", status: body.status, ms: performance.now() - started };
  } catch {
    return { kind: "unreachable" };
  }
}
