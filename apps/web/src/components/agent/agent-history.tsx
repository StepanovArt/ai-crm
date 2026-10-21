"use client";

import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, unwrap } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import { qk } from "@/lib/query-keys";
import { useAgentStore } from "@/stores/agent-store";

export function AgentHistory() {
  const load = useAgentStore((s) => s.load);
  const { data, refetch } = useQuery({
    queryKey: qk.agent.conversations(),
    queryFn: () => unwrap(api.GET("/api/v1/agent/conversations")),
    enabled: false,
  });
  return (
    <DropdownMenu onOpenChange={(open) => open && void refetch()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Conversation history"
          className="text-muted-foreground"
        >
          <History />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Recent conversations</DropdownMenuLabel>
        {(data ?? []).length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">No conversations yet.</p>
        )}
        {(data ?? []).slice(0, 12).map((c) => (
          <DropdownMenuItem
            key={c.id}
            onSelect={() => void load(c.id)}
            className="flex-col items-start gap-0"
          >
            <span className="w-full truncate">{c.title}</span>
            <span className="text-[11px] text-muted-foreground">
              {formatRelative(c.updated_at)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
