"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";

import { AgentBadge } from "@/components/common/agent-badge";
import { Avatar } from "@/components/common/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useDeleteTask, useUpdateTask, type Task } from "@/hooks/use-tasks";
import { useMembers } from "@/hooks/use-workspace";
import { agentId } from "@/lib/agent-ids";
import { dayDiff, formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function DueChip({ due, done }: { due: string | null; done: boolean }) {
  if (!due) return null;
  const d = new Date(due);
  const diff = dayDiff(d);
  const label =
    diff === 0
      ? `Today ${formatTime(d)}`
      : diff === 1
        ? "Tomorrow"
        : diff === -1
          ? "Yesterday"
          : formatDate(d);
  return (
    <span
      className={cn(
        "shrink-0 text-xs whitespace-nowrap tabular",
        done
          ? "text-muted-foreground"
          : diff < 0
            ? "font-medium text-rose-700 dark:text-rose-400"
            : diff === 0
              ? "font-medium text-amber-700 dark:text-amber-400"
              : "text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

export function TaskRow({ task, compact = false }: { task: Task; compact?: boolean }) {
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const { byId } = useMembers();
  const assignee = task.assignee_id ? byId.get(task.assignee_id) : undefined;
  return (
    <div
      data-agent-id={agentId.task(task.id)}
      className={cn(
        "group flex items-center gap-2.5 rounded-md transition-colors hover:bg-accent/50",
        compact ? "-mx-1.5 px-1.5 py-1" : "px-3 py-2",
      )}
    >
      <Checkbox
        checked={task.done}
        aria-label={task.done ? "Mark as not done" : "Mark as done"}
        onCheckedChange={(v) => update.mutate({ id: task.id, body: { done: v === true } })}
        className="rounded-full"
      />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={cn(
            "truncate text-[13px]",
            task.done && "text-muted-foreground line-through decoration-muted-foreground/50",
          )}
        >
          {task.title}
        </span>
        {task.created_by === "agent" && <AgentBadge label="Created by Halo AI" />}
        {!compact && task.related && (
          <Link
            href={`/records/${task.related.type}/${task.related.id}`}
            className="truncate rounded px-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {task.related.name}
          </Link>
        )}
      </div>
      <DueChip due={task.due_at} done={task.done} />
      {!compact && assignee && <Avatar name={assignee.full_name} size="xs" />}
      {!compact && (
        <button
          aria-label="Delete task"
          onClick={() => remove.mutate(task.id)}
          className="cursor-pointer rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}
