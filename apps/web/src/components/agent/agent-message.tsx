"use client";

import { RotateCcw, Undo2 } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Markdown } from "@/lib/agent/markdown";
import type { AssistantMessage, Block, ChatMessage } from "@/lib/agent/reducer";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/stores/agent-store";

import { AgentAvatar } from "./agent-avatar";
import { AgentCard } from "./cards/card";
import { PlanCard } from "./plan-card";
import { ToolChip } from "./tool-chip";

/** Group consecutive tool blocks so their chips wrap on one row. */
function group(blocks: Block[]): (Block | Block[])[] {
  const out: (Block | Block[])[] = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (b.type === "tool" && Array.isArray(last)) last.push(b);
    else out.push(b.type === "tool" ? [b] : b);
  }
  return out;
}

function Thinking({ label }: { label: string }) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 text-[13px]"
      data-agent-thinking
    >
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1 animate-bounce rounded-full bg-violet-400"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </span>
      <span className="shimmer-text font-medium">{label}</span>
    </motion.p>
  );
}

function Assistant({ message }: { message: AssistantMessage }) {
  const { streaming, approve, reject, undo, send } = useAgentStore();
  const empty = message.blocks.length === 0 && !message.thinking;
  return (
    <div className="flex gap-2.5" data-agent-message={message.status}>
      <AgentAvatar className="mt-0.5" pulsing={message.status === "streaming"} />
      <div className="min-w-0 flex-1 space-y-2.5 text-[13.5px] leading-relaxed">
        {empty && message.status === "streaming" && <Thinking label="Thinking" />}
        {group(message.blocks).map((b, i) => {
          if (Array.isArray(b))
            return (
              <div key={i} className="flex flex-wrap gap-1.5">
                {b.map((t) =>
                  t.type === "tool" ? (
                    <ToolChip
                      key={t.callId}
                      tool={t.tool}
                      label={t.label}
                      status={t.status}
                      summary={t.summary}
                    />
                  ) : null,
                )}
              </div>
            );
          if (b.type === "text")
            return <Markdown key={i} text={b.text} className="text-foreground/90" />;
          if (b.type === "plan")
            return (
              <PlanCard
                key={b.planId}
                planId={b.planId}
                title={b.title}
                steps={b.steps}
                status={b.status}
                disabled={streaming}
                onApprove={() => void approve(b.planId)}
                onReject={() => void reject(b.planId)}
              />
            );
          if (b.type === "card") return <AgentCard key={i} kind={b.kind} data={b.data} />;
          if (b.type !== "error") return null;
          return (
            <p
              key={i}
              className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-[13px] text-destructive"
            >
              {b.message}
            </p>
          );
        })}
        {message.thinking && <Thinking label={message.thinking} />}
        {message.status !== "streaming" && message.undoIds.length > 0 && (
          <div className="flex items-center gap-2 pt-0.5">
            {message.undone ? (
              <span
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
                data-agent-undone
              >
                <RotateCcw className="size-3" /> Changes undone
              </span>
            ) : (
              <Button
                size="xs"
                variant="outline"
                onClick={() => void undo(message.id)}
                data-agent-id="agent-undo"
              >
                <Undo2 /> Undo{" "}
                {message.undoIds.length > 1 ? `${message.undoIds.length} changes` : "change"}
              </Button>
            )}
          </div>
        )}
        {message.status !== "streaming" && message.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {message.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => void send(s)}
                disabled={streaming}
                className="cursor-pointer rounded-full border bg-surface px-2.5 py-1 text-xs text-foreground/80 transition-colors hover:border-violet-300 hover:bg-agent-soft hover:text-foreground disabled:opacity-50 dark:hover:border-violet-500/40"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentMessageView({ message }: { message: ChatMessage }) {
  if (message.role === "user")
    return (
      <div className="flex justify-end">
        <p
          className={cn(
            "max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap",
          )}
        >
          {message.text}
        </p>
      </div>
    );
  return <Assistant message={message} />;
}
