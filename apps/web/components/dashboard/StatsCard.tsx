import type { LucideIcon } from "lucide-react";
import { GlassCard } from "./GlassCard";

export type ChangeType = "positive" | "negative" | "neutral";

const CHANGE_COLOR: Record<ChangeType, string> = {
  positive: "text-[var(--status-success)]",
  negative: "text-[var(--status-error)]",
  neutral: "text-muted-foreground",
};

type StatsCardProps = {
  title: string;
  value: string;
  change: string;
  changeType?: ChangeType;
  icon: LucideIcon;
  /** Background of the icon tile, a CSS colour such as "var(--ai-blue)". */
  color: string;
};

/** The design's StatsCard (docs/figma/dashboard.md): title, big value, change line, icon tile. */
export function StatsCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  color,
}: StatsCardProps) {
  const id = `stat-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <GlassCard hover aria-labelledby={id}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={id} className="text-sm text-muted-foreground mb-1">
            {title}
          </h2>
          <p className="text-3xl font-semibold mb-2" data-testid="stat-value">
            {value}
          </p>
          <p
            className={`text-sm ${CHANGE_COLOR[changeType]}`}
            data-testid="stat-change"
          >
            {change}
          </p>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: color }}
        >
          <Icon className="w-6 h-6 text-white" aria-hidden="true" />
        </div>
      </div>
    </GlassCard>
  );
}
