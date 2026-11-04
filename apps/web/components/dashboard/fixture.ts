import type { DashboardData } from "@/lib/api/dashboard";
import type { DriftRow, MonitoringData } from "@/lib/api/monitoring";

const driftRow = (
  statistic: DriftRow["statistic"],
  psi: number,
  severity: string,
): DriftRow => ({
  statistic,
  psi,
  threshold: 0.2,
  trend: "up",
  severity,
  progress: psi / 0.2,
  reason: null,
});

/** A GET /monitoring answer for unit tests: one high, one medium and two low rows. */
export const MONITORING: MonitoringData = {
  model: {
    model_version: "cnn-unit000000",
    dataset_kind: "dev",
    label: "development data — not a valid performance estimate",
  },
  threshold: 0.2,
  min_predictions: 30,
  drift: [
    {
      week: "2026-W41",
      start: "2026-10-05",
      predictions: 40,
      psi: {
        mean: 0.3,
        std: 0.15,
        width: 0,
        height: 0,
        predicted_class: 0.05,
        confidence: 0.01,
      },
      reason: null,
    },
    {
      week: "2026-W42",
      start: "2026-10-12",
      predictions: 44,
      psi: {
        mean: 0.3333,
        std: 0.1666,
        width: 0,
        height: 0,
        predicted_class: 0.0512,
        confidence: 0.0123,
      },
      reason: null,
    },
  ],
  table: [
    driftRow("mean", 0.3333, "high"),
    driftRow("std", 0.1666, "medium"),
    driftRow("predicted_class", 0.0512, "low"),
    driftRow("confidence", 0.0123, "low"),
  ],
  volume: [],
  stats: {
    monitored: 6,
    high: 1,
    medium: 1,
    average_psi: 0.0939,
    reason: null,
  },
};

/**
 * Early in a week: the current week (2026-W43) has too few predictions and no PSI, so the table's
 * values come from 2026-W42. std has no PSI in W42 either, so its value is from 2026-W41.
 */
export const MONITORING_CURRENT_WEEK_SHORT: MonitoringData = {
  ...MONITORING,
  drift: [
    MONITORING.drift[0],
    {
      ...MONITORING.drift[1],
      psi: { ...MONITORING.drift[1].psi, std: null },
    },
    {
      week: "2026-W43",
      start: "2026-10-19",
      predictions: 5,
      psi: {
        mean: null,
        std: null,
        width: null,
        height: null,
        predicted_class: null,
        confidence: null,
      },
      reason: "not enough predictions",
    },
  ],
};

/** The same answer when too few predictions were stored to compute any PSI. */
export const MONITORING_NOT_ENOUGH: MonitoringData = {
  ...MONITORING,
  table: MONITORING.table.map((row) => ({
    ...row,
    psi: null,
    trend: null,
    severity: null,
    progress: null,
    reason: "not enough predictions",
  })),
  stats: {
    monitored: 6,
    high: 0,
    medium: 0,
    average_psi: null,
    reason: "not enough predictions",
  },
};

/**
 * A GET /dashboard answer for unit tests. Every value differs from the design's mock data, so a
 * design number on the page can only mean it was hard-coded.
 */
export const DASHBOARD: DashboardData = {
  stats: {
    experiments_running: 3,
    experiments_total: 7,
    models_production: 2,
    models_staging: 3,
    deployments_healthy: 1,
    deployments_total: 2,
  },
  recent_experiments: [
    {
      id: 41,
      name: "cnn-unit-newest",
      status: "running",
      accuracy: null,
      created_at: "2026-10-15T09:30:00Z",
    },
    {
      id: 40,
      name: "cnn-unit-done",
      status: "completed",
      accuracy: 0.7345,
      created_at: "2026-10-14T09:30:00Z",
    },
    {
      id: 39,
      name: "cnn-unit-failed",
      status: "failed",
      accuracy: null,
      created_at: "2026-10-13T09:30:00Z",
    },
  ],
  api: { status: "ok", uptime_seconds: 11_520 },
  model: {
    model_version: "cnn-unit000000",
    dataset_kind: "dev",
    accuracy: 0.6123,
    accuracy_metric: "balanced_accuracy",
    label: "development data — not a valid performance estimate",
    accuracy_reason: null,
  },
  traffic: {
    since: "2026-10-15T06:00:00Z",
    days: [
      { date: "2026-10-09", requests: 0 },
      { date: "2026-10-10", requests: 2 },
      { date: "2026-10-11", requests: 0 },
      { date: "2026-10-12", requests: 5 },
      { date: "2026-10-13", requests: 1 },
      { date: "2026-10-14", requests: 0 },
      { date: "2026-10-15", requests: 6 },
    ],
    success_rate: 0.75,
    latency_ms: { p50: 51.4, p95: 88.2, p99: 131.4 },
    requests_last_minute: 5,
    predictions_last_minute: 3,
  },
};

/** The same answer before any /predict or /explain request. */
export const DASHBOARD_NO_REQUESTS: DashboardData = {
  ...DASHBOARD,
  traffic: {
    ...DASHBOARD.traffic,
    days: DASHBOARD.traffic.days.map((d) => ({ ...d, requests: 0 })),
    success_rate: null,
    latency_ms: null,
    requests_last_minute: 0,
    predictions_last_minute: 0,
  },
};
