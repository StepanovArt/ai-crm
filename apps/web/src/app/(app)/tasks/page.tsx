"use client";

import * as React from "react";

import { PageHeader } from "@/components/common/page-header";
import { TaskGroup } from "@/components/tasks/task-group";
import { TaskQuickAdd } from "@/components/tasks/task-quick-add";
import { ViewTabs } from "@/components/records/table-toolbar";
import { useMe } from "@/hooks/use-auth";

const VIEWS = [
  { key: "mine", label: "Assigned to me" },
  { key: "all", label: "Everyone" },
  { key: "agent", label: "Created by AI" },
];

export default function TasksPage() {
  const { data: me } = useMe();
  const [view, setView] = React.useState("mine");
  const filter: Record<string, unknown> =
    view === "mine"
      ? { assignee_id: me?.user.id }
      : view === "agent"
        ? { created_by: "agent" }
        : {};
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Tasks"
        description="Follow-ups across every record, grouped by when they're due."
      />
      <div className="space-y-4 px-6 pb-10">
        <div className="flex items-center justify-between">
          <ViewTabs views={VIEWS} active={view} onChange={setView} />
        </div>
        <TaskQuickAdd />
        <TaskGroup
          title="Overdue"
          bucket="overdue"
          tone="bg-rose-500"
          filter={filter}
          emptyHint="Nothing overdue. Nice."
        />
        <TaskGroup
          title="Today"
          bucket="today"
          tone="bg-amber-500"
          filter={filter}
          emptyHint="Nothing due today."
        />
        <TaskGroup
          title="Upcoming"
          bucket="upcoming"
          tone="bg-sky-500"
          filter={filter}
          emptyHint="Nothing scheduled."
        />
        <TaskGroup
          title="Done"
          bucket="done"
          tone="bg-emerald-500"
          filter={filter}
          defaultOpen={false}
          emptyHint="No completed tasks yet."
        />
      </div>
    </div>
  );
}
