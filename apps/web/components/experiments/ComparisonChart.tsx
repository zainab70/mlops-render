"use client";

import { EmptyState } from "@/components/dashboard/Dashboard";
import { GlassCard } from "@/components/dashboard/GlassCard";
import {
  MetricsChart,
  type ChartRow,
} from "@/components/dashboard/MetricsChart";
import type { ExperimentRow } from "@/lib/api/experiments";
import { CHART_EMPTY_REASON, CHART_TITLE, METRICS, topThree } from "./format";

// The design's colours for the 1st, 2nd and 3rd experiment (docs/figma/experiments.md).
const COLORS = ["var(--ai-blue)", "var(--ai-purple)", "var(--status-success)"];

/**
 * "Top 3 Experiments Comparison": one bar group per metric, one bar per run, for the 3 completed runs
 * with the highest accuracy in the rows it gets. With no completed run it says so instead.
 */
export function ComparisonChart({ rows }: { rows: ExperimentRow[] | null }) {
  const top = rows === null ? [] : topThree(rows);
  if (top.length === 0) {
    return (
      <GlassCard aria-labelledby="comparison-title">
        <h3 id="comparison-title" className="text-lg font-semibold mb-4">
          {CHART_TITLE}
        </h3>
        <EmptyState
          reason={rows === null ? "No data from the API." : CHART_EMPTY_REASON}
          tall
        />
      </GlassCard>
    );
  }
  const data: ChartRow[] = METRICS.map(([key, name]) => {
    const row: ChartRow = { name };
    for (const run of top) {
      // A missing value is left out: recharts draws no bar, the text alternative says "—".
      if (run[key] !== null) row[`exp-${run.id}`] = run[key];
    }
    return row;
  });
  return (
    <MetricsChart
      title={CHART_TITLE}
      type="bar"
      data={data}
      dataKeys={top.map((run, i) => ({
        key: `exp-${run.id}`,
        color: COLORS[i],
        name: run.name,
      }))}
      rowHeader="Metric"
      fractions
    />
  );
}
