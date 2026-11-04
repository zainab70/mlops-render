"use client";

import { AlertTriangle } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { analyzeScan, formatConfidence, type Prediction } from "@/lib/api/scan";
import { classDisplayName, type ModelTask } from "@/lib/api/task";

type Result = { prediction: Prediction; heatmapUrl: string };

/**
 * Upload one scan → the predicted class, the confidence, the Grad-CAM heat-map and the
 * demo notice (WEB-006). The API checks the file (PNG or JPEG, at most 10 MB); this form
 * only shows what it answers. A new upload clears the previous result first. The class is
 * shown by the served task's display name (WEB-013); without a task, by the API's name.
 */
export function ScanForm({ task = null }: { task?: ModelTask | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  // The heat-map lives in an object URL; free it when it is replaced or the page closes.
  useEffect(() => {
    const url = result?.heatmapUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [result]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("file");
    const file =
      input instanceof HTMLInputElement ? input.files?.[0] : undefined;
    setResult(null);
    setError(null);
    if (!file || file.size === 0) {
      setError("Choose a PNG or JPEG scan first.");
      return;
    }
    setBusy(true);
    const outcome = await analyzeScan(file);
    if (outcome.kind === "ok") {
      setResult({
        prediction: outcome.prediction,
        heatmapUrl: URL.createObjectURL(outcome.heatmap),
      });
    } else {
      setError(outcome.message);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="glass-card rounded-2xl p-6 space-y-4"
        aria-label="Analyze a scan"
        noValidate
      >
        <div className="space-y-1">
          <label htmlFor="scan-file" className="text-sm font-medium">
            Scan image (PNG or JPEG, up to 10 MB)
          </label>
          <input
            id="scan-file"
            name="file"
            type="file"
            accept="image/png,image/jpeg"
            className="block w-full text-sm text-muted-foreground file:mr-4 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-accent file:text-foreground"
          />
        </div>
        {error && (
          <p
            role="alert"
            className="text-sm text-[var(--status-error)] bg-[var(--status-error)]/10 rounded-xl px-4 py-2"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--ai-blue)] to-[var(--ai-purple)] text-white hover:scale-[1.02] transition-transform disabled:opacity-60"
        >
          {busy ? "Analyzing…" : "Analyze scan"}
        </button>
      </form>

      <section
        role="status"
        aria-label="Result"
        aria-busy={busy}
        className={result ? "glass-card rounded-2xl p-6" : undefined}
      >
        {result && (
          <ResultView
            {...result}
            classLabel={classDisplayName(task, result.prediction.class)}
          />
        )}
      </section>
    </div>
  );
}

function ResultView({
  prediction,
  heatmapUrl,
  classLabel,
}: Result & { classLabel: string }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Result</h2>
        <dl className="space-y-3">
          <div>
            <dt className="text-sm text-muted-foreground">Predicted class</dt>
            <dd className="text-2xl font-semibold" data-testid="scan-class">
              {classLabel}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Confidence</dt>
            <dd
              className="text-2xl font-semibold"
              data-testid="scan-confidence"
            >
              {formatConfidence(prediction.confidence)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Model</dt>
            <dd className="text-sm">{prediction.model_version}</dd>
          </div>
        </dl>
        <p className="flex items-start gap-2 text-sm text-[var(--status-warning)] bg-[var(--status-warning)]/10 rounded-xl px-4 py-2">
          <AlertTriangle
            className="w-4 h-4 mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <span>{prediction.notice}</span>
        </p>
      </div>
      <figure className="space-y-2">
        {/* An object URL from /api/explain: nothing to optimise, so `unoptimized`. */}
        <Image
          src={heatmapUrl}
          alt={`Grad-CAM heat-map: where the model looked for “${classLabel}”`}
          width={512}
          height={512}
          unoptimized
          className="w-full h-auto max-w-md rounded-xl border border-border"
        />
        <figcaption className="text-xs text-muted-foreground">
          Grad-CAM heat-map over the scan: warmer colours mark the regions that
          most influenced the predicted class.
        </figcaption>
      </figure>
    </div>
  );
}
