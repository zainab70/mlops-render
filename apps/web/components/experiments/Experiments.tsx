"use client";

import {
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Play,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/dashboard/GlassCard";
import {
  exportHref,
  isStatus,
  STATUSES,
  type ApiResult,
  type ExperimentDetails,
  type ExperimentRow,
  type ExperimentStatus,
} from "@/lib/api/experiments";
import { ComparisonChart } from "./ComparisonChart";
import {
  ACCURACY_HINT,
  created,
  labels,
  metric,
  METRICS,
  NEW_EXPERIMENT_REASON,
  runDuration,
} from "./format";

type ExperimentsProps = {
  /** GET /experiments with the current filter: the table. */
  list: ApiResult<ExperimentRow[]>;
  /** GET /experiments without a filter: the chart compares all completed runs (null: API error). */
  chartRows: ExperimentRow[] | null;
  status: ExperimentStatus | null;
  /** The row picked by a click or ?id= (SEARCH-002 links), with GET /experiments/{id}. */
  selected: { id: number; details: ApiResult<ExperimentDetails> } | null;
};

/** The page's URL for a filter and a selected row; the server renders the data for it. */
function pageHref(status: ExperimentStatus | null, id: number | null): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (id !== null) params.set("id", String(id));
  const query = params.toString();
  return query ? `/experiments?${query}` : "/experiments";
}

const BUTTON =
  "flex items-center gap-2 px-4 py-2 rounded-xl hover:scale-105 transition-transform";

/**
 * The Experiments page (docs/figma/experiments.md) drawn from GET /experiments (API-006). The filter
 * and the selected row live in the URL, so the server fetches exactly what is shown and a search
 * result link (`?id=`) opens the same view. The data map is in docs/roadmap.md (WEB-008 notes).
 */
export function Experiments({
  list,
  chartRows,
  status,
  selected,
}: ExperimentsProps) {
  const router = useRouter();
  const go = (s: ExperimentStatus | null, id: number | null) =>
    router.push(pageHref(s, id), { scroll: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Experiments</h1>
          <p className="text-muted-foreground">
            Track and compare your ML experiments
          </p>
        </div>
        <div className="flex gap-3">
          <label className={`glass-card ${BUTTON} cursor-pointer`}>
            <Filter className="w-4 h-4" aria-hidden="true" />
            <span className="sr-only">Filter by status</span>
            <select
              value={status ?? ""}
              onChange={(e) =>
                go(isStatus(e.target.value) ? e.target.value : null, null)
              }
              className="bg-transparent outline-none cursor-pointer"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <a
            href={exportHref(status)}
            download
            className={`glass-card ${BUTTON}`}
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Export
          </a>
          <button
            type="button"
            disabled
            title={NEW_EXPERIMENT_REASON}
            aria-describedby="new-experiment-reason"
            className={`${BUTTON} bg-gradient-to-r from-[var(--ai-blue)] to-[var(--ai-purple)] text-white opacity-60 cursor-not-allowed hover:scale-100`}
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            New Experiment
          </button>
          <span id="new-experiment-reason" className="sr-only">
            {NEW_EXPERIMENT_REASON}
          </span>
        </div>
      </div>

      {list.kind === "error" && (
        <div
          role="alert"
          className="glass-card rounded-2xl p-4 text-[var(--status-error)]"
        >
          The experiments could not be loaded. {list.message}
        </div>
      )}

      <ComparisonChart rows={chartRows} />

      <GlassCard aria-label="Experiments table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <Th>Experiment</Th>
                <Th>Status</Th>
                {METRICS.map(([key, name]) => (
                  <Th
                    key={key}
                    hint={key === "accuracy" ? ACCURACY_HINT : undefined}
                  >
                    {name}
                  </Th>
                ))}
                <Th>Duration</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {list.kind === "ok" &&
                list.data.map((row) => (
                  <TableRow
                    key={row.id}
                    row={row}
                    selected={selected?.id === row.id}
                    onSelect={() => go(status, row.id)}
                  />
                ))}
            </tbody>
          </table>
          {list.kind === "ok" && list.data.length === 0 && (
            <p className="py-4 px-4 text-muted-foreground">
              {status ? `No ${status} experiments.` : "No experiments yet."}
            </p>
          )}
        </div>
      </GlassCard>

      {selected && <Details {...selected} />}
    </div>
  );
}

function Th({ children, hint }: { children: string; hint?: string }) {
  return (
    <th scope="col" title={hint} className="text-left py-3 px-4 font-semibold">
      {children}
      {hint && <span className="sr-only"> ({hint})</span>}
    </th>
  );
}

const STATUS_STYLE: Record<string, [LucideIcon, string, string]> = {
  running: [
    Clock,
    "text-[var(--status-warning)]",
    "bg-[var(--status-warning)]/20 text-[var(--status-warning)]",
  ],
  completed: [
    CheckCircle2,
    "text-[var(--status-success)]",
    "bg-[var(--status-success)]/20 text-[var(--status-success)]",
  ],
  failed: [
    XCircle,
    "text-[var(--status-error)]",
    "bg-[var(--status-error)]/20 text-[var(--status-error)]",
  ],
};
const OTHER_STATUS: [LucideIcon, string, string] = [
  Play,
  "text-muted-foreground",
  "bg-muted text-muted-foreground",
];

function TableRow({
  row,
  selected,
  onSelect,
}: {
  row: ExperimentRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const [Icon, iconColor, pill] = STATUS_STYLE[row.status] ?? OTHER_STATUS;
  return (
    <tr
      data-testid="experiment-row"
      aria-current={selected ? "true" : undefined}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`border-b border-border/50 hover:bg-accent/30 cursor-pointer transition-colors ${selected ? "bg-accent/50" : ""}`}
    >
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <p className="font-medium">{row.name}</p>
          {labels(row).map((l) => (
            <span
              key={l.text}
              title={l.hint}
              data-testid="experiment-label"
              className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              {l.text}
            </span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">#{row.id}</p>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconColor}`} aria-hidden="true" />
          <span className={`text-xs px-2 py-1 rounded-full capitalize ${pill}`}>
            {row.status}
          </span>
        </div>
      </td>
      {METRICS.map(([key]) => (
        <td key={key} className="py-4 px-4">
          <span className="font-medium">{metric(row, key, 1)}</span>
        </td>
      ))}
      <td className="py-4 px-4 text-muted-foreground">
        {runDuration(row.duration_seconds)}
      </td>
      <td className="py-4 px-4 text-muted-foreground">
        {created(row.created_at)}
      </td>
    </tr>
  );
}

function Details({
  id,
  details,
}: {
  id: number;
  details: ApiResult<ExperimentDetails>;
}) {
  if (details.kind === "error") {
    return (
      <GlassCard aria-labelledby="details-title">
        <h3 id="details-title" className="text-lg font-semibold mb-4">
          Experiment Details: #{id}
        </h3>
        <p role="alert" className="text-[var(--status-error)]">
          {details.message}
        </p>
      </GlassCard>
    );
  }
  const run = details.data;
  // The recorded settings; seed (demo) rows have none, only their epoch count.
  const parameters = Object.entries({
    epochs: run.epochs,
    ...(run.model_version ? { model_version: run.model_version } : {}),
    ...run.parameters,
  });
  return (
    <GlassCard aria-labelledby="details-title">
      <h3 id="details-title" className="text-lg font-semibold mb-4">
        Experiment Details: {run.name}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section aria-labelledby="parameters-title">
          <h4 id="parameters-title" className="font-semibold mb-3">
            Parameters
          </h4>
          <dl className="space-y-2">
            {parameters.map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between p-3 bg-accent/30 rounded-lg"
              >
                <dt className="text-sm text-muted-foreground">{key}</dt>
                <dd className="text-sm font-medium break-all text-right">
                  {String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="metrics-title">
          <h4 id="metrics-title" className="font-semibold mb-3">
            Metrics
          </h4>
          <ul className="space-y-2">
            {METRICS.map(([key, name]) => {
              const value = run[key];
              return (
                <li
                  key={key}
                  data-testid="metric"
                  className="p-3 bg-accent/30 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground capitalize">
                      {name}
                    </span>
                    <span
                      data-testid="metric-value"
                      className="text-sm font-medium"
                    >
                      {metric(run, key, 2)}
                    </span>
                  </div>
                  {run.status !== "failed" && value !== null && (
                    <div
                      data-testid="metric-bar"
                      className="w-full h-2 bg-muted rounded-full overflow-hidden"
                    >
                      <div
                        className="h-full bg-gradient-to-r from-[var(--ai-blue)] to-[var(--ai-purple)]"
                        style={{ width: `${value * 100}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </GlassCard>
  );
}
