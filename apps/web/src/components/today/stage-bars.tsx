"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Today } from "@/hooks/use-today";
import { formatMoney } from "@/lib/format";

/** Single-series horizontal bars: open value per stage (one hue, value at the tip). */
export function StageBars({ stages, currency }: { stages: Today["stages"]; currency: string }) {
  const open = stages.filter((s) => s.kind === "open");
  const max = Math.max(1, ...open.map((s) => Number(s.value)));
  return (
    <ul className="space-y-2.5" aria-label="Open value by stage">
      {open.map((s) => {
        const pct = (Number(s.value) / max) * 100;
        return (
          <li
            key={s.stage_id}
            className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3 text-[13px]"
          >
            <span className="truncate text-muted-foreground">{s.name}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-6 cursor-default items-center gap-2">
                  <div
                    className="h-3.5 rounded-r-[4px] bg-indigo-500/85 transition-[width] duration-500 dark:bg-indigo-400/85"
                    style={{ width: `${Math.max(pct, 1.5)}%` }}
                  />
                  <span className="shrink-0 text-xs font-medium tabular">
                    {formatMoney(s.value, currency, { compact: true })}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {s.name}: {s.count} {s.count === 1 ? "deal" : "deals"} ·{" "}
                {formatMoney(s.value, currency)}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
