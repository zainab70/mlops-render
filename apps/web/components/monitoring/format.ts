/**
 * How the Monitoring page writes GET /monitoring's numbers (docs/figma/monitoring.md). Shared by the
 * page and the e2e tests, so a test can compute what the page must show from the same answer.
 */

import { weekday } from "@/components/dashboard/format";
import type { DriftRow, MonitoringData, Statistic } from "@/lib/api/monitoring";

export const NO_DATA = "—";
export const RETRAIN_REASON = "Training starts from the command line for now";
export const NO_DRIFT = "No statistic is above the drift threshold.";
export const NO_VOLUME = "No predictions in the last 7 days";
export const NO_MODEL = "No model loaded";

/** What each statistic measures (the "features" of the design), and its colour in the drift chart. */
export const STATISTICS: Record<Statistic, { about: string; color: string }> = {
  mean: { about: "brightness of the scan", color: "var(--status-error)" },
  std: { about: "contrast of the scan", color: "var(--status-warning)" },
  width: { about: "width in pixels", color: "var(--status-info)" },
  height: { about: "height in pixels", color: "var(--ai-purple)" },
  predicted_class: {
    about: "mix of predicted classes",
    color: "var(--status-success)",
  },
  confidence: {
    about: "confidence of the predictions",
    color: "var(--muted-foreground)",
  },
};

export type Level = "error" | "warning" | "success";

export const LEVEL_COLOR: Record<Level, string> = {
  error: "var(--status-error)",
  warning: "var(--status-warning)",
  success: "var(--status-success)",
};

/** 0.4159 → "41.6%" (the design's drift score: × 100, 1 decimal). */
export function driftScore(psi: number | null): string {
  return psi === null ? NO_DATA : `${(psi * 100).toFixed(1)}%`;
}

/** 0.2 → "20%" (× 100, 0 decimals). */
export function thresholdText(threshold: number): string {
  return `${(threshold * 100).toFixed(0)}%`;
}

/** The design's colour rule: above the threshold → error, above 70 % of it → warning, else success. */
export function level(psi: number, threshold: number): Level {
  if (psi > threshold) return "error";
  // Rounded: 0.7 * 0.2 is 0.13999999999999999, which would make 0.14 a warning (API: low).
  if (psi > Math.round(threshold * 0.7 * 1e6) / 1e6) return "warning";
  return "success";
}

/** The progress bar's width: PSI / threshold, capped at 100 %. */
export function progressWidth(psi: number, threshold: number): string {
  return `${Math.min(psi / threshold, 1) * 100}%`;
}

/** The ratio next to the bar, 0 decimals (not capped: 208% says how far above). */
export function progressText(progress: number): string {
  return `${Math.round(progress * 100)}%`;
}

export const SEVERITY_CLASS: Record<string, string> = {
  high: "bg-[var(--status-error)]/20 text-[var(--status-error)]",
  medium: "bg-[var(--status-warning)]/20 text-[var(--status-warning)]",
  low: "bg-[var(--status-info)]/20 text-[var(--status-info)]",
};

/** The statistics whose newest PSI is above the threshold (the alert banner names them). */
export function aboveThreshold(data: MonitoringData): DriftRow[] {
  return data.table.filter(
    (row) => row.psi !== null && row.psi > row.threshold,
  );
}

/** Rows of the drift chart: one per week, a value per statistic that has one, and the week's reason. */
export function driftRows(
  data: MonitoringData,
): ({ name: string } & Record<string, number | string>)[] {
  return data.drift.map((week) => {
    const row: { name: string } & Record<string, number | string> = {
      name: week.week,
    };
    for (const [name, value] of Object.entries(week.psi)) {
      if (value !== null) row[name] = value;
    }
    if (week.reason) row.reason = week.reason;
    return row;
  });
}

/** Rows of the volume chart: one per day, named by its weekday as in the design. */
export function volumeRows(data: MonitoringData) {
  return data.volume.map((day) => ({
    name: weekday(day.date),
    predictions: day.predictions,
    errors: day.errors,
  }));
}

export function hasVolume(data: MonitoringData): boolean {
  return data.volume.some((day) => day.predictions > 0);
}

/**
 * The four stat cards: value and, when there is no number, the API's reason. Without any PSI (no
 * reference, too few predictions) High and Medium are "—" too: "0 high" would claim a check that
 * did not happen.
 */
export function statCards(
  data: MonitoringData,
): { title: string; value: string; reason: string | null; color?: string }[] {
  const { stats } = data;
  const measured = stats.average_psi !== null;
  const counted = (value: number) => (measured ? String(value) : NO_DATA);
  const reason = measured ? null : stats.reason;
  return [
    {
      title: "Statistics Monitored",
      value: String(stats.monitored),
      reason: null,
    },
    {
      title: "High Drift",
      value: counted(stats.high),
      reason,
      color: "text-[var(--status-error)]",
    },
    {
      title: "Medium Drift",
      value: counted(stats.medium),
      reason,
      color: "text-[var(--status-warning)]",
    },
    {
      title: "Avg Drift Score",
      value: driftScore(stats.average_psi),
      reason,
    },
  ];
}
