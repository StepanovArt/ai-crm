"use client";

import Link from "next/link";
import { PartyPopper } from "lucide-react";

import { Avatar } from "@/components/common/avatar";
import { EmptyState } from "@/components/common/empty-state";
import { MoneyText } from "@/components/common/money";
import { ColorDot } from "@/components/common/status-badge";
import type { Today } from "@/hooks/use-today";
import { useMembers } from "@/hooks/use-workspace";
import { daysSince } from "@/lib/format";

export function StaleDeals({ deals }: { deals: Today["stale_deals"] }) {
  const { byId } = useMembers();
  if (!deals.length)
    return (
      <EmptyState
        compact
        icon={PartyPopper}
        title="Nothing is going stale"
        hint="Every open deal was touched this week."
      />
    );
  return (
    <ul className="divide-y">
      {deals.map((d) => {
        const quiet = daysSince(d.last_activity_at);
        const owner = d.owner_id ? byId.get(d.owner_id) : undefined;
        return (
          <li key={d.id}>
            <Link
              href={`/records/deal/${d.id}`}
              className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-accent/40"
            >
              <ColorDot color={d.stage?.color ?? "slate"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {d.stage?.name} · <MoneyText value={d.value} currency={d.currency} compact />
                </p>
              </div>
              <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 tabular dark:text-amber-300">
                {quiet === null ? "never" : `${quiet}d quiet`}
              </span>
              {owner && <Avatar name={owner.full_name} size="xs" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
