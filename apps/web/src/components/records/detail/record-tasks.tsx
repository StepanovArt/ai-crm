"use client";

import * as React from "react";
import { ListChecks, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RecordType } from "@/hooks/use-records";
import { useCreateTask, useTasks } from "@/hooks/use-tasks";

import { TaskRow } from "@/components/tasks/task-row";

export function RecordTasks({ type, id }: { type: RecordType; id: string }) {
  const { data } = useTasks({
    filter: { related_type: type, related_id: id },
    sort: "done,due_at",
  });
  const create = useCreateTask();
  const [adding, setAdding] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const tasks = data?.items ?? [];
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  async function add() {
    if (!title.trim()) return setAdding(false);
    const due = new Date();
    due.setDate(due.getDate() + 1);
    due.setHours(10, 0, 0, 0);
    await create.mutateAsync({
      title: title.trim(),
      related_type: type,
      related_id: id,
      due_at: due.toISOString(),
    });
    setTitle("");
  }

  return (
    <section data-agent-id={`record-tasks-${id}`}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <ListChecks className="size-3.5" /> Tasks
          {open.length > 0 && (
            <span className="rounded bg-muted px-1 text-[11px] normal-case tabular">
              {open.length}
            </span>
          )}
        </h2>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setAdding(true)}
          aria-label="Add task"
        >
          <Plus />
        </Button>
      </div>
      <div className="space-y-0.5">
        {adding && (
          <Input
            autoFocus
            value={title}
            placeholder="Task title, Enter to save"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
              if (e.key === "Escape") setAdding(false);
            }}
            onBlur={() => !title && setAdding(false)}
            className="mb-1 h-8 text-[13px]"
          />
        )}
        {open.map((t) => (
          <TaskRow key={t.id} task={t} compact />
        ))}
        {open.length === 0 && !adding && (
          <p className="py-1 text-[13px] text-muted-foreground">No open tasks.</p>
        )}
        {done.length > 0 && (
          <details className="pt-1">
            <summary className="cursor-pointer text-xs text-muted-foreground select-none">
              {done.length} completed
            </summary>
            <div className="mt-1 space-y-0.5">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} compact />
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
