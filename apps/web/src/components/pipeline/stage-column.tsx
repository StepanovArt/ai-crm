"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import { MoneyText } from "@/components/common/money";
import { ColorDot } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import type { Board, BoardDeal } from "@/hooks/use-board";
import { agentId } from "@/lib/agent-ids";
import { cn } from "@/lib/utils";

import { SortableDeal } from "./sortable-deal";

type Column = Board["columns"][number];

export function StageColumn({
  column,
  deals,
  currency,
  animateLayout,
  onAdd,
}: {
  column: Column;
  deals: BoardDeal[];
  currency: string;
  animateLayout: boolean;
  onAdd: (stageId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.stage.id,
    data: { stageId: column.stage.id },
  });
  const closed = column.stage.kind !== "open";
  return (
    <section
      data-agent-id={agentId.stageColumn(column.stage.id)}
      className="flex h-full w-[284px] shrink-0 flex-col"
      aria-label={`${column.stage.name} column`}
    >
      <header className="px-1 pb-2.5">
        <div className="flex items-center gap-2">
          <ColorDot color={column.stage.color} />
          <h2 className="truncate text-[13px] font-semibold">{column.stage.name}</h2>
          <span className="text-xs text-muted-foreground tabular">{column.count}</span>
          <div className="flex-1" />
          {!closed && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Add deal to ${column.stage.name}`}
              onClick={() => onAdd(column.stage.id)}
              className="text-muted-foreground"
            >
              <Plus />
            </Button>
          )}
        </div>
        <div className="mt-1 flex items-baseline gap-1.5 pl-4 text-xs text-muted-foreground">
          <MoneyText
            value={column.total_value}
            currency={currency}
            compact
            className="font-medium text-foreground/80"
          />
          {!closed && (
            <>
              <span className="opacity-50">·</span>
              <MoneyText value={column.weighted_value} currency={currency} compact />
              <span>weighted</span>
            </>
          )}
          <span className="ml-auto pr-1 opacity-60">{column.stage.probability}%</span>
        </div>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-xl bg-muted/50 p-2 transition-colors dark:bg-zinc-900/60",
          isOver && "bg-primary/[0.06] ring-1 ring-primary/25 ring-inset",
        )}
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((d) => (
            <SortableDeal key={d.id} deal={d} animateLayout={animateLayout} />
          ))}
        </SortableContext>
        {deals.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-8 text-xs text-muted-foreground">
            Drop deals here
          </div>
        )}
      </div>
    </section>
  );
}
