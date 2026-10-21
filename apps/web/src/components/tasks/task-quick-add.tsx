"use client";

import * as React from "react";
import { CalendarClock, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTask } from "@/hooks/use-tasks";

const DUE = [
  { key: "today", label: "Today", days: 0 },
  { key: "tomorrow", label: "Tomorrow", days: 1 },
  { key: "week", label: "In a week", days: 7 },
  { key: "none", label: "No date", days: null },
] as const;

export function TaskQuickAdd() {
  const [title, setTitle] = React.useState("");
  const [due, setDue] = React.useState<(typeof DUE)[number]["key"]>("today");
  const create = useCreateTask();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const opt = DUE.find((d) => d.key === due)!;
    let dueAt: string | null = null;
    if (opt.days !== null) {
      const d = new Date();
      d.setDate(d.getDate() + opt.days);
      d.setHours(opt.days === 0 ? Math.min(Math.max(d.getHours() + 1, 9), 18) : 10, 0, 0, 0);
      dueAt = d.toISOString();
    }
    await create.mutateAsync({ title: title.trim(), due_at: dueAt });
    setTitle("");
  }

  return (
    <form
      onSubmit={submit}
      className="flex items-center gap-2 rounded-lg border bg-surface p-1.5 pl-3 shadow-xs"
      data-agent-id="task-quick-add"
    >
      <Plus className="size-4 text-muted-foreground" />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task…"
        aria-label="New task title"
        className="h-7 flex-1 border-0 px-0 shadow-none focus-visible:ring-0"
      />
      <Select value={due} onValueChange={(v) => setDue(v as typeof due)}>
        <SelectTrigger size="sm" className="w-32 border-0 shadow-none" aria-label="Due">
          <CalendarClock className="size-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DUE.map((d) => (
            <SelectItem key={d.key} value={d.key}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" type="submit" disabled={!title.trim() || create.isPending}>
        Add
      </Button>
    </form>
  );
}
