"use client";

import { MessageSquareText, PenLine, RefreshCw, Sparkles } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsight } from "@/hooks/use-insight";
import type { RecordType } from "@/hooks/use-records";
import { agentId } from "@/lib/agent-ids";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/stores/agent-store";

import { NextStepCard } from "./cards/next-step-card";

const TONE = {
  positive: "bg-emerald-500",
  neutral: "bg-zinc-400",
  warning: "bg-amber-500",
} as const;

export function InlineInsight({ type, id }: { type: RecordType; id: string }) {
  const { data, isLoading, isFetching, refetch } = useInsight(type, id);
  const send = useAgentStore((s) => s.send);
  return (
    <section
      data-agent-id={agentId.insight(type, id)}
      className="overflow-hidden rounded-xl border border-agent p-px shadow-xs"
      aria-label="AI insight"
    >
      <div className="rounded-[11px] bg-surface">
        <header className="flex items-center gap-2 px-3.5 pt-3">
          <span className="flex size-5 items-center justify-center rounded-md bg-agent text-white">
            <Sparkles className="size-3" />
          </span>
          <span className="text-agent text-xs font-semibold">AI insight</span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="ml-auto text-muted-foreground"
            aria-label="Refresh insight"
            onClick={() => void refetch()}
          >
            <RefreshCw className={cn(isFetching && "animate-spin")} />
          </Button>
        </header>
        {isLoading || !data ? (
          <div className="space-y-2 px-3.5 pt-2 pb-4">
            <p className="shimmer-text text-xs">Reading the timeline…</p>
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="px-3.5 pt-2">
              <p className="flex items-center gap-2 text-[13px] font-semibold">
                <span className={cn("size-1.5 shrink-0 rounded-full", TONE[data.tone])} />
                {data.headline}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {data.summary}
              </p>
              {data.bullets.length > 0 && (
                <ul className="mt-2 space-y-1 text-[12.5px] text-foreground/80">
                  {data.bullets.slice(0, 4).map((b) => (
                    <li key={b} className="flex gap-1.5">
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {data.next_step && (
              <div className="mx-3.5 mt-3 rounded-lg bg-muted/50 p-3">
                <NextStepCard key={data.next_step.title} data={data.next_step} compact />
              </div>
            )}
            <div className="mt-3 flex items-center gap-1 border-t px-2 py-1.5">
              {type !== "company" && (
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => void send("Draft a follow-up email")}
                  data-agent-id="insight-draft-email"
                >
                  <PenLine /> Draft email
                </Button>
              )}
              <Button size="xs" variant="ghost" onClick={() => void send("Summarize this")}>
                <MessageSquareText /> Ask about this
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
