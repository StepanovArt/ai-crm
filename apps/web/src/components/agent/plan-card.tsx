"use client";

import { Check, CircleDashed, ListChecks, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PlanStatus } from "@/lib/agent/reducer";
import type { PlanStepOut } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

import { toolIcon } from "./tool-meta";

const STATUS: Record<PlanStatus, { label: string; tone: string }> = {
  proposed: { label: "Waiting for approval", tone: "text-amber-700 dark:text-amber-300" },
  approving: { label: "Running…", tone: "text-violet-600 dark:text-violet-300" },
  approved: { label: "Approved", tone: "text-violet-600 dark:text-violet-300" },
  executed: { label: "Done", tone: "text-emerald-700 dark:text-emerald-400" },
  rejected: { label: "Rejected", tone: "text-muted-foreground" },
};

export function PlanCard({
  planId,
  title,
  steps,
  status,
  disabled,
  onApprove,
  onReject,
}: {
  planId: string;
  title: string;
  steps: PlanStepOut[];
  status: PlanStatus;
  disabled: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const meta = STATUS[status];
  return (
    <div
      className="overflow-hidden rounded-xl border border-agent bg-surface shadow-xs"
      data-agent-id={`plan-${planId}`}
      data-plan-status={status}
    >
      <div className="flex items-start gap-2.5 px-3.5 pt-3">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-agent text-white">
          <ListChecks className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Plan · {steps.length} step{steps.length === 1 ? "" : "s"}
          </p>
          <p className="text-[13px] leading-snug font-semibold">{title}</p>
        </div>
      </div>
      <ol className="mt-2.5 space-y-1 px-3.5">
        {steps.map((s, i) => {
          const Icon = toolIcon(s.tool);
          return (
            <li key={s.id} className="flex items-center gap-2 text-[13px]">
              <span className="w-4 text-right text-xs text-muted-foreground tabular">{i + 1}</span>
              {status === "executed" ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : status === "rejected" ? (
                <CircleDashed className="size-3.5 text-muted-foreground/50" />
              ) : (
                <Icon className="size-3.5 text-muted-foreground" />
              )}
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  status === "rejected" && "text-muted-foreground line-through",
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex items-center gap-2 border-t bg-muted/30 px-3.5 py-2">
        <span className={cn("flex items-center gap-1.5 text-xs font-medium", meta.tone)}>
          {status === "approving" && <Loader2 className="size-3 animate-spin" />}
          {meta.label}
        </span>
        {status === "proposed" && (
          <div className="ml-auto flex gap-1.5">
            <Button
              size="xs"
              variant="ghost"
              onClick={onReject}
              disabled={disabled}
              className="text-muted-foreground"
            >
              <X /> Reject
            </Button>
            <Button
              size="xs"
              variant="agent"
              onClick={onApprove}
              disabled={disabled}
              data-agent-id="plan-approve"
            >
              <Check /> Approve
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
