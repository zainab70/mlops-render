import {
  AlertTriangle,
  CheckCircle2,
  Minus,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { GlassCard } from "@/components/dashboard/GlassCard";
import { MetricsChart } from "@/components/dashboard/MetricsChart";
import type { ApiResult } from "@/lib/api/experiments";
import type { DriftRow, MonitoringData } from "@/lib/api/monitoring";
import {
  aboveThreshold,
  driftRows,
  driftScore,
  hasVolume,
  LEVEL_COLOR,
  level,
  NO_DATA,
  NO_DRIFT,
  NO_VOLUME,
  progressText,
  progressWidth,
  RETRAIN_REASON,
  SEVERITY_CLASS,
  STATISTICS,
  statCards,
  thresholdText,
  volumeRows,
} from "./format";

const TABLE_ID = "drift-table";

const TREND_ICON: Record<string, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

/**
 * The Monitoring page (docs/figma/monitoring.md) drawn from GET /monitoring (API-010): the drift of
 * the scans' statistics against the training reference (PSI per ISO week), prediction volume and
 * errors per day. Every number is the API's; without one the API's reason is shown. The data map
 * and the recorded deviations are in docs/roadmap.md (WEB-010) and the run's decisions.
 */
export function Monitoring({
  monitoring,
}: {
  monitoring: ApiResult<MonitoringData>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Monitoring</h1>
        <p className="text-muted-foreground">
          Track data drift and model performance in real-time
        </p>
      </div>

      {monitoring.kind === "error" ? (
        <div
          role="alert"
          className="glass-card rounded-2xl p-4 text-[var(--status-error)]"
        >
          The monitoring data could not be loaded. {monitoring.message}
        </div>
      ) : (
        <Loaded data={monitoring.data} />
      )}
    </div>
  );
}

function Loaded({ data }: { data: MonitoringData }) {
  const label = data.model?.label ?? null;
  return (
    <>
      <Banner data={data} />

      <div className="space-y-2">
        {label && <DevLabel text={label} />}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MetricsChart
            title="Data Drift Over Time"
            type="area"
            fractions
            rowHeader="Week"
            noteKey="reason"
            data={driftRows(data)}
            dataKeys={data.table.map((row) => ({
              key: row.statistic,
              name: row.statistic,
              color: STATISTICS[row.statistic].color,
            }))}
          />
          {hasVolume(data) ? (
            <MetricsChart
              title="Prediction Volume & Errors"
              type="bar"
              data={volumeRows(data)}
              dataKeys={[
                {
                  key: "predictions",
                  name: "Predictions",
                  color: "var(--ai-blue)",
                },
                { key: "errors", name: "Errors", color: "var(--status-error)" },
              ]}
            />
          ) : (
            <GlassCard aria-labelledby="volume-empty">
              <h3 id="volume-empty" className="text-lg font-semibold mb-4">
                Prediction Volume &amp; Errors
              </h3>
              <p className="text-muted-foreground" data-testid="volume-empty">
                {NO_VOLUME}
              </p>
            </GlassCard>
          )}
        </div>
      </div>

      <DriftTable data={data} label={label} />

      <div className="space-y-2">
        {label && <DevLabel text={label} />}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {statCards(data).map((card) => (
            <GlassCard
              key={card.title}
              hover
              data-testid="monitoring-stat"
              aria-label={card.title}
            >
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  {card.title}
                </p>
                <p
                  className={`text-3xl font-semibold ${card.value === NO_DATA ? "" : (card.color ?? "")}`}
                  data-testid="stat-value"
                >
                  {card.value}
                </p>
                {card.reason && (
                  <p
                    className="text-xs text-muted-foreground mt-1"
                    data-testid="stat-reason"
                  >
                    {card.reason}
                  </p>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </>
  );
}

function DevLabel({ text }: { text: string }) {
  return (
    <p
      data-testid="dev-label"
      className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground inline-block"
    >
      {text}
    </p>
  );
}

function Buttons() {
  return (
    <div>
      <div className="flex gap-3">
        <a
          href={`#${TABLE_ID}`}
          className="px-4 py-2 text-sm rounded-lg transition-colors bg-[var(--status-error)]/20 text-[var(--status-error)] hover:bg-[var(--status-error)]/30"
        >
          View Details
        </a>
        <button
          type="button"
          disabled
          aria-describedby="retrain-reason"
          className="px-4 py-2 text-sm rounded-lg transition-colors bg-accent opacity-60 cursor-not-allowed"
        >
          Trigger Retraining
        </button>
      </div>
      <p id="retrain-reason" className="text-xs text-muted-foreground mt-2">
        {RETRAIN_REASON}
      </p>
    </div>
  );
}

/** The design's alert banner, only when a statistic is above the threshold; otherwise a calm note. */
function Banner({ data }: { data: MonitoringData }) {
  const drifting = aboveThreshold(data);
  if (drifting.length === 0) {
    return (
      <GlassCard data-testid="drift-ok">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-[var(--status-success)]/20">
            <CheckCircle2
              className="w-5 h-5 text-[var(--status-success)]"
              aria-hidden="true"
            />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-3">{NO_DRIFT}</p>
            <Buttons />
          </div>
        </div>
      </GlassCard>
    );
  }
  const names = drifting.map((row) => row.statistic);
  return (
    <GlassCard
      role="alert"
      data-testid="drift-alert"
      className="border-l-4 border-[var(--status-error)]"
    >
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-[var(--status-error)]/20">
          <AlertTriangle
            className="w-5 h-5 text-[var(--status-error)]"
            aria-hidden="true"
          />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold mb-1">High Data Drift Detected</h3>
          <p className="text-sm text-muted-foreground mb-3">
            {names.length === 1 ? "The statistic " : "The statistics "}
            {names.map((name, i) => (
              <span key={name}>
                {i > 0 && ", "}
                <span className="font-medium text-foreground">{name}</span>
              </span>
            ))}
            {names.length === 1 ? " has" : " have"} exceeded the drift
            threshold. Model retraining is recommended.
          </p>
          <Buttons />
        </div>
      </div>
    </GlassCard>
  );
}

function DriftTable({
  data,
  label,
}: {
  data: MonitoringData;
  label: string | null;
}) {
  return (
    <GlassCard id={TABLE_ID} aria-labelledby="drift-table-title">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 id="drift-table-title" className="text-lg font-semibold">
          Feature Drift Analysis
        </h3>
        {label && <DevLabel text={label} />}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {[
                "Feature",
                "Drift Score",
                "Threshold",
                "Trend",
                "Severity",
                "Progress",
              ].map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="text-left py-3 px-4 font-semibold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.table.map((row) => (
              <Row key={row.statistic} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

function Row({ row }: { row: DriftRow }) {
  const colour =
    row.psi === null ? undefined : LEVEL_COLOR[level(row.psi, row.threshold)];
  const Trend = row.trend ? TREND_ICON[row.trend] : null;
  return (
    <tr
      data-testid="drift-row"
      data-statistic={row.statistic}
      className="border-b border-border/50 hover:bg-accent/30 transition-colors"
    >
      <td className="py-4 px-4">
        <span className="font-medium font-mono">{row.statistic}</span>
        <span className="block text-xs text-muted-foreground">
          {STATISTICS[row.statistic].about}
        </span>
      </td>
      <td className="py-4 px-4">
        <span
          className="font-semibold"
          data-testid="drift-score"
          style={colour ? { color: colour } : undefined}
        >
          {driftScore(row.psi)}
        </span>
      </td>
      <td className="py-4 px-4 text-muted-foreground" data-testid="threshold">
        {thresholdText(row.threshold)}
      </td>
      <td className="py-4 px-4">
        <div
          className="flex items-center gap-2 text-muted-foreground"
          data-testid="trend"
        >
          {Trend && <Trend className="w-4 h-4" aria-hidden="true" />}
          <span className="capitalize">{row.trend ?? NO_DATA}</span>
        </div>
      </td>
      <td className="py-4 px-4">
        {row.severity ? (
          <span
            data-testid="severity"
            className={`text-xs px-2 py-1 rounded-full capitalize ${SEVERITY_CLASS[row.severity] ?? "bg-muted"}`}
          >
            {row.severity}
          </span>
        ) : (
          <span data-testid="severity" className="text-muted-foreground">
            {NO_DATA}
          </span>
        )}
      </td>
      <td className="py-4 px-4">
        {row.psi !== null && row.progress !== null ? (
          <div className="flex items-center gap-3" data-testid="progress">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full"
                data-testid="progress-bar"
                style={{
                  width: progressWidth(row.psi, row.threshold),
                  backgroundColor: colour,
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-12">
              {progressText(row.progress)}
            </span>
          </div>
        ) : (
          <span
            className="text-xs text-muted-foreground"
            data-testid="progress"
          >
            {NO_DATA} {row.reason}
          </span>
        )}
      </td>
    </tr>
  );
}
