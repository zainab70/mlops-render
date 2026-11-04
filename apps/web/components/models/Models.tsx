"use client";

import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  GitBranch,
  Package,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GlassCard } from "@/components/dashboard/GlassCard";
import type { ApiResult } from "@/lib/api/experiments";
import {
  promoteVersion,
  type ModelEntry,
  type ModelVersion,
  type Registry,
} from "@/lib/api/models";
import {
  ACCURACY_HINT,
  AVG_ACCURACY_HINT,
  averageAccuracy,
  deployed,
  hasTrafficBar,
  modelLabels,
  modelSize,
  REGISTER_REASON,
  SIZE_HINT,
  traffic,
  versionAccuracy,
  versionLabels,
} from "./format";

type ModelsProps = {
  /** GET /models (API-007): the cards, the versions and the quick stats. */
  registry: ApiResult<Registry>;
  /** The version picked by ?id= (SEARCH-002 links), highlighted. */
  highlightedId: number | null;
};

/**
 * The Models page (docs/figma/models.md) drawn from GET /models. Promote calls API-008 through the
 * Next /api proxy and then refreshes the server render, so stages and stats come from the API again.
 * The data map is in docs/roadmap.md (WEB-009 notes).
 */
export function Models({ registry, highlightedId }: ModelsProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Models</h1>
          <p className="text-muted-foreground">
            Manage your model versions and deployments
          </p>
        </div>
        <button
          type="button"
          disabled
          title={REGISTER_REASON}
          aria-describedby="register-reason"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--ai-blue)] to-[var(--ai-purple)] text-white opacity-60 cursor-not-allowed"
        >
          <Package className="w-4 h-4" aria-hidden="true" />
          Register Model
        </button>
        <span id="register-reason" className="sr-only">
          {REGISTER_REASON}
        </span>
      </div>

      {registry.kind === "error" ? (
        <div
          role="alert"
          className="glass-card rounded-2xl p-4 text-[var(--status-error)]"
        >
          The models could not be loaded. {registry.message}
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {registry.data.models.map((model) => (
              <ModelCard
                key={model.name}
                model={model}
                highlightedId={highlightedId}
              />
            ))}
            {registry.data.models.length === 0 && (
              <GlassCard>
                <p className="text-muted-foreground">
                  No models yet. Recording a training run registers its version.
                </p>
              </GlassCard>
            )}
          </div>
          <QuickStats stats={registry.data.stats} />
        </>
      )}
    </div>
  );
}

function Label({ text, hint }: { text: string; hint: string }) {
  return (
    <span
      title={hint}
      data-testid="model-label"
      className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
    >
      {text}
      <span className="sr-only"> ({hint})</span>
    </span>
  );
}

function ModelCard({
  model,
  highlightedId,
}: {
  model: ModelEntry;
  highlightedId: number | null;
}) {
  const headingId = `model-${model.name}`;
  return (
    <GlassCard aria-labelledby={headingId} data-testid="model-card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-[var(--ai-blue)] to-[var(--ai-purple)]">
            <Package className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 id={headingId} className="text-xl font-semibold">
                {model.name}
              </h3>
              {modelLabels(model).map((l) => (
                <Label key={l.text} {...l} />
              ))}
            </div>
            <p
              data-testid="model-description"
              className="text-sm text-muted-foreground mb-2"
            >
              {model.description ?? "No description recorded."}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <Field label="Framework" value={model.framework} />
              <Field label="Size" value={modelSize(model)} hint={SIZE_HINT} />
              <Field label="ID" value={model.name} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <GitBranch className="w-4 h-4" aria-hidden="true" />
          Versions
        </h4>
        <ul className="space-y-3">
          {model.versions.map((version) => (
            <VersionRow
              key={version.id}
              version={version}
              highlighted={version.id === highlightedId}
            />
          ))}
        </ul>
      </div>
    </GlassCard>
  );
}

function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <span className="text-muted-foreground" title={hint}>
      {label}:{" "}
      <span
        data-testid={`model-${label.toLowerCase()}`}
        className="text-foreground font-medium"
      >
        {value}
      </span>
    </span>
  );
}

const STAGE_STYLE: Record<string, [LucideIcon | null, string]> = {
  production: [
    CheckCircle2,
    "bg-[var(--status-success)]/20 text-[var(--status-success)]",
  ],
  staging: [
    Clock,
    "bg-[var(--status-warning)]/20 text-[var(--status-warning)]",
  ],
  archived: [AlertCircle, "bg-muted text-muted-foreground"],
};
const OTHER_STAGE: [LucideIcon | null, string] = [
  null,
  "bg-muted text-muted-foreground",
];

function VersionRow({
  version,
  highlighted,
}: {
  version: ModelVersion;
  highlighted: boolean;
}) {
  const [Icon, pill] = STAGE_STYLE[version.stage] ?? OTHER_STAGE;
  // Kept here, not in PromoteButton: after a failed Promote the refresh can turn the version into
  // production/archived, which removes the button, and its message must stay visible.
  const [promoteError, setPromoteError] = useState<string | null>(null);
  return (
    <li
      data-testid="model-version"
      data-version-id={version.id}
      aria-current={highlighted ? "true" : undefined}
      className={`p-4 bg-accent/30 rounded-xl hover:bg-accent/50 transition-colors ${highlighted ? "ring-2 ring-[var(--ai-blue)]" : ""}`}
    >
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
        <div className="md:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <span
              data-testid="version-name"
              className="font-mono font-semibold break-all"
            >
              {version.version}
            </span>
            <span
              data-testid="version-stage"
              className={`text-xs px-2 py-1 rounded-full capitalize flex items-center gap-1 ${pill}`}
            >
              {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
              {version.stage}
            </span>
            {versionLabels(version).map((l) => (
              <Label key={l.text} {...l} />
            ))}
          </div>
        </div>
        <Cell
          label="Accuracy"
          value={versionAccuracy(version)}
          hint={ACCURACY_HINT}
        />
        <Cell label="Traffic" value={traffic(version)} />
        <Cell label="Deployed" value={deployed(version)} />
        <div className="md:col-span-1 flex items-center justify-end gap-2">
          {version.stage === "staging" && (
            <PromoteButton version={version} onResult={setPromoteError} />
          )}
          {version.stage === "production" && version.experiment_id !== null && (
            <Link
              href={`/experiments?id=${version.experiment_id}`}
              aria-label={`Open the experiment of ${version.version}`}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors"
            >
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      {promoteError && (
        <p
          role="alert"
          className="mt-2 text-right text-xs text-[var(--status-error)]"
        >
          Promote failed: {promoteError}
        </p>
      )}

      {hasTrafficBar(version) && (
        <div className="mt-3" data-testid="traffic-bar">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Traffic Distribution</span>
            <span>{traffic(version)}</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--ai-blue)] to-[var(--ai-purple)]"
              style={{ width: `${version.traffic}%` }}
            />
          </div>
        </div>
      )}
    </li>
  );
}

function Cell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="md:col-span-1" title={hint}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        data-testid={`version-${label.toLowerCase()}`}
        className="font-semibold"
      >
        {value}
      </p>
    </div>
  );
}

function PromoteButton({
  version,
  onResult,
}: {
  version: ModelVersion;
  /** The API's message on failure, null on success (the row shows it). */
  onResult: (error: string | null) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function promote() {
    setPending(true);
    onResult(null);
    const result = await promoteVersion(version.id);
    setPending(false);
    onResult(result.kind === "error" ? result.message : null);
    // Success or not, render again from the API, so the stages shown are the API's.
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={promote}
      disabled={pending}
      aria-label={`Promote ${version.version}`}
      className="px-3 py-1.5 text-sm rounded-lg bg-[var(--status-success)]/20 text-[var(--status-success)] hover:bg-[var(--status-success)]/30 transition-colors disabled:opacity-60"
    >
      {pending ? "Promoting…" : "Promote"}
    </button>
  );
}

function QuickStats({ stats }: { stats: Registry["stats"] }) {
  const average = averageAccuracy(stats);
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Stat label="Total Models" value={String(stats.total_models)} />
      <Stat
        label="In Production"
        value={String(stats.in_production)}
        valueClass="text-[var(--status-success)]"
      />
      <Stat
        label="In Staging"
        value={String(stats.in_staging)}
        valueClass="text-[var(--status-warning)]"
      />
      <Stat
        label="Avg Accuracy"
        value={average.value}
        hint={AVG_ACCURACY_HINT}
        reason={average.reason}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass = "",
  hint,
  reason = null,
}: {
  label: string;
  value: string;
  valueClass?: string;
  hint?: string;
  reason?: string | null;
}) {
  return (
    <GlassCard hover aria-label={label} data-testid="model-stat">
      <div className="text-center" title={hint}>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p
          data-testid="stat-value"
          className={`text-3xl font-semibold ${valueClass}`}
        >
          {value}
        </p>
        {reason && (
          <p
            data-testid="stat-reason"
            className="text-xs text-muted-foreground mt-1"
          >
            {reason}
          </p>
        )}
      </div>
    </GlassCard>
  );
}
