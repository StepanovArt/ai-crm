"use client";

import * as React from "react";
import { ArrowRight, Check, ListPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCreateTask } from "@/hooks/use-tasks";
import type { NextStepData } from "@/lib/agent/types";

export function dueLabel(days: number) {
  return days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
}

export function dueDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

/** One-click "Create task" from a suggested next step (a user action, so no plan needed). */
export function NextStepCard({ data, compact = false }: { data: NextStepData; compact?: boolean }) {
  const create = useCreateTask();
  const [done, setDone] = React.useState(false);
  async function createTask() {
    await create.mutateAsync({
      title: data.title,
      due_at: dueDate(data.due_in_days),
      related_type: data.related_type,
      related_id: data.related_id,
    });
    setDone(true);
    toast.success(`Task created — due ${dueLabel(data.due_in_days)}`);
  }
  return (
    <div className={compact ? "" : "rounded-xl border bg-surface p-3"} data-card="next_step">
      <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <ArrowRight className="size-3" /> Suggested next step
      </p>
      <p className="mt-1 text-[13px] font-medium">{data.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {data.reason} · due {dueLabel(data.due_in_days)}
      </p>
      <Button
        size="xs"
        variant={done ? "ghost" : "outline"}
        className="mt-2.5"
        onClick={createTask}
        disabled={done || create.isPending}
        data-agent-id="next-step-create-task"
      >
        {done ? <Check className="text-emerald-500" /> : <ListPlus />}
        {done ? "Task created" : "Create task"}
      </Button>
    </div>
  );
}
