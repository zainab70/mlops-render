"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "./GlassCard";

export type ChartRow = { name: string } & Record<string, number | string>;
export type DataKey = { key: string; color: string; name: string };

type MetricsChartProps = {
  title: string;
  data: ChartRow[];
  type?: "line" | "area" | "bar";
  dataKeys: DataKey[];
  /** Header of the first column in the text alternative (what a row is). */
  rowHeader?: string;
  /**
   * Values are fractions (0.963): the y axis runs 0–100 % (higher when a value is above 1) and the
   * text alternative shows percents.
   */
  fractions?: boolean;
  /** A row's field with the reason its empty cells have no number, read out in the text alternative. */
  noteKey?: string;
};

const asPercent = (value: unknown) =>
  typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—";

const TOOLTIP_STYLE = {
  backgroundColor: "var(--glass-bg)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  backdropFilter: "blur(20px)",
};

/**
 * The design's MetricsChart (Make MetricsChart.tsx, recorded in docs/figma/dashboard.md): a recharts
 * chart in a GlassCard. Two differences, both recorded: animation is off (stable screenshots), and
 * the same numbers are in a visually hidden table, the chart's text alternative.
 */
export function MetricsChart({
  title,
  data,
  type = "line",
  dataKeys,
  rowHeader = "Day",
  fractions = false,
  noteKey,
}: MetricsChartProps) {
  const id = `chart-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const common = { data, margin: { top: 5, right: 20, left: 0, bottom: 5 } };
  const grid = (
    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
  );
  const axes = [
    <XAxis key="x" dataKey="name" stroke="var(--muted-foreground)" />,
    fractions ? (
      <YAxis
        key="y"
        stroke="var(--muted-foreground)"
        domain={[0, (dataMax: number) => Math.max(1, dataMax)]}
        tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
      />
    ) : (
      <YAxis key="y" stroke="var(--muted-foreground)" allowDecimals={false} />
    ),
  ];
  const tooltip = fractions ? (
    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={asPercent} />
  ) : (
    <Tooltip contentStyle={TOOLTIP_STYLE} />
  );
  // recharts sorts legend items by name; keep the order of dataKeys (the series' ranking).
  const legend = (
    <Legend
      itemSorter={(item) =>
        dataKeys.findIndex((k) => k.key === String(item.dataKey))
      }
    />
  );

  return (
    <GlassCard aria-labelledby={id}>
      <h3 id={id} className="text-lg font-semibold mb-4">
        {title}
      </h3>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={300}>
          {type === "bar" ? (
            <BarChart {...common}>
              {grid}
              {axes}
              {tooltip}
              {legend}
              {dataKeys.map((k) => (
                <Bar
                  key={k.key}
                  dataKey={k.key}
                  fill={k.color}
                  radius={[8, 8, 0, 0]}
                  name={k.name}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          ) : type === "area" ? (
            <AreaChart {...common}>
              <defs>
                {dataKeys.map((k) => (
                  <linearGradient
                    key={k.key}
                    id={`${id}-${k.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={k.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={k.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              {grid}
              {axes}
              {tooltip}
              {legend}
              {dataKeys.map((k) => (
                <Area
                  key={k.key}
                  type="monotone"
                  dataKey={k.key}
                  stroke={k.color}
                  strokeWidth={2}
                  fill={`url(#${id}-${k.key})`}
                  name={k.name}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart {...common}>
              {grid}
              {axes}
              {tooltip}
              {legend}
              {dataKeys.map((k) => (
                <Line
                  key={k.key}
                  type="monotone"
                  dataKey={k.key}
                  stroke={k.color}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name={k.name}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{rowHeader}</th>
            {dataKeys.map((k) => (
              <th key={k.key} scope="col">
                {k.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              {dataKeys.map((k) => (
                <td key={k.key}>
                  {fractions ? asPercent(row[k.key]) : row[k.key]}
                  {noteKey &&
                    typeof row[k.key] !== "number" &&
                    typeof row[noteKey] === "string" &&
                    ` (${row[noteKey]})`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
  );
}
