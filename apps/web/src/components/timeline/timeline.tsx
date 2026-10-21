"use client";

import * as React from "react";
import { History } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { RecordType } from "@/hooks/use-records";
import { useActivities, useNotes } from "@/hooks/use-timeline";
import { agentId } from "@/lib/agent-ids";

import { ActivityItem } from "./activity-item";
import { dayLabel } from "./activity-meta";
import { NoteComposer } from "./note-composer";

export function Timeline({ type, id }: { type: RecordType; id: string }) {
  const { data: activities, isLoading } = useActivities(type, id);
  const { data: notes } = useNotes(type, id);
  const noteBodies = React.useMemo(
    () => new Map((notes?.items ?? []).map((n) => [n.id, n.body])),
    [notes],
  );
  const groups = React.useMemo(() => {
    const out: { label: string; items: NonNullable<typeof activities> }[] = [];
    for (const a of activities ?? []) {
      const label = dayLabel(a.occurred_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(a);
      else out.push({ label, items: [a] });
    }
    return out;
  }, [activities]);

  return (
    <section className="space-y-5" data-agent-id={agentId.timeline(type, id)} aria-label="Timeline">
      <NoteComposer type={type} id={id} />
      {isLoading ? (
        <div className="space-y-5 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-7 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          compact
          icon={History}
          title="No activity yet"
          hint="Notes, emails, calls and stage changes will show up here."
        />
      ) : (
        groups.map((g) => (
          <div key={g.label}>
            <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {g.label}
            </h3>
            <ol>
              {g.items.map((a, i) => (
                <ActivityItem
                  key={a.id}
                  activity={a}
                  recordType={type}
                  recordId={id}
                  noteBodies={noteBodies}
                  isLast={i === g.items.length - 1}
                />
              ))}
            </ol>
          </div>
        ))
      )}
    </section>
  );
}
