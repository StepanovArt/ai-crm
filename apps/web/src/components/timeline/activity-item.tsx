"use client";

import Link from "next/link";

import { AgentBadge } from "@/components/common/agent-badge";
import { RelativeDate } from "@/components/common/relative-date";
import { StatusBadge } from "@/components/common/status-badge";
import { useStageMap } from "@/hooks/use-pipelines";
import type { Activity } from "@/hooks/use-timeline";
import { useMembers } from "@/hooks/use-workspace";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ACTIVITY_META } from "./activity-meta";

type P = Record<string, unknown>;
const str = (v: unknown) =>
  typeof v === "string" ? v : v === null || v === undefined ? "" : String(v);

function fmtChange(v: unknown): string {
  if (v === null || v === undefined || v === "") return "empty";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

function Headline({
  a,
  actor,
  contextName,
}: {
  a: Activity;
  actor: string;
  contextName: string | null;
}) {
  const p = a.payload as P;
  const who = <span className="font-medium text-foreground">{actor}</span>;
  const target = contextName ? (
    <span className="font-medium text-foreground">{contextName}</span>
  ) : null;
  switch (a.type) {
    case "email_sent":
      return (
        <>
          {who} emailed {target ?? "a contact"}
        </>
      );
    case "email_received":
      return <>{target ?? "Contact"} replied</>;
    case "call":
      return (
        <>
          {who} called {target ?? "a contact"}
          {p.outcome === "voicemail" ? " · voicemail" : ""}
        </>
      );
    case "meeting":
      return (
        <>
          {who} {p.status === "scheduled" ? "booked a meeting with" : "met with"}{" "}
          {target ?? "a contact"}
        </>
      );
    case "note":
      return (
        <>
          {who} added a note{target ? <> on {target}</> : null}
        </>
      );
    case "stage_changed":
      return (
        <>
          {who} moved {target ?? "the deal"}
        </>
      );
    case "field_updated":
      return (
        <>
          {who} updated {target ?? "this record"}
        </>
      );
    case "task_created":
      return <>{who} created a task</>;
    case "task_completed":
      return <>{who} completed a task</>;
    case "record_created":
      return (
        <>
          {who} created {target ?? "this record"}
        </>
      );
    default:
      return (
        <>
          {who} {a.type}
        </>
      );
  }
}

function Body({ a, noteBodies }: { a: Activity; noteBodies: Map<string, string> }) {
  const p = a.payload as P;
  const stages = useStageMap();
  switch (a.type) {
    case "email_sent":
    case "email_received":
      return (
        <div className="mt-1.5 rounded-lg border bg-surface px-3 py-2">
          <p className="text-[13px] font-medium">{str(p.subject)}</p>
          {p.snippet ? (
            <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">
              {str(p.snippet)}
            </p>
          ) : null}
          {typeof p.opens === "number" && p.opens > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">Opened {p.opens}×</p>
          )}
        </div>
      );
    case "call":
      return p.summary ? (
        <p className="mt-1 text-[13px] text-muted-foreground">
          {str(p.summary)}
          {p.duration_min ? <span className="ml-1">· {str(p.duration_min)} min</span> : null}
        </p>
      ) : null;
    case "meeting":
      return (
        <p className="mt-1 text-[13px] text-muted-foreground">
          {str(p.title)}
          {p.scheduled_for ? (
            <span className="ml-1">· {formatDateTime(str(p.scheduled_for))}</span>
          ) : null}
        </p>
      );
    case "note": {
      const body = noteBodies.get(str(p.note_id)) ?? str(p.excerpt);
      return (
        <div className="mt-1.5 rounded-lg border border-yellow-200/70 bg-yellow-50/60 px-3 py-2 text-[13px] whitespace-pre-wrap dark:border-yellow-500/15 dark:bg-yellow-500/5">
          {body}
        </div>
      );
    }
    case "stage_changed": {
      const from = stages.get(str(p.from_stage_id));
      const to = stages.get(str(p.to_stage_id));
      return (
        <div className="mt-1.5 flex items-center gap-1.5">
          <StatusBadge label={str(p.from_stage)} color={from?.color ?? "slate"} dot />
          <span className="text-muted-foreground">→</span>
          <StatusBadge label={str(p.to_stage)} color={to?.color ?? "slate"} dot />
        </div>
      );
    }
    case "field_updated": {
      const changes =
        (p.changes as { label: string; from: unknown; to: unknown }[] | undefined) ?? [];
      return (
        <ul className="mt-1 space-y-0.5 text-[13px] text-muted-foreground">
          {changes.slice(0, 4).map((c) => (
            <li key={c.label}>
              <span className="text-foreground/80">{c.label}</span>:{" "}
              <span className="text-muted-foreground line-through">{fmtChange(c.from)}</span> →{" "}
              <span className="text-foreground/90">{fmtChange(c.to)}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "task_created":
    case "task_completed":
      return <p className="mt-1 text-[13px] text-muted-foreground">{str(p.title)}</p>;
    default:
      return null;
  }
}

export function ActivityItem({
  activity: a,
  recordType,
  recordId,
  noteBodies,
  isLast,
}: {
  activity: Activity;
  recordType: string;
  recordId: string;
  noteBodies: Map<string, string>;
  isLast: boolean;
}) {
  const { byId } = useMembers();
  const meta = ACTIVITY_META[a.type] ?? ACTIVITY_META.field_updated!;
  const Icon = meta.icon;
  const isAgent = a.actor_type === "agent";
  const actor = isAgent ? "Halo AI" : (byId.get(a.actor_id ?? "")?.full_name ?? "Someone");
  const elsewhere = !(a.related_type === recordType && a.related_id === recordId) && a.related;
  const contextName = a.related?.name ?? null;
  return (
    <li className="relative flex gap-3 pb-5" data-agent-id={`activity-${a.id}`}>
      {!isLast && (
        <span className="absolute top-8 bottom-0 left-[13px] w-px bg-border" aria-hidden />
      )}
      <span
        className={cn(
          "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-background",
          meta.tint,
          isAgent && "bg-agent-soft text-violet-600 dark:text-violet-300",
        )}
      >
        <Icon className="size-3.5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 text-[13px] text-muted-foreground">
            {isAgent && <AgentBadge className="mr-1 align-[-2px]" />}
            <Headline
              a={a}
              actor={actor}
              contextName={elsewhere || a.type !== "record_created" ? contextName : null}
            />
            {elsewhere && a.related && (
              <Link
                href={`/records/${a.related.type}/${a.related.id}`}
                className="ml-1.5 text-xs text-muted-foreground/80 hover:text-foreground hover:underline"
              >
                ↗
              </Link>
            )}
          </p>
          <RelativeDate value={a.occurred_at} className="shrink-0 text-xs text-muted-foreground" />
        </div>
        <Body a={a} noteBodies={noteBodies} />
      </div>
    </li>
  );
}
