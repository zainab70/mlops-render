/**
 * How the Experiments page writes the API's values. Shared by the page and the tests, so a test can
 * compute what the page must show from the same GET /experiments answer.
 */

import { duration, NO_DATA } from "@/components/dashboard/format";
import type { ExperimentRow } from "@/lib/api/experiments";

export { NO_DATA };
export const NOT_APPLICABLE = "N/A";

export const METRICS = [
  ["accuracy", "Accuracy"],
  ["precision", "Precision"],
  ["recall", "Recall"],
  ["f1", "F1 Score"],
] as const;
export type Metric = (typeof METRICS)[number][0];

export const ACCURACY_HINT =
  "Balanced accuracy: the mean recall over the classes";
export const DEV_LABEL = "DEV";
export const DEV_HINT = "development data — not a valid performance estimate";
export const DEMO_LABEL = "demo";
export const DEMO_HINT = "an invented seed row, not a real training run";
export const NEW_EXPERIMENT_REASON =
  "Training starts from the command line for now";
export const CHART_TITLE = "Top 3 Experiments Comparison";
export const CHART_EMPTY_REASON =
  "No completed training run yet; the chart compares the top 3 completed runs by accuracy.";

/**
 * A metric as the table (1 decimal) or the details panel (2 decimals) shows it: "N/A" for a failed
 * run (the design's rule), "—" when nothing was recorded.
 */
export function metric(
  row: ExperimentRow,
  key: Metric,
  decimals: 1 | 2,
): string {
  if (row.status === "failed") return NOT_APPLICABLE;
  const value = row[key];
  return value === null ? NO_DATA : `${(value * 100).toFixed(decimals)}%`;
}

/** 6120 → "1h 42m", 900 → "15m", 40 → "40s"; "—" when the run has no duration (demo rows). */
export function runDuration(seconds: number | null): string {
  return seconds === null ? NO_DATA : duration(seconds);
}

/** ISO timestamp → "2026-10-12 08:00" (UTC, so server render and tests agree). */
export function created(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

/** The labels a row carries next to its name. */
export function labels(row: ExperimentRow): { text: string; hint: string }[] {
  const found = [];
  if (row.source === "demo") found.push({ text: DEMO_LABEL, hint: DEMO_HINT });
  if (row.dataset_kind === "dev")
    found.push({ text: DEV_LABEL, hint: DEV_HINT });
  return found;
}

/** The chart's runs: the 3 completed rows with the highest accuracy (fewer when fewer exist). */
export function topThree(rows: ExperimentRow[]): ExperimentRow[] {
  return rows
    .filter((r) => r.status === "completed" && r.accuracy !== null)
    .sort((a, b) => b.accuracy! - a.accuracy!)
    .slice(0, 3);
}
