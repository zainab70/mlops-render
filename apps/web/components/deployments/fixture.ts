import type { DeploymentEntry, DeploymentsData } from "@/lib/api/deployments";

/**
 * Invented GET /deployments answers for the unit tests. Every value differs from the design's mock
 * data (docs/figma/deployments.md), so a test can prove the page shows the API's values, never the mock.
 */

const NOT_KNOWN = "not known to the API";
const DEMO_TRAFFIC = "demo row: no measured traffic";

export const LIVE: DeploymentEntry = {
  id: null,
  name: "MLOps Hub API",
  source: "live",
  status: "healthy",
  environment: null,
  endpoint: "/predict",
  model_version: "cnn-f1x2y3z4w5v6",
  version_id: 7,
  region: null,
  replicas: null,
  since: "2026-10-20T07:15:00Z",
  requests: 12_431,
  success_rate: 0.9172,
  latency_ms: { p50: 13.4, p95: 96.2, p99: 141.7 },
  reasons: { region: NOT_KNOWN, replicas: NOT_KNOWN, environment: NOT_KNOWN },
};

const demo = (
  id: number,
  name: string,
  status: string,
  version: string,
  replicas: number,
): DeploymentEntry => ({
  id,
  name,
  source: "demo",
  status,
  environment: status === "healthy" ? "production" : "staging",
  endpoint: null,
  model_version: version,
  version_id: id + 1,
  region: null,
  replicas,
  since: "2026-10-09T08:00:00Z",
  requests: null,
  success_rate: null,
  latency_ms: null,
  reasons: {
    endpoint: NOT_KNOWN,
    region: NOT_KNOWN,
    requests: DEMO_TRAFFIC,
    success_rate: DEMO_TRAFFIC,
    latency_ms: DEMO_TRAFFIC,
  },
});

export const PROD_DEMO = demo(
  1,
  "alzheimer-api-prod",
  "healthy",
  "cnn-seed-v2",
  2,
);
export const STAGING_DEMO = demo(
  2,
  "alzheimer-api-staging",
  "degraded",
  "cnn-seed-v3",
  1,
);

const hours = Array.from({ length: 24 }, (_, i) => {
  const hour = new Date(Date.UTC(2026, 9, 20, 13 + i)).toISOString();
  return i % 5 === 0
    ? { hour, requests: 0, p50: null, p95: null, p99: null }
    : { hour, requests: 3 + i, p50: 11 + i, p95: 60 + 2 * i, p99: 90 + 3 * i };
});

export const DEPLOYMENTS: DeploymentsData = {
  deployments: [LIVE, PROD_DEMO, STAGING_DEMO],
  stats: {
    total_requests: 1_254_310,
    success_rate: 0.9172,
    p50_ms: 13.4,
    served_since: "2026-10-20T07:15:00Z",
    reasons: {},
  },
  latency: { hours, reason: null },
  throughput: {
    days: [
      { date: "2026-10-15", requests: 41 },
      { date: "2026-10-16", requests: 0 },
      { date: "2026-10-17", requests: 17 },
      { date: "2026-10-18", requests: 63 },
      { date: "2026-10-19", requests: 8 },
      { date: "2026-10-20", requests: 29 },
      { date: "2026-10-21", requests: 52 },
    ],
    reason: null,
  },
};

/** The e2e / your API case: the served model is not registered, so Details has no version. */
export const UNREGISTERED: DeploymentsData = {
  ...DEPLOYMENTS,
  deployments: [
    {
      ...LIVE,
      model_version: "cnn-local",
      version_id: null,
      reasons: {
        ...LIVE.reasons,
        version_id: "the served model is not in the registry",
      },
    },
    PROD_DEMO,
    STAGING_DEMO,
  ],
};

/** No stored answers at all. */
export const EMPTY: DeploymentsData = {
  deployments: [
    {
      ...LIVE,
      requests: 0,
      success_rate: null,
      latency_ms: null,
      reasons: {
        ...LIVE.reasons,
        requests: "no requests yet",
        success_rate: "no requests yet",
        latency_ms: "no requests yet",
      },
    },
    PROD_DEMO,
    STAGING_DEMO,
  ],
  stats: {
    total_requests: 0,
    success_rate: null,
    p50_ms: null,
    served_since: "2026-10-20T07:15:00Z",
    reasons: {
      success_rate: "no requests in the last 24 hours",
      p50_ms: "no requests yet",
    },
  },
  latency: {
    hours: hours.map((h) => ({
      ...h,
      requests: 0,
      p50: null,
      p95: null,
      p99: null,
    })),
    reason: "no requests in the last 24 hours",
  },
  throughput: {
    days: DEPLOYMENTS.throughput.days.map((d) => ({ ...d, requests: 0 })),
    reason: "no requests in the last 7 days",
  },
};
