/**
 * What the served model classifies: the `task` of GET /model (ML-006, services/api/predict.py).
 * The web app names no disease of its own (WEB-013): the Scan page and the site description show
 * this task, so a model for another disease needs no web change.
 */
import { apiUrl, SESSION_COOKIE } from "./config";

/** GET /model `task`. Field names are the API's. */
export type ModelTask = {
  title: string;
  modality: string;
  channels: number;
  /** class name → display name, e.g. "Very_Mild" → "Very mild" */
  class_labels: Record<string, string>;
};

/** Shown instead of a task when there is no model (503) or the API cannot be reached. */
export const NEUTRAL_TITLE = "image classifier";

/** GET /model on the server, with the session cookie. Never throws: null means "no task to show". */
export async function getModelTask(
  sessionToken: string | undefined,
): Promise<ModelTask | null> {
  if (!sessionToken) return null;
  try {
    const response = await fetch(`${apiUrl()}/model`, {
      headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { task?: ModelTask };
    return body.task ?? null;
  } catch {
    return null;
  }
}

/** The `<meta name="description">` text of every page. */
export function siteDescription(task: ModelTask | null): string {
  return `Research and decision-support demo (${task?.title ?? NEUTRAL_TITLE}) with Grad-CAM explanations.`;
}

/** A predicted class as people read it; the API's own name when the task has no label for it. */
export function classDisplayName(
  task: ModelTask | null,
  className: string,
): string {
  return task?.class_labels[className] ?? className;
}
