import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Globe,
  Rocket,
  Server,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/dashboard/GlassCard";
import { MetricsChart } from "@/components/dashboard/MetricsChart";
import type { DeploymentEntry, DeploymentsData } from "@/lib/api/deployments";
import type { ApiResult } from "@/lib/api/experiments";
import {
  card,
  DEGRADED_WARNING,
  DEMO_HINT,
  DEMO_LABEL,
  latencyRows,
  NEW_DEPLOYMENT_REASON,
  type Shown,
  statCards,
  throughputRows,
} from "./format";
import { ScrollToHighlighted } from "./ScrollToHighlighted";

// The design's icon per stats card: a /20 tinted box and the icon in the same colour.
const STAT_STYLE: { icon: LucideIcon; box: string; text: string }[] = [
  {
    icon: CheckCircle2,
    box: "bg-[var(--status-success)]/20",
    text: "text-[var(--status-success)]",
  },
  {
    icon: Activity,
    box: "bg-[var(--ai-blue)]/20",
    text: "text-[var(--ai-blue)]",
  },
  {
    icon: Clock,
    box: "bg-[var(--ai-purple)]/20",
    text: "text-[var(--ai-purple)]",
  },
  {
    icon: Zap,
    box: "bg-[var(--status-success)]/20",
    text: "text-[var(--status-success)]",
  },
];

const STATUS: Record<string, { className: string; icon: LucideIcon }> = {
  healthy: {
    className: "bg-[var(--status-success)]/20 text-[var(--status-success)]",
    icon: CheckCircle2,
  },
  degraded: {
    className: "bg-[var(--status-warning)]/20 text-[var(--status-warning)]",
    icon: AlertCircle,
  },
  down: {
    className: "bg-[var(--status-error)]/20 text-[var(--status-error)]",
    icon: AlertCircle,
  },
};

/**
 * The Deployments page (docs/figma/deployments.md) drawn from GET /deployments (API-011): this API
 * service as the one real deployment (numbers from the stored answers), then the seeded demo rows.
 * Every number is the API's; without one, "—" with the API's reason. The recorded deviations are in
 * the WEB-011 run's decisions. `highlightedId` (`?id=`, a SEARCH-002 result link) outlines that
 * deployment's card and scrolls to it; the live API card has no id, so it is never highlighted.
 */
export function Deployments({
  deployments,
  highlightedId = null,
}: {
  deployments: ApiResult<DeploymentsData>;
  highlightedId?: number | null;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Deployments</h1>
          <p className="text-muted-foreground">
            Monitor API health, latency, and uptime
          </p>
        </div>
        <div className="text-right">
          <button
            type="button"
            disabled
            aria-describedby="new-deployment-reason"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[var(--ai-blue)] to-[var(--ai-purple)] text-white opacity-60 cursor-not-allowed"
          >
            <Rocket className="w-4 h-4" aria-hidden="true" />
            New Deployment
          </button>
          <p
            id="new-deployment-reason"
            className="text-xs text-muted-foreground mt-1 max-w-xs"
          >
            {NEW_DEPLOYMENT_REASON}
          </p>
        </div>
      </div>

      {deployments.kind === "error" ? (
        <div
          role="alert"
          className="glass-card rounded-2xl p-4 text-[var(--status-error)]"
        >
          The deployments could not be loaded. {deployments.message}
        </div>
      ) : (
        <Loaded data={deployments.data} highlightedId={highlightedId} />
      )}
    </div>
  );
}

function Loaded({
  data,
  highlightedId,
}: {
  data: DeploymentsData;
  highlightedId: number | null;
}) {
  const isHighlighted = (entry: DeploymentEntry) =>
    entry.id !== null && entry.id === highlightedId;
  const found = data.deployments.some(isHighlighted);
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {statCards(data).map((stat, i) => {
          const { icon: Icon, box, text } = STAT_STYLE[i];
          return (
            <GlassCard
              key={stat.title}
              hover
              data-testid="deployment-stat"
              aria-label={stat.title}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${box}`}>
                  <Icon className={`w-5 h-5 ${text}`} aria-hidden="true" />
                </div>
                <h4 className="font-semibold">{stat.title}</h4>
              </div>
              <p className="text-3xl font-semibold" data-testid="stat-value">
                {stat.text}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {stat.reason ?? stat.caption}
              </p>
            </GlassCard>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.latency.reason ? (
          <EmptyChart title="API Latency (ms)" reason={data.latency.reason} />
        ) : (
          <MetricsChart
            title="API Latency (ms)"
            type="line"
            rowHeader="Hour (UTC)"
            noteKey="note"
            data={latencyRows(data)}
            dataKeys={[
              { key: "p50", name: "P50", color: "var(--status-success)" },
              { key: "p95", name: "P95", color: "var(--status-warning)" },
              { key: "p99", name: "P99", color: "var(--status-error)" },
            ]}
          />
        )}
        {data.throughput.reason ? (
          <EmptyChart
            title="Request Throughput"
            reason={data.throughput.reason}
          />
        ) : (
          <MetricsChart
            title="Request Throughput"
            type="area"
            data={throughputRows(data)}
            dataKeys={[
              { key: "requests", name: "Requests", color: "var(--ai-blue)" },
            ]}
          />
        )}
      </div>

      <div className="space-y-4">
        {data.deployments.map((entry) => (
          <DeploymentCard
            key={`${entry.source}-${entry.name}`}
            entry={entry}
            highlighted={isHighlighted(entry)}
          />
        ))}
      </div>
      {found && highlightedId !== null && (
        <ScrollToHighlighted id={highlightedId} />
      )}
    </>
  );
}

function EmptyChart({ title, reason }: { title: string; reason: string }) {
  const id = `empty-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <GlassCard aria-labelledby={id} data-testid="chart-empty">
      <h3 id={id} className="text-lg font-semibold mb-4">
        {title}
      </h3>
      <p className="text-muted-foreground">No data: {reason}</p>
    </GlassCard>
  );
}

/** A value, or "—" with the API's reason next to it. */
function Value({ value, testId }: { value: Shown; testId: string }) {
  return (
    <span data-testid={testId}>
      {value.text}
      {value.reason && (
        <>
          {" "}
          <span className="text-xs text-muted-foreground">
            ({value.reason})
          </span>
        </>
      )}
    </span>
  );
}

function DeploymentCard({
  entry,
  highlighted,
}: {
  entry: DeploymentEntry;
  highlighted: boolean;
}) {
  const shown = card(entry);
  const status = STATUS[entry.status];
  const StatusIcon = status?.icon;
  const headingId = `deployment-${entry.source}-${entry.id ?? "live"}`;
  return (
    <GlassCard
      aria-labelledby={headingId}
      aria-current={highlighted ? "true" : undefined}
      data-testid="deployment-card"
      data-source={entry.source}
      data-deployment-id={entry.id ?? undefined}
      className={highlighted ? "ring-2 ring-[var(--ai-blue)]" : ""}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="p-3 rounded-xl bg-gradient-to-br from-[var(--ai-blue)] to-[var(--ai-purple)]">
            <Rocket className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h3 id={headingId} className="text-xl font-semibold">
                {entry.name}
              </h3>
              <span
                data-testid="deployment-status"
                className={`text-xs px-2 py-1 rounded-full capitalize flex items-center gap-1 ${status?.className ?? "bg-muted"}`}
              >
                {StatusIcon && (
                  <StatusIcon className="w-3 h-3" aria-hidden="true" />
                )}
                {entry.status}
              </span>
              {entry.source === "demo" && (
                <span
                  data-testid="demo-label"
                  title={DEMO_HINT}
                  className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                >
                  {DEMO_LABEL}
                  <span className="sr-only"> ({DEMO_HINT})</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Globe className="w-4 h-4" aria-hidden="true" />
                <Value value={shown.region} testId="deployment-region" />
              </span>
              <span className="flex items-center gap-1">
                <Server className="w-4 h-4" aria-hidden="true" />
                <Value value={shown.replicas} testId="deployment-replicas" />
              </span>
              <span className="font-mono">
                <Value value={shown.version} testId="deployment-version" />
              </span>
            </div>
          </div>
        </div>
        <Details entry={entry} />
      </div>

      <div className="p-3 bg-accent/20 rounded-lg mb-4">
        <p className="text-sm text-muted-foreground mb-1">Endpoint</p>
        <code className="text-sm font-mono">
          <Value value={shown.endpoint} testId="deployment-endpoint" />
        </code>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(
          [
            ["Uptime", shown.uptime, "metric-uptime"],
            ["Requests", shown.requests, "metric-requests"],
            ["P50 Latency", shown.p50, "metric-p50"],
            ["P95 Latency", shown.p95, "metric-p95"],
            ["P99 Latency", shown.p99, "metric-p99"],
          ] as const
        ).map(([label, value, testId]) => (
          <div key={label} className="p-3 bg-accent/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-lg font-semibold" data-testid={testId}>
              {value.text}
            </p>
            {value.reason && (
              <p className="text-xs text-muted-foreground">{value.reason}</p>
            )}
          </div>
        ))}
      </div>

      {entry.status === "degraded" && (
        <div
          data-testid="degraded-warning"
          className="mt-4 p-3 bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/30 rounded-lg"
        >
          <p className="text-sm text-[var(--status-warning)]">
            {DEGRADED_WARNING}
          </p>
        </div>
      )}
    </GlassCard>
  );
}

/** Details opens the version this deployment serves; without one, disabled with the API's reason. */
function Details({ entry }: { entry: DeploymentEntry }) {
  const className =
    "px-4 py-2 text-sm rounded-lg bg-accent hover:bg-accent/70 transition-colors shrink-0";
  if (entry.version_id !== null) {
    return (
      <Link
        href={`/models?id=${entry.version_id}`}
        className={className}
        aria-label={`Details of ${entry.name}`}
      >
        Details
      </Link>
    );
  }
  const reason = entry.reasons.version_id ?? "no version to open";
  const reasonId = `details-reason-${entry.source}-${entry.id ?? "live"}`;
  return (
    <div className="text-right shrink-0">
      <button
        type="button"
        disabled
        aria-label={`Details of ${entry.name}`}
        aria-describedby={reasonId}
        className={`${className} opacity-60 cursor-not-allowed hover:bg-accent`}
      >
        Details
      </button>
      <p
        id={reasonId}
        className="text-xs text-muted-foreground mt-1 max-w-[12rem]"
      >
        {reason}
      </p>
    </div>
  );
}
