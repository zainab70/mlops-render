import type { ExperimentDetails, ExperimentRow } from "@/lib/api/experiments";

/**
 * A GET /experiments answer for unit tests. Every value differs from the design's mock data, so a
 * design value on the page can only mean it was hard-coded.
 */
export const ROWS: ExperimentRow[] = [
  {
    id: 57,
    name: "SmallCNN dev cnn-unit-a",
    status: "completed",
    source: "training",
    dataset_kind: "dev",
    accuracy: 0.71234,
    precision: 0.6543,
    recall: 0.6789,
    f1: 0.6661,
    duration_seconds: 6120,
    created_at: "2026-10-16T07:05:00Z",
  },
  {
    id: 56,
    name: "cnn-unit-crashed",
    status: "failed",
    source: "demo",
    dataset_kind: null,
    accuracy: 0.5,
    precision: 0.4,
    recall: 0.3,
    f1: 0.2,
    duration_seconds: 40,
    created_at: "2026-10-15T07:05:00Z",
  },
  {
    id: 55,
    name: "cnn-unit-best",
    status: "completed",
    source: "demo",
    dataset_kind: null,
    accuracy: 0.8812,
    precision: null,
    recall: null,
    f1: null,
    duration_seconds: null,
    created_at: "2026-10-14T07:05:00Z",
  },
  {
    id: 54,
    name: "cnn-unit-third",
    status: "completed",
    source: "training",
    dataset_kind: "miriad",
    accuracy: 0.6021,
    precision: 0.61,
    recall: 0.62,
    f1: 0.63,
    duration_seconds: 900,
    created_at: "2026-10-13T07:05:00Z",
  },
  {
    id: 53,
    name: "cnn-unit-fourth",
    status: "completed",
    source: "training",
    dataset_kind: "miriad",
    accuracy: 0.5511,
    precision: 0.52,
    recall: 0.53,
    f1: 0.54,
    duration_seconds: 300,
    created_at: "2026-10-12T07:05:00Z",
  },
  {
    id: 52,
    name: "cnn-unit-running",
    status: "running",
    source: "demo",
    dataset_kind: null,
    accuracy: null,
    precision: null,
    recall: null,
    f1: null,
    duration_seconds: null,
    created_at: "2026-10-11T07:05:00Z",
  },
];

export const DETAILS: ExperimentDetails = {
  ...ROWS[0],
  epochs: 11,
  model_version: "cnn-unit-a",
  parameters: { learning_rate: 0.0007, batch_size: 24, seed: 3 },
};

export const FAILED_DETAILS: ExperimentDetails = {
  ...ROWS[1],
  epochs: 6,
  model_version: null,
  parameters: null,
};
