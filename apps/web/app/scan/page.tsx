import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ScanForm } from "@/components/scan/ScanForm";
import { SESSION_COOKIE } from "@/lib/api/config";
import { getModelTask, NEUTRAL_TITLE } from "@/lib/api/task";

export const metadata: Metadata = { title: "Scan" };

/**
 * Scan (route `/scan`, WEB-006). No Figma frame (design decision, docs/roadmap.md#web-006):
 * the shell + .glass-card. The scan goes to FastAPI through the /api proxy; the model and
 * Grad-CAM run there, never in the web app. The text names the served model's task from
 * GET /model (WEB-013), so this page names no disease of its own.
 */
export default async function ScanPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const task = await getModelTask(token);
  const image = task ? `one ${task.modality} image` : "one image";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Scan</h1>
        <p className="text-lg font-medium mb-1" data-testid="scan-task">
          {task?.title ?? NEUTRAL_TITLE}
        </p>
        <p className="text-muted-foreground">
          Upload {image} to see the model&apos;s predicted class, its confidence
          and a Grad-CAM heat-map of where it looked.
        </p>
      </div>
      <ScanForm task={task} />
    </div>
  );
}
