"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useTasks } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

import { TaskRow } from "./task-row";

export function TaskGroup({
  title,
  bucket,
  tone,
  filter,
  defaultOpen = true,
  emptyHint,
}: {
  title: string;
  bucket: "overdue" | "today" | "upcoming" | "done";
  tone: string;
  filter: Record<string, unknown>;
  defaultOpen?: boolean;
  emptyHint: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const { data, isLoading } = useTasks({
    filter: { ...filter, bucket },
    sort: bucket === "done" ? "-completed_at" : "due_at",
    limit: bucket === "done" ? 30 : 200,
  });
  const tasks = data?.items ?? [];
  return (
    <section className="rounded-xl border bg-surface" data-agent-id={`task-group-${bucket}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
        />
        <span className={cn("size-2 rounded-full", tone)} />
        <h2 className="text-[13px] font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground tabular">{data?.total ?? ""}</span>
      </button>
      {open && (
        <div className="border-t px-1 py-1">
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : tasks.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-muted-foreground">{emptyHint}</p>
          ) : (
            tasks.map((t) => <TaskRow key={t.id} task={t} />)
          )}
        </div>
      )}
    </section>
  );
}
