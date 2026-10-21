"use client";

import { useQueryClient } from "@tanstack/react-query";

import type { Board } from "@/hooks/use-board";
import type { Contact, Deal } from "@/hooks/use-records";
import { useTerms } from "@/hooks/use-workspace";
import type { PageContext } from "@/lib/agent/types";
import { qk } from "@/lib/query-keys";

/** Page-aware starter prompts. Record names come from data already in the query cache. */
export function useSuggestedPrompts(ctx: PageContext): string[] {
  const qc = useQueryClient();
  const t = useTerms();
  const deals = t.deals.toLowerCase();
  const general = [
    "What's on my plate today?",
    `Find stale ${deals} and create follow-ups`,
    "Show me hot leads",
    `How's the ${t.pipeline.toLowerCase()} this month?`,
  ];
  if (ctx.record_type === "deal" && ctx.record_id) {
    const deal = qc.getQueryData<Deal>(qk.deals.detail(ctx.record_id));
    const boards = qc.getQueriesData<Board>({ queryKey: qk.pipelines.all });
    const stages = boards.find(([, b]) => b?.pipeline?.id === deal?.pipeline_id)?.[1]?.pipeline
      .stages;
    const next = stages?.find(
      (s) => s.position === (deal?.stage?.position ?? -2) + 1 && s.kind === "open",
    );
    return [
      "Summarize this",
      "Draft a follow-up email",
      next ? `Move this to ${next.name}` : "Remind me to follow up tomorrow",
      "What's on my plate today?",
    ];
  }
  if (ctx.record_type === "contact")
    return [
      "Summarize this",
      "Draft a follow-up email",
      "Remind me to follow up tomorrow",
      "Show me hot leads",
    ];
  if (ctx.record_type === "company")
    return [
      "Summarize this",
      "Draft a follow-up email",
      "What's on my plate today?",
      "Show me hot leads",
    ];
  const route = ctx.route ?? "/";
  if (route.startsWith("/pipeline")) {
    const board = qc
      .getQueriesData<Board>({ queryKey: ["pipelines", "board"] })
      .find(([, b]) => b)?.[1];
    const early = board?.deals.find(
      (d) => d.stage?.kind === "open" && (d.stage?.position ?? 9) <= 1,
    );
    const late = board?.pipeline.stages.find((s) => s.kind === "open" && s.probability >= 70);
    return [
      `How's the ${t.pipeline.toLowerCase()} this month?`,
      `Find stale ${deals} and create follow-ups`,
      early && late
        ? `Move ${early.company?.name ?? early.name} to ${late.name}`
        : "Show me hot leads",
      "What's on my plate today?",
    ];
  }
  if (route.startsWith("/contacts")) {
    const list = qc
      .getQueriesData<{ items: Contact[] }>({ queryKey: qk.contacts.all })
      .find(([, d]) => d?.items?.length)?.[1];
    const top = list?.items[0];
    return [
      "Show me hot leads",
      top ? `Draft a follow-up email to ${top.full_name}` : "Draft a follow-up email",
      "What's on my plate today?",
      general[1]!,
    ];
  }
  return general;
}
