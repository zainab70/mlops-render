/**
 * How the Models page writes the API's values. Shared by the page and the tests, so a test can
 * compute what the page must show from the same GET /models answer.
 */

import { NO_DATA, percent } from "@/components/dashboard/format";
import {
  DEMO_LABEL,
  DEV_HINT,
  DEV_LABEL,
} from "@/components/experiments/format";
import type { ModelEntry, ModelVersion } from "@/lib/api/models";

export { DEMO_LABEL, DEV_HINT, DEV_LABEL, NO_DATA };
export const DEMO_HINT = "an invented seed model, not a real training run";
export const REGISTER_REASON = "Recording a training run registers its version";
export const ACCURACY_HINT =
  "Balanced accuracy of the training run: the mean recall over the classes";
export const AVG_ACCURACY_HINT =
  "Mean over versions with a labelled evaluation; DEV versions are left out";
export const SIZE_HINT = "Size of the newest version's weights (model.pt)";
export const NO_LABELLED = "no labelled evaluation yet";

/** 1_468_006 → "1.4 MB", 2048 → "2.0 KB", 512 → "512 B"; "—" when unknown. */
export function size(bytes: number | null): string {
  if (bytes === null) return NO_DATA;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** 0.6123 → "61.2%"; "—" when the version has no accuracy. */
export function versionAccuracy(version: ModelVersion): string {
  return version.accuracy === null ? NO_DATA : percent(version.accuracy);
}

/** The Traffic cell: "<n>%" when the version served requests, otherwise the API's reason. */
export function traffic(version: ModelVersion): string {
  return version.traffic === null
    ? (version.traffic_reason ?? NO_DATA)
    : `${Math.round(version.traffic)}%`;
}

/** The distribution bar is drawn only for a share above 0 (the design's rule). */
export function hasTrafficBar(version: ModelVersion): boolean {
  return version.traffic !== null && version.traffic > 0;
}

/** Deployed: the day (UTC) a production version became production, "—" otherwise. */
export function deployed(version: ModelVersion): string {
  if (version.stage !== "production" || version.stage_changed_at === null)
    return NO_DATA;
  return new Date(version.stage_changed_at).toISOString().slice(0, 10);
}

/** Quick stat Avg Accuracy: a percent, or "—" with the API's reason. */
export function averageAccuracy(stats: {
  avg_accuracy: number | null;
  avg_accuracy_reason: string | null;
}): { value: string; reason: string | null } {
  return stats.avg_accuracy === null
    ? { value: NO_DATA, reason: stats.avg_accuracy_reason ?? NO_LABELLED }
    : { value: percent(stats.avg_accuracy), reason: null };
}

/** A model's Size: its newest version's weights (versions come newest first). */
export function modelSize(model: ModelEntry): string {
  return size(model.versions[0]?.size_bytes ?? null);
}

/** "demo" next to a seeded model's name. */
export function modelLabels(
  model: ModelEntry,
): { text: string; hint: string }[] {
  return model.source === "demo" ? [{ text: DEMO_LABEL, hint: DEMO_HINT }] : [];
}

/** "DEV" next to a version trained on development data. */
export function versionLabels(
  version: ModelVersion,
): { text: string; hint: string }[] {
  return version.dataset_kind === "dev"
    ? [{ text: DEV_LABEL, hint: DEV_HINT }]
    : [];
}
