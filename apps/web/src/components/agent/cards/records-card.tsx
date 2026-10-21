"use client";

import Link from "next/link";
import { Building2, CheckSquare, CircleDollarSign, User } from "lucide-react";

import type { RecordsCardData } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

const ICONS = {
  task: CheckSquare,
  contact: User,
  deal: CircleDollarSign,
  company: Building2,
} as const;
const TONES = {
  danger: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  warning: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
  positive: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  neutral: "bg-muted text-muted-foreground",
} as const;

export function RecordsCard({ data }: { data: RecordsCardData }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-surface" data-card="records">
      <p className="border-b px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {data.title}
      </p>
      <ul className="divide-y">
        {data.items.map((item) => {
          const Icon = ICONS[item.type];
          return (
            <li key={`${item.type}-${item.id}`}>
              <Link
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-accent/50"
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{item.title}</span>
                  {item.subtitle && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.subtitle}
                    </span>
                  )}
                </span>
                {item.badge && (
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                      TONES[item.tone ?? "neutral"],
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
