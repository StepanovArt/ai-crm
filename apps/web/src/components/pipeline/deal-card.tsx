"use client";

import * as React from "react";
import { Clock3 } from "lucide-react";

import { AgentBadge } from "@/components/common/agent-badge";
import { Avatar, CompanyLogo } from "@/components/common/avatar";
import { MoneyText } from "@/components/common/money";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BoardDeal } from "@/hooks/use-board";
import { useMembers } from "@/hooks/use-workspace";
import { daysSince } from "@/lib/format";
import { cn } from "@/lib/utils";

export const STALE_DAYS = 7;

export function DealCardBody({ deal, overlay = false }: { deal: BoardDeal; overlay?: boolean }) {
  const { byId } = useMembers();
  const owner = deal.owner_id ? byId.get(deal.owner_id) : undefined;
  const inStage = daysSince(deal.stage_entered_at) ?? 0;
  const quiet = daysSince(deal.last_activity_at);
  const stale = deal.stage?.kind === "open" && (quiet === null || quiet >= STALE_DAYS);
  return (
    <div
      className={cn(
        "group/card relative rounded-lg border bg-surface p-3 shadow-xs transition-[border-color,box-shadow] duration-150",
        "hover:border-border-strong hover:shadow-sm",
        overlay && "rotate-[1.5deg] border-border-strong shadow-pop",
        deal.agent_touched_at && "border-violet-300/70 dark:border-violet-500/40",
      )}
    >
      <div className="flex items-start gap-2">
        <p className="line-clamp-2 flex-1 text-[13px] leading-snug font-medium">{deal.name}</p>
        {deal.agent_touched_at && <AgentBadge label="Recently updated by Halo AI" />}
      </div>
      {deal.company && (
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <CompanyLogo name={deal.company.name} size="xs" className="size-4 rounded text-[8px]" />
          <span className="truncate">{deal.company.name}</span>
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        <MoneyText
          value={deal.value}
          currency={deal.currency}
          className="text-[13px] font-semibold"
        />
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1 text-[11px] tabular",
                stale
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "text-muted-foreground",
              )}
            >
              <Clock3 className="size-3" />
              {inStage}d
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {inStage} days in stage
            {quiet !== null && ` · last touch ${quiet === 0 ? "today" : `${quiet}d ago`}`}
          </TooltipContent>
        </Tooltip>
        {owner && <Avatar name={owner.full_name} size="xs" />}
      </div>
    </div>
  );
}
