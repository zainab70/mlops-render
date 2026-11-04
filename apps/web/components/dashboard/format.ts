/**
 * How the Dashboard writes the API's numbers. Shared by the page and the e2e tests, so a test can
 * compute what the page must show from the same GET /dashboard answer.
 */

import type { DashboardData } from "@/lib/api/dashboard";
import type { DriftRow, MonitoringData } from "@/lib/api/monitoring";

export const NO_REQUESTS = "No requests since the API started";
export const NOT_AVAILABLE = "Not available yet";
export const NO_DATA = "—";
export const NO_DRIFT_ALERTS = "No drift above the threshold";

/** The Data Drift Alerts rows: GET /monitoring's table rows with severity high or medium, in its order. */
export function driftAlerts(data: MonitoringData): DriftRow[] {
  return data.table.filter(
    (row) => row.severity === "high" || row.severity === "medium",
  );
}

/**
 * The ISO week a table row's PSI belongs to: the newest week with a PSI for that statistic, as the API
 * picks it (services/api/monitoring.py table). Not simply the newest week: the current week has no PSI
 * until it has enough predictions.
 */
export function measuredWeek(
  data: MonitoringData,
  statistic: DriftRow["statistic"],
): string | null {
  const week = data.drift.findLast((w) => w.psi[statistic] !== null);
  return week?.week ?? null;
}

/** Model Accuracy: a number only with its DEV label (API-005); otherwise the API's reason. */
export function accuracy(model: DashboardData["model"]): {
  value: string;
  change: string;
} {
  if (model === null) return { value: NO_DATA, change: "No model loaded" };
  if (model.accuracy !== null && model.label) {
    return { value: percent(model.accuracy), change: model.label };
  }
  return {
    value: NO_DATA,
    change: `${NOT_AVAILABLE}: ${model.accuracy_reason ?? "no labelled evaluation yet"}`,
  };
}

/** 0.6123 → "61.2%" */
export function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

/** 41.6 → "42ms" */
export function milliseconds(ms: number): string {
  return `${Math.round(ms)}ms`;
}

/** 1247 → "1,247" */
export function count(value: number): string {
  return value.toLocaleString("en-US");
}

/** Seconds since the API started → "3h 12m" (never a percentage: availability needs monitoring). */
export function duration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/** ISO timestamp → "16 Oct 2026" (UTC, so server render and tests agree). */
export function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-10-16" → "Fri" (the traffic chart's x axis). */
export function weekday(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}
