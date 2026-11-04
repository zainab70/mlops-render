import {
  Activity,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  Target,
  TrendingUp,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type {
  DashboardData,
  DashboardResult,
  HealthResult,
} from "@/lib/api/dashboard";
import type { ApiResult } from "@/lib/api/experiments";
import type { MonitoringData } from "@/lib/api/monitoring";
import {
  driftScore,
  SEVERITY_CLASS,
  STATISTICS,
  thresholdText,
} from "@/components/monitoring/format";
import {
  accuracy,
  count,
  day,
  driftAlerts,
  duration,
  measuredWeek,
  milliseconds,
  NO_DATA,
  NO_DRIFT_ALERTS,
  NO_REQUESTS,
  NOT_AVAILABLE,
  percent,
  weekday,
} from "./format";
import { GlassCard } from "./GlassCard";
import { MetricsChart } from "./MetricsChart";
import { StatsCard } from "./StatsCard";

export const PERFORMANCE_REASON =
  "Production predictions have no ground-truth labels, so accuracy over time cannot be measured yet";

type DashboardProps = {
  dashboard: DashboardResult;
  health: HealthResult;
  monitoring: ApiResult<MonitoringData>;
};

/**
 * The Dashboard (docs/figma/dashboard.md) drawn from the real GET /dashboard (API-005),
 * GET /monitoring (API-010) and GET /health. Every value comes from those answers or is an honest
 * empty state; none of the design's mock numbers is used. The data map is in docs/roadmap.md
 * (WEB-007 notes).
 */
export function Dashboard({ dashboard, health, monitoring }: DashboardProps) {
  const data = dashboard.kind === "ok" ? dashboard.data : null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your ML models in production
        </p>
      </div>

      {dashboard.kind === "error" && (
        <div
          role="alert"
          className="glass-card rounded-2xl p-4 text-[var(--status-error)]"
        >
          The dashboard data could not be loaded. {dashboard.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Stats data={data} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard aria-labelledby="performance-title">
          <h3 id="performance-title" className="text-lg font-semibold mb-4">
            Model Performance Metrics
          </h3>
          <EmptyState reason={PERFORMANCE_REASON} tall />
        </GlassCard>
        {data ? (
          <TrafficChart traffic={data.traffic} />
        ) : (
          <GlassCard aria-labelledby="traffic-title">
            <h3 id="traffic-title" className="text-lg font-semibold mb-4">
              API Traffic &amp; Latency
            </h3>
            <EmptyState reason={dashboardMissing(dashboard)} tall />
          </GlassCard>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentExperiments data={data} />
        <DriftAlerts monitoring={monitoring} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCards data={data} health={health} />
      </div>
    </div>
  );
}

function dashboardMissing(dashboard: DashboardResult): string {
  return dashboard.kind === "error" ? dashboard.message : "";
}

function Stats({ data }: { data: DashboardData | null }) {
  if (!data) {
    const titles: [string, LucideIcon, string][] = [
      ["Model Accuracy", Target, "var(--ai-blue)"],
      ["Active Experiments", TrendingUp, "var(--ai-purple)"],
      ["Models Deployed", Boxes, "var(--status-success)"],
      ["API Uptime", Activity, "var(--status-info)"],
    ];
    return titles.map(([title, icon, color]) => (
      <StatsCard
        key={title}
        title={title}
        value={NO_DATA}
        change="No data from the API"
        icon={icon}
        color={color}
      />
    ));
  }
  const { stats, model, api } = data;
  return (
    <>
      <StatsCard
        title="Model Accuracy"
        {...accuracy(model)}
        icon={Target}
        color="var(--ai-blue)"
      />
      <StatsCard
        title="Active Experiments"
        value={count(stats.experiments_running)}
        change={`${count(stats.experiments_total)} in total`}
        icon={TrendingUp}
        color="var(--ai-purple)"
      />
      <StatsCard
        title="Models Deployed"
        value={count(stats.models_production + stats.models_staging)}
        change={`${count(stats.models_staging)} in staging`}
        icon={Boxes}
        color="var(--status-success)"
      />
      <StatsCard
        title="API Uptime"
        value={duration(api.uptime_seconds)}
        change="since the API started"
        icon={Activity}
        color="var(--status-info)"
      />
    </>
  );
}

function TrafficChart({ traffic }: { traffic: DashboardData["traffic"] }) {
  return (
    <div className="flex flex-col">
      <MetricsChart
        title="API Traffic & Latency"
        type="bar"
        data={traffic.days.map((d) => ({
          name: weekday(d.date),
          requests: d.requests,
        }))}
        dataKeys={[
          { key: "requests", color: "var(--ai-blue)", name: "Requests" },
        ]}
      />
      <p className="text-xs text-muted-foreground mt-2 px-2">
        /predict and /explain requests per day, counted by the API since{" "}
        {day(traffic.since)}; the count restarts when the API restarts.
      </p>
    </div>
  );
}

function CardHeader({
  id,
  title,
  href,
}: {
  id: string;
  title: string;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 id={id} className="text-lg font-semibold">
        {title}
      </h3>
      <Link
        href={href}
        className="text-sm text-[var(--ai-blue)] hover:underline"
      >
        View all
      </Link>
    </div>
  );
}

export function EmptyState({
  reason,
  tall = false,
}: {
  reason: string;
  tall?: boolean;
}) {
  return (
    <div
      className={`p-4 bg-accent/30 rounded-xl flex flex-col items-center justify-center text-center ${tall ? "min-h-[300px]" : ""}`}
    >
      <p className="font-medium mb-1">{NOT_AVAILABLE}</p>
      <p className="text-sm text-muted-foreground">{reason}</p>
    </div>
  );
}

const STATUS_ICON: Record<string, [LucideIcon, string]> = {
  completed: [CheckCircle2, "text-[var(--status-success)]"],
  running: [Clock, "text-[var(--status-warning)]"],
  failed: [XCircle, "text-[var(--status-error)]"],
};

function RecentExperiments({ data }: { data: DashboardData | null }) {
  const rows = data?.recent_experiments ?? [];
  return (
    <GlassCard aria-labelledby="recent-title">
      <CardHeader
        id="recent-title"
        title="Recent Experiments"
        href="/experiments"
      />
      {!data ? (
        <EmptyState reason="No data from the API." />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No experiments yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((exp) => {
            const [Icon, iconColor] =
              STATUS_ICON[exp.status] ?? STATUS_ICON.running;
            return (
              <li
                key={exp.id}
                className="p-4 bg-accent/30 rounded-xl hover:bg-accent/50 transition-colors"
                data-testid="recent-experiment"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium mb-1">{exp.name}</p>
                    <p className="text-sm text-muted-foreground">#{exp.id}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2 mb-1">
                      <Icon
                        className={`w-4 h-4 ${iconColor}`}
                        aria-hidden="true"
                      />
                      <span className="text-sm capitalize">{exp.status}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {day(exp.created_at)}
                    </p>
                  </div>
                </div>
                {exp.accuracy === null ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No accuracy recorded
                  </p>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--ai-blue)] to-[var(--ai-purple)]"
                        style={{ width: percent(exp.accuracy) }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {percent(exp.accuracy)}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}

/**
 * Data Drift Alerts: the high and medium rows of GET /monitoring's drift table, in the design's row
 * style. Severity is written as a word in the pill, so it is not told by colour alone. Without a
 * measured week the API's own reason is shown instead of rows.
 */
function DriftAlerts({
  monitoring,
}: {
  monitoring: ApiResult<MonitoringData>;
}) {
  const data = monitoring.kind === "ok" ? monitoring.data : null;
  const rows = data ? driftAlerts(data) : [];
  return (
    <GlassCard aria-labelledby="drift-title">
      <CardHeader
        id="drift-title"
        title="Data Drift Alerts"
        href="/monitoring"
      />
      {monitoring.kind === "error" ? (
        <EmptyState reason={monitoring.message} />
      ) : data?.stats.reason ? (
        <EmptyState reason={data.stats.reason} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{NO_DRIFT_ALERTS}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const severity = row.severity ?? "";
            // The week this statistic's PSI was measured in, as the API picks it.
            const week = data && measuredWeek(data, row.statistic);
            const [tile, iconColor] =
              SEVERITY_TONE[severity] ?? SEVERITY_TONE.medium;
            return (
              <li
                key={row.statistic}
                className="p-4 bg-accent/30 rounded-xl hover:bg-accent/50 transition-colors"
                data-testid="drift-alert"
                data-statistic={row.statistic}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${tile}`}>
                    <AlertTriangle
                      className={`w-4 h-4 ${iconColor}`}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium mb-1">
                      <span className="font-mono">{row.statistic}</span>{" "}
                      <span className="text-sm text-muted-foreground font-normal">
                        {STATISTICS[row.statistic].about}
                      </span>
                    </p>
                    <p
                      className="text-sm text-muted-foreground"
                      data-testid="drift-alert-score"
                    >
                      Drift detected: PSI {driftScore(row.psi)}, threshold{" "}
                      {thresholdText(row.threshold)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs px-2 py-1 rounded-full capitalize ${SEVERITY_CLASS[severity] ?? "bg-muted"}`}
                      data-testid="drift-alert-severity"
                    >
                      {severity}
                    </span>
                    {week && (
                      <p
                        className="text-sm text-muted-foreground mt-2"
                        data-testid="drift-alert-week"
                      >
                        {week}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}

// The design's icon tile per severity (docs/figma/dashboard.md, Data Drift Alerts).
const SEVERITY_TONE: Record<string, [string, string]> = {
  high: ["bg-[var(--status-error)]/20", "text-[var(--status-error)]"],
  medium: ["bg-[var(--status-warning)]/20", "text-[var(--status-warning)]"],
};

// Whole class names (Tailwind only generates classes it can read in the source).
const TONE = {
  success: ["bg-[var(--status-success)]/20", "text-[var(--status-success)]"],
  blue: ["bg-[var(--ai-blue)]/20", "text-[var(--ai-blue)]"],
  purple: ["bg-[var(--ai-purple)]/20", "text-[var(--ai-purple)]"],
} as const;

function StatusCard({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon: LucideIcon;
  tone: keyof typeof TONE;
  children: ReactNode;
}) {
  const id = `status-${title.toLowerCase().replace(/\s+/g, "-")}`;
  const [tile, iconColor] = TONE[tone];
  return (
    <GlassCard hover aria-labelledby={id}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${tile}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
        </div>
        <h4 id={id} className="font-semibold">
          {title}
        </h4>
      </div>
      <div className="space-y-2">{children}</div>
    </GlassCard>
  );
}

function Row({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <dl className="flex items-center justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`text-sm font-medium ${valueClass}`}>{value}</dd>
    </dl>
  );
}

function Note({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

function StatusCards({
  data,
  health,
}: {
  data: DashboardData | null;
  health: HealthResult;
}) {
  const traffic = data?.traffic;
  // No timings at all yet: the per-minute and latency rows would only show zeros and blanks.
  const noRequests = !traffic || traffic.latency_ms === null;
  const noRequestsText = data ? NO_REQUESTS : "No data from the API";
  return (
    <>
      <StatusCard title="API Health" icon={Zap} tone="success">
        {health.kind === "ok" ? (
          <>
            <Row
              label="Status"
              value="Healthy"
              valueClass="text-[var(--status-success)]"
            />
            <Row label="Response Time" value={milliseconds(health.ms)} />
          </>
        ) : (
          <Row
            label="Status"
            value="Unreachable"
            valueClass="text-[var(--status-error)]"
          />
        )}
        {noRequests ? (
          <Note text={noRequestsText} />
        ) : (
          <Row
            label="Requests/min"
            value={count(traffic.requests_last_minute)}
          />
        )}
      </StatusCard>

      <StatusCard title="Latency" icon={Activity} tone="blue">
        {noRequests || !traffic.latency_ms ? (
          <Note text={noRequestsText} />
        ) : (
          <>
            <Row label="P50" value={milliseconds(traffic.latency_ms.p50)} />
            <Row label="P95" value={milliseconds(traffic.latency_ms.p95)} />
            <Row label="P99" value={milliseconds(traffic.latency_ms.p99)} />
          </>
        )}
      </StatusCard>

      <StatusCard title="Model Serving" icon={Target} tone="purple">
        {noRequests || traffic.success_rate === null ? (
          <Note text={noRequestsText} />
        ) : (
          <>
            <Row
              label="Predictions/min"
              value={count(traffic.predictions_last_minute)}
            />
            <Row label="Success Rate" value={percent(traffic.success_rate)} />
          </>
        )}
        {data && (
          <Row
            label="Active Models"
            value={count(data.stats.models_production)}
          />
        )}
      </StatusCard>
    </>
  );
}
