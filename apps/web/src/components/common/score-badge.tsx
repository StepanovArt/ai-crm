"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

export const HOT_SCORE = 70;

function tier(score: number) {
  if (score >= HOT_SCORE)
    return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25";
  if (score >= 40)
    return "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25";
  return "bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-500/10 dark:text-zinc-400 dark:ring-zinc-500/25";
}

function ScoreBreakdown({ contactId }: { contactId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: qk.contacts.score(contactId),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/contacts/{contact_id}/score", {
          params: { path: { contact_id: contactId } },
        }),
      ),
    staleTime: 30_000,
  });
  if (isLoading || !data) return <div className="w-52 py-1 text-zinc-400">Loading signals…</div>;
  return (
    <div className="w-60 space-y-1.5 py-0.5">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">Lead score</span>
        <span className="font-semibold tabular">{data.score}/100</span>
      </div>
      <ul className="space-y-1">
        {data.signals.map((s) => (
          <li
            key={s.key}
            className={cn("flex items-start justify-between gap-3", !s.active && "opacity-45")}
          >
            <span>
              <span className="block">{s.label}</span>
              {s.active && <span className="block text-[11px] opacity-70">{s.detail}</span>}
            </span>
            <span className="shrink-0 font-medium tabular">
              {s.active ? (s.weight > 0 ? `+${s.weight}` : s.weight) : "·"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScoreBadge({
  score,
  contactId,
  className,
}: {
  score: number;
  contactId?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const badge = (
    <span
      className={cn(
        "inline-flex h-5 min-w-8 items-center justify-center gap-0.5 rounded-full px-1.5 text-xs font-semibold tabular ring-1 ring-inset",
        tier(score),
        className,
      )}
    >
      {score >= HOT_SCORE && <Flame className="size-3" strokeWidth={2.5} />}
      {score}
    </span>
  );
  if (!contactId) return badge;
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button type="button" className="cursor-help" aria-label={`Score ${score}, show breakdown`}>
          {badge}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-none">
        {open && <ScoreBreakdown contactId={contactId} />}
      </TooltipContent>
    </Tooltip>
  );
}
