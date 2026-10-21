"use client";

import * as React from "react";
import { MoreHorizontal, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { agentId } from "@/lib/agent-ids";

export type HeaderStat = { label: string; value: React.ReactNode };

export function RecordHeader({
  type,
  id,
  icon,
  title,
  subtitle,
  badges,
  stats,
  onAskAi,
  onDelete,
}: {
  type: string;
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  stats?: HeaderStat[];
  onAskAi?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className="border-b bg-surface px-6 pt-6 pb-0"
      data-agent-id={agentId.recordHeader(type, id)}
    >
      <div className="flex items-start gap-4">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
            {badges}
          </div>
          {subtitle && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onAskAi && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAskAi}
              className="gap-1.5"
              data-agent-id="record-ask-ai"
            >
              <Sparkles className="size-3.5 text-violet-500" /> Ask AI
            </Button>
          )}
          {onDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2 className="text-destructive" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {stats && stats.length > 0 && (
        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 pb-4">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="mt-0.5 text-sm font-medium">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
