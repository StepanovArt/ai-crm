"use client";

import Link from "next/link";
import { ArrowUpRight, Inbox } from "lucide-react";

import { Avatar } from "@/components/common/avatar";
import { EmptyState } from "@/components/common/empty-state";
import { MoneyText } from "@/components/common/money";
import { ScoreBadge } from "@/components/common/score-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { QueueItem } from "@/hooks/use-today";
import { agentId } from "@/lib/agent-ids";
import { cn } from "@/lib/utils";

const REASON_TONE: Record<string, string> = {
  replied_recently: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  meeting_scheduled: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  opened_multiple: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  deal_open: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
  title_is_decision_maker: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  stale_14d: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400",
};

function ReasonChip({ reason }: { reason: QueueItem["reasons"][number] }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap",
            REASON_TONE[reason.key],
          )}
        >
          {reason.label}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {reason.detail} ({reason.weight > 0 ? "+" : ""}
        {reason.weight})
      </TooltipContent>
    </Tooltip>
  );
}

export function ContactQueue({ items }: { items: QueueItem[] }) {
  if (!items.length)
    return (
      <EmptyState
        compact
        icon={Inbox}
        title="Your queue is clear"
        hint="New replies and meetings will surface people here."
      />
    );
  return (
    <ol className="divide-y">
      {items.map((item, i) => {
        const c = item.contact;
        return (
          <li key={c.id} data-agent-id={agentId.queueItem(c.id)}>
            <Link
              href={`/records/contact/${c.id}`}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
            >
              <span className="w-4 text-xs text-muted-foreground tabular">{i + 1}</span>
              <Avatar name={c.full_name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium">{c.full_name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[c.title, c.company?.name].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {item.reasons
                    .filter((r) => r.weight > 0)
                    .slice(0, 3)
                    .map((r) => (
                      <ReasonChip key={r.key} reason={r} />
                    ))}
                </div>
              </div>
              {item.open_deal && (
                <div className="hidden max-w-48 min-w-0 text-right xl:block">
                  <p className="truncate text-xs text-muted-foreground">
                    {item.open_deal.stage?.name}
                  </p>
                  <MoneyText
                    value={item.open_deal.value}
                    currency={item.open_deal.currency}
                    compact
                    className="text-[13px] font-medium"
                  />
                </div>
              )}
              <ScoreBadge score={item.score} />
              <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
