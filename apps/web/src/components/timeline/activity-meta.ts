import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  CirclePlus,
  ListPlus,
  Mail,
  MailOpen,
  Pencil,
  Phone,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

export const ACTIVITY_META: Record<string, { icon: LucideIcon; tint: string; label: string }> = {
  email_sent: {
    icon: Mail,
    tint: "text-sky-600 bg-sky-50 dark:bg-sky-500/10 dark:text-sky-300",
    label: "Email sent",
  },
  email_received: {
    icon: MailOpen,
    tint: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300",
    label: "Reply received",
  },
  call: {
    icon: Phone,
    tint: "text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300",
    label: "Call",
  },
  meeting: {
    icon: CalendarDays,
    tint: "text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-300",
    label: "Meeting",
  },
  note: {
    icon: StickyNote,
    tint: "text-yellow-700 bg-yellow-50 dark:bg-yellow-500/10 dark:text-yellow-300",
    label: "Note",
  },
  stage_changed: {
    icon: ArrowRight,
    tint: "text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-300",
    label: "Stage changed",
  },
  field_updated: {
    icon: Pencil,
    tint: "text-zinc-500 bg-zinc-100 dark:bg-zinc-500/10 dark:text-zinc-400",
    label: "Updated",
  },
  task_created: {
    icon: ListPlus,
    tint: "text-zinc-500 bg-zinc-100 dark:bg-zinc-500/10 dark:text-zinc-400",
    label: "Task created",
  },
  task_completed: {
    icon: CircleCheck,
    tint: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300",
    label: "Task completed",
  },
  record_created: {
    icon: CirclePlus,
    tint: "text-zinc-500 bg-zinc-100 dark:bg-zinc-500/10 dark:text-zinc-400",
    label: "Created",
  },
};

export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 0) return "Upcoming";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}
