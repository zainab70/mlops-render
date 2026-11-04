import { apiUrl, SESSION_COOKIE } from "./config";
import type { ApiResult } from "./experiments";

/** One deployment of GET /deployments (services/api/deployments.py, API-011). Field names are the API's. */
export type DeploymentEntry = {
  /** The deployments row; null for the live API. */
  id: number | null;
  name: string;
  /** "live" = this API service; "demo" = an invented seed row. */
  source: string;
  /** "healthy" | "degraded" | "stopped" */
  status: string;
  environment: string | null;
  endpoint: string | null;
  model_version: string | null;
  /** The models row it serves: the Details link to /models?id=. */
  version_id: number | null;
  region: string | null;
  replicas: number | null;
  /** When it started serving (the live API: this process's start). */
  since: string;
  requests: number | null;
  /** A fraction. */
  success_rate: number | null;
  latency_ms: { p50: number; p95: number; p99: number } | null;
  /** Field → why it has no value. */
  reasons: Record<string, string>;
};

export type DeploymentsData = {
  deployments: DeploymentEntry[];
  stats: {
    /** Last 7 days. */
    total_requests: number;
    /** Last 24 hours, a fraction. */
    success_rate: number | null;
    /** Last 7 days. */
    p50_ms: number | null;
    served_since: string;
    reasons: Record<string, string>;
  };
  /** This hour and the 23 before, oldest first. */
  latency: {
    hours: {
      hour: string;
      requests: number;
      p50: number | null;
      p95: number | null;
      p99: number | null;
    }[];
    reason: string | null;
  };
  /** Today and the 6 days before, oldest first. */
  throughput: {
    days: { date: string; requests: number }[];
    reason: string | null;
  };
};

/** GET /deployments on the server with the session cookie. Never throws: the page shows an error state. */
export async function getDeployments(
  sessionToken: string | undefined,
): Promise<ApiResult<DeploymentsData>> {
  try {
    const response = await fetch(`${apiUrl()}/deployments`, {
      headers: { cookie: `${SESSION_COOKIE}=${sessionToken ?? ""}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        kind: "error",
        message: `The API answered HTTP ${response.status}.`,
      };
    }
    return { kind: "ok", data: (await response.json()) as DeploymentsData };
  } catch {
    return { kind: "error", message: "The API could not be reached." };
  }
}
