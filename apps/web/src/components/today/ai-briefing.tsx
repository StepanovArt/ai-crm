"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, CheckSquare, CircleDollarSign, RefreshCw, Sparkles, User } from "lucide-react";
import { motion } from "motion/react";

import { ToolChip } from "@/components/agent/tool-chip";
import { Button } from "@/components/ui/button";
import { agentId } from "@/lib/agent-ids";
import { Markdown } from "@/lib/agent/markdown";
import {
  applyEvent,
  newAssistant,
  type AssistantMessage,
  type ChatMessage,
} from "@/lib/agent/reducer";
import { streamAgent } from "@/lib/agent/sse";
import type { RecordsCardData } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

const ICONS = {
  task: CheckSquare,
  contact: User,
  deal: CircleDollarSign,
  company: Building2,
} as const;
const TONES = {
  danger: "text-rose-600 dark:text-rose-300",
  warning: "text-amber-700 dark:text-amber-300",
  positive: "text-emerald-700 dark:text-emerald-300",
  neutral: "text-muted-foreground",
} as const;

function useBriefingStream() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [run, setRun] = React.useState(0);
  React.useEffect(() => {
    const controller = new AbortController();
    setMessages([newAssistant("briefing")]);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    streamAgent(`/api/v1/agent/briefing/stream?timezone=${encodeURIComponent(tz)}`, {
      method: "GET",
      signal: controller.signal,
      onEvent: (ev) => setMessages((m) => applyEvent(m, ev)),
    }).catch(() =>
      setMessages((m) => applyEvent(m, { type: "error", message: "Couldn't load the briefing." })),
    );
    return () => controller.abort();
  }, [run]);
  const message = messages[messages.length - 1] as AssistantMessage | undefined;
  return { message, refresh: () => setRun((r) => r + 1) };
}

export function AIBriefing() {
  const { message, refresh } = useBriefingStream();
  const streaming = !message || message.status === "streaming";
  const text =
    message?.blocks
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("") ?? "";
  const tools = message?.blocks.filter((b) => b.type === "tool") ?? [];
  const card = message?.blocks.find((b) => b.type === "card");
  const items = card?.type === "card" ? (card.data as unknown as RecordsCardData).items : [];

  return (
    <section
      data-agent-id={agentId.briefing}
      className="relative overflow-hidden rounded-xl border border-agent p-px"
      aria-label="AI briefing"
    >
      <div className="relative rounded-[11px] bg-surface px-5 py-4">
        <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-[radial-gradient(circle,rgb(139_92_246/0.10),transparent_65%)]" />
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <span className="flex size-6 items-center justify-center rounded-md bg-agent text-white">
            <Sparkles className="size-3.5" />
          </span>
          <span className="text-agent">AI briefing</span>
          {streaming && message?.thinking && (
            <span className="ml-1 shimmer-text text-xs font-medium">{message.thinking}</span>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            className="ml-auto text-muted-foreground"
            onClick={refresh}
            disabled={streaming}
            aria-label="Refresh briefing"
          >
            <RefreshCw className={cn(streaming && "animate-spin")} />
          </Button>
        </div>
        {streaming && tools.length > 0 && !text && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tools.map((t) =>
              t.type === "tool" ? (
                <ToolChip key={t.callId} tool={t.tool} label={t.label} status={t.status} />
              ) : null,
            )}
          </div>
        )}
        {!text && streaming && tools.length === 0 && (
          <div className="mt-3 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        )}
        {text && (
          <Markdown
            text={text}
            className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/85"
          />
        )}
        {message?.status === "error" && (
          <p className="mt-3 text-sm text-destructive">
            Couldn&apos;t load the briefing — try refreshing.
          </p>
        )}
        {items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-4 grid gap-2 @2xl:grid-cols-2 @4xl:grid-cols-3"
          >
            {items.map((i) => {
              const Icon = ICONS[i.type];
              return (
                <Link
                  key={`${i.type}-${i.id}`}
                  href={i.href}
                  className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2 transition-colors hover:border-border-strong hover:bg-accent/40"
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{i.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {i.subtitle}
                    </span>
                  </span>
                  {i.badge && (
                    <span
                      className={cn("shrink-0 text-[11px] font-medium", TONES[i.tone ?? "neutral"])}
                    >
                      {i.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </motion.div>
        )}
      </div>
    </section>
  );
}
