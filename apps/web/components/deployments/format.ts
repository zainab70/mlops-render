/**
 * How the Deployments page writes GET /deployments' numbers (docs/figma/deployments.md). Shared by the
 * page and the e2e tests, so a test can compute what the page must show from the same answer.
 */

import { milliseconds, percent, weekday } from "@/components/dashboard/format";
import type { DeploymentEntry, DeploymentsData } from "@/lib/api/deployments";

export const NO_DATA = "—";
export const NEW_DEPLOYMENT_REASON =
  "Serving follows MODEL_PATH; a later slice deploys the promoted version";
export const DEGRADED_WARNING =
  "⚠️ Performance degradation detected. Consider scaling up or checking logs.";
export const DEMO_LABEL = "demo";
export const DEMO_HINT = "an invented seed row, not a real deployment";
/** The text alternative's note for an hour without answers. */
export const NO_REQUESTS_HOUR = "no requests this hour";

/** 1_250_000 → "1.25M", 12_400 → "12.4K", 312 → "312" (the design writes millions with 2 decimals). */
export function requests(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

/** "2026-10-20T07:15:00Z" → "since 20 Oct 2026, 07:15 UTC" (uptime the API can honestly state). */
export function since(iso: string): string {
  const at = new Date(iso);
  const day = at.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = at.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `since ${day}, ${time} UTC`;
}

/** "2026-10-21T09:00:00Z" → "09:00" (the latency chart's x axis, UTC). */
export function hourLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/** A value, or "—" with the API's reason for that field. */
export type Shown = { text: string; reason: string | null };

const shown = (text: string | null, reason?: string): Shown =>
  text === null
    ? { text: NO_DATA, reason: reason ?? null }
    : { text, reason: null };

/** Every field of a deployment card, as the page writes it. */
export function card(entry: DeploymentEntry) {
  const why = (field: string) => entry.reasons[field];
  const latency = entry.latency_ms;
  return {
    region: shown(entry.region, why("region")),
    replicas: shown(
      entry.replicas === null
        ? null
        : `${entry.replicas} ${entry.replicas === 1 ? "replica" : "replicas"}`,
      why("replicas"),
    ),
    version: shown(entry.model_version, why("model_version")),
    endpoint: shown(entry.endpoint, why("endpoint")),
    uptime: shown(since(entry.since)),
    requests: shown(
      entry.requests === null ? null : requests(entry.requests),
      why("requests"),
    ),
    p50: shown(latency && milliseconds(latency.p50), why("latency_ms")),
    p95: shown(latency && milliseconds(latency.p95), why("latency_ms")),
    p99: shown(latency && milliseconds(latency.p99), why("latency_ms")),
  };
}

/** The four stats cards. */
export function statCards(data: DeploymentsData) {
  const { stats } = data;
  return [
    {
      title: "Served Since",
      ...shown(since(stats.served_since).replace(/^since /, "")),
      caption: "This API's start",
    },
    {
      title: "Total Requests",
      ...shown(requests(stats.total_requests)),
      caption: "Last 7 days",
    },
    {
      title: "Avg Latency",
      ...shown(
        stats.p50_ms === null ? null : milliseconds(stats.p50_ms),
        stats.reasons.p50_ms,
      ),
      caption: "P50, last 7 days",
    },
    {
      title: "Success Rate",
      ...shown(
        stats.success_rate === null ? null : percent(stats.success_rate),
        stats.reasons.success_rate,
      ),
      caption: "Last 24 hours",
    },
  ];
}

/** Rows of the latency chart: one per hour; an hour without answers has no value but a note. */
export function latencyRows(data: DeploymentsData) {
  return data.latency.hours.map((hour) => {
    const row: { name: string } & Record<string, number | string> = {
      name: hourLabel(hour.hour),
    };
    if (hour.p50 === null || hour.p95 === null || hour.p99 === null) {
      row.note = NO_REQUESTS_HOUR;
    } else {
      row.p50 = hour.p50;
      row.p95 = hour.p95;
      row.p99 = hour.p99;
    }
    return row;
  });
}

/** The deployment id in `?id=` (a SEARCH-002 result link): a positive integer, otherwise null. */
export function highlightId(raw: string | string[] | undefined): number | null {
  const id = Number(raw);
  return typeof raw === "string" && Number.isInteger(id) && id > 0 ? id : null;
}

/** Rows of the throughput chart: one per day, named by its weekday as in the design. */
export function throughputRows(data: DeploymentsData) {
  return data.throughput.days.map((day) => ({
    name: weekday(day.date),
    requests: day.requests,
  }));
}
