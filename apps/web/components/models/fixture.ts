import type { ModelEntry, Registry } from "@/lib/api/models";

/**
 * Invented registry data for the unit tests. Every value differs from the design's mock data
 * (docs/figma/models.md), so a test can prove the page shows the API's values, never the mock.
 */
export const SMALL_CNN: ModelEntry = {
  name: "SmallCNN",
  description: "Small convolutional network classifying 2D brain MRI slices",
  framework: "PyTorch",
  source: "training",
  versions: [
    {
      id: 7,
      version: "cnn-f1x2y3z4w5v6",
      stage: "staging",
      accuracy: 0.6481,
      dataset_kind: "dev",
      size_bytes: 1_468_006,
      experiment_id: 9,
      stage_changed_at: null,
      created_at: "2026-10-18T10:00:00Z",
      traffic: null,
      traffic_reason: "not serving",
    },
    {
      id: 6,
      version: "cnn-a9b8c7d6e5f4",
      stage: "production",
      accuracy: 0.6123,
      dataset_kind: "dev",
      size_bytes: 1_402_880,
      experiment_id: 8,
      stage_changed_at: "2026-10-17T15:30:00Z",
      created_at: "2026-10-16T09:00:00Z",
      traffic: 100,
      traffic_reason: null,
    },
    {
      id: 5,
      version: "cnn-0011aa22bb33",
      stage: "archived",
      accuracy: null,
      dataset_kind: "dev",
      size_bytes: 2048,
      experiment_id: 7,
      stage_changed_at: "2026-10-17T15:30:00Z",
      created_at: "2026-10-15T09:00:00Z",
      traffic: null,
      traffic_reason: "no requests yet",
    },
  ],
};

export const DEMO_MODEL: ModelEntry = {
  name: "alzheimer-cnn",
  description: null,
  framework: "PyTorch",
  source: "demo",
  versions: [
    {
      id: 2,
      version: "1.1.0",
      stage: "production",
      accuracy: 0.881,
      dataset_kind: null,
      size_bytes: null,
      experiment_id: 2,
      stage_changed_at: null,
      created_at: "2026-10-09T08:00:00Z",
      traffic: null,
      traffic_reason: "not serving",
    },
  ],
};

export const REGISTRY: Registry = {
  models: [SMALL_CNN, DEMO_MODEL],
  stats: {
    total_models: 2,
    in_production: 2,
    in_staging: 1,
    avg_accuracy: 0.881,
    avg_accuracy_reason: null,
  },
};

/** The same registry before any labelled (non-DEV) evaluation. */
export const REGISTRY_UNLABELLED: Registry = {
  models: [SMALL_CNN],
  stats: {
    total_models: 1,
    in_production: 1,
    in_staging: 1,
    avg_accuracy: null,
    avg_accuracy_reason: "no labelled evaluation yet",
  },
};
