import type { MonitoringData, Statistic } from "@/lib/api/monitoring";

/**
 * Invented GET /monitoring answers for the unit tests. Every value differs from the design's mock
 * data (docs/figma/monitoring.md), so a test can prove the page shows the API's values, never the mock.
 */

const STATS: Statistic[] = [
  "mean",
  "std",
  "width",
  "height",
  "predicted_class",
  "confidence",
];

const WEEKS = [
  ["2026-W38", "2026-09-14"],
  ["2026-W39", "2026-09-21"],
  ["2026-W40", "2026-09-28"],
  ["2026-W41", "2026-10-05"],
  ["2026-W42", "2026-10-12"],
  ["2026-W43", "2026-10-19"],
] as const;

const NOT_ENOUGH = "not enough predictions";
export const NO_REFERENCE = "no reference statistics (retrain with ML-005)";

const nulls = () =>
  Object.fromEntries(STATS.map((s) => [s, null])) as Record<Statistic, null>;

/** A non-DEV model: W38–W40 too few predictions, then numbers; mean drifts above the threshold. */
export const DRIFTING: MonitoringData = {
  model: {
    model_version: "cnn-f1x2y3z4w5v6",
    dataset_kind: "miriad",
    label: null,
  },
  threshold: 0.2,
  min_predictions: 30,
  drift: WEEKS.map(([week, start], i) =>
    i < 3
      ? { week, start, predictions: 4 + i, psi: nulls(), reason: NOT_ENOUGH }
      : {
          week,
          start,
          predictions: 31 + i,
          psi: {
            mean: [0.0412, 0.1937, 0.4159][i - 3],
            std: [0.0215, 0.1503, 0.1712][i - 3],
            width: 0,
            height: 0,
            predicted_class: [0.0133, 0.0374, 0.0641][i - 3],
            confidence: [0.0721, 0.0516, 0.0298][i - 3],
          },
          reason: null,
        },
  ),
  table: [
    {
      statistic: "mean",
      psi: 0.4159,
      threshold: 0.2,
      trend: "up",
      severity: "high",
      progress: 2.0795,
      reason: null,
    },
    {
      statistic: "std",
      psi: 0.1712,
      threshold: 0.2,
      trend: "up",
      severity: "medium",
      progress: 0.856,
      reason: null,
    },
    {
      statistic: "width",
      psi: 0,
      threshold: 0.2,
      trend: "stable",
      severity: "low",
      progress: 0,
      reason: null,
    },
    {
      statistic: "height",
      psi: 0,
      threshold: 0.2,
      trend: "stable",
      severity: "low",
      progress: 0,
      reason: null,
    },
    {
      statistic: "predicted_class",
      psi: 0.0641,
      threshold: 0.2,
      trend: "up",
      severity: "low",
      progress: 0.3205,
      reason: null,
    },
    {
      statistic: "confidence",
      psi: 0.0298,
      threshold: 0.2,
      trend: "stable",
      severity: "low",
      progress: 0.149,
      reason: null,
    },
  ],
  volume: [
    { date: "2026-10-15", predictions: 6, errors: 1 },
    { date: "2026-10-16", predictions: 9, errors: 0 },
    { date: "2026-10-17", predictions: 0, errors: 0 },
    { date: "2026-10-18", predictions: 3, errors: 2 },
    { date: "2026-10-19", predictions: 14, errors: 1 },
    { date: "2026-10-20", predictions: 22, errors: 0 },
    { date: "2026-10-21", predictions: 11, errors: 3 },
  ],
  stats: {
    monitored: 6,
    high: 1,
    medium: 1,
    average_psi: 0.1137,
    reason: null,
  },
};

/** The same numbers from a DEV model: the DEV label goes next to every drift number. */
export const DRIFTING_DEV: MonitoringData = {
  ...DRIFTING,
  model: {
    model_version: "cnn-a9b8c7d6e5f4",
    dataset_kind: "dev",
    label: "development data — not a valid performance estimate",
  },
};

/** Measured, nothing above the threshold. */
export const CALM: MonitoringData = {
  ...DRIFTING,
  table: DRIFTING.table.map((row) =>
    row.statistic === "mean"
      ? {
          ...row,
          psi: 0.0533,
          trend: "down",
          severity: "low",
          progress: 0.2665,
        }
      : row,
  ),
  stats: {
    monitored: 6,
    high: 0,
    medium: 1,
    average_psi: 0.0531,
    reason: null,
  },
};

/** The human's current model: trained before ML-005, so no reference.json and no drift at all. */
export const NO_REFERENCE_DATA: MonitoringData = {
  ...DRIFTING,
  drift: WEEKS.map(([week, start]) => ({
    week,
    start,
    predictions: 0,
    psi: nulls(),
    reason: NO_REFERENCE,
  })),
  table: STATS.map((statistic) => ({
    statistic,
    psi: null,
    threshold: 0.2,
    trend: null,
    severity: null,
    progress: null,
    reason: NO_REFERENCE,
  })),
  stats: {
    monitored: 6,
    high: 0,
    medium: 0,
    average_psi: null,
    reason: NO_REFERENCE,
  },
};

/** No answer stored in the last 7 days. */
export const QUIET: MonitoringData = {
  ...DRIFTING,
  volume: DRIFTING.volume.map((day) => ({ ...day, predictions: 0, errors: 0 })),
};
