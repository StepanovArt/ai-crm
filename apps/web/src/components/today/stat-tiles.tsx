import { AlertTriangle, Scale, Trophy, Wallet } from "lucide-react";

import { formatMoney } from "@/lib/format";
import type { Today } from "@/hooks/use-today";
import { cn } from "@/lib/utils";

function Tile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  agentId,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Wallet;
  tone?: "warning";
  agentId: string;
}) {
  return (
    <div className="rounded-xl border bg-surface px-4 py-3.5" data-agent-id={agentId}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {label}
        <Icon
          className={cn(
            "size-3.5",
            tone === "warning" ? "text-amber-500" : "text-muted-foreground/70",
          )}
        />
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function StatTiles({ stats, dealsLabel }: { stats: Today["stats"]; dealsLabel: string }) {
  const c = stats.currency;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Open pipeline"
        value={formatMoney(stats.open_value, c, { compact: true })}
        hint={`${stats.open_count} open ${dealsLabel.toLowerCase()}`}
        icon={Wallet}
        agentId="stat-open-pipeline"
      />
      <Tile
        label="Weighted forecast"
        value={formatMoney(stats.weighted_value, c, { compact: true })}
        hint="Value × stage probability"
        icon={Scale}
        agentId="stat-weighted"
      />
      <Tile
        label="Won this month"
        value={formatMoney(stats.won_this_month_value, c, { compact: true })}
        hint={`${stats.won_this_month_count} closed won`}
        icon={Trophy}
        agentId="stat-won"
      />
      <Tile
        label="Needs attention"
        value={String(stats.stale_count)}
        hint="Open, no activity in 7+ days"
        icon={AlertTriangle}
        tone={stats.stale_count ? "warning" : undefined}
        agentId="stat-stale"
      />
    </div>
  );
}
