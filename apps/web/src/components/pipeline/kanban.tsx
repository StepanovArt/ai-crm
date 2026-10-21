"use client";

import * as React from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { LayoutGroup } from "motion/react";

import type { Board, BoardDeal } from "@/hooks/use-board";

import { DealCardBody } from "./deal-card";
import { StageColumn } from "./stage-column";

type Items = Record<string, string[]>;

function toItems(board: Board): Items {
  const items: Items = {};
  for (const c of board.columns) items[c.stage.id] = [];
  const sorted = [...board.deals].sort((a, b) => a.position - b.position);
  for (const d of sorted) (items[d.stage_id] ??= []).push(d.id);
  return items;
}

function findContainer(items: Items, id: string): string | undefined {
  if (id in items) return id;
  return Object.keys(items).find((k) => items[k]!.includes(id));
}

export function Kanban({
  board,
  onMove,
  onAdd,
}: {
  board: Board;
  onMove: (dealId: string, stageId: string, index: number) => void;
  onAdd: (stageId: string) => void;
}) {
  const [items, setItems] = React.useState<Items>(() => toItems(board));
  const [activeId, setActiveId] = React.useState<string | null>(null);
  // Layout animations are off while dragging (dnd-kit owns transforms) and for a beat after drop.
  const [settling, setSettling] = React.useState(false);
  const startContainer = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!activeId) setItems(toItems(board));
  }, [board, activeId]);

  const dealsById = React.useMemo(() => new Map(board.deals.map((d) => [d.id, d])), [board.deals]);
  const currency = board.deals[0]?.currency ?? "USD";
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    setActiveId(id);
    startContainer.current = findContainer(items, id) ?? null;
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeKey = String(active.id);
    const overKey = String(over.id);
    const from = findContainer(items, activeKey);
    const to = findContainer(items, overKey);
    if (!from || !to || from === to) return;
    setItems((prev) => {
      const source = prev[from]!.filter((id) => id !== activeKey);
      const target = [...prev[to]!];
      const overIndex = target.indexOf(overKey);
      const isBelow =
        over.rect && active.rect.current.translated
          ? active.rect.current.translated.top > over.rect.top + over.rect.height / 2
          : false;
      const index = overIndex >= 0 ? overIndex + (isBelow ? 1 : 0) : target.length;
      target.splice(index, 0, activeKey);
      return { ...prev, [from]: source, [to]: target };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const activeKey = String(active.id);
    setActiveId(null);
    setSettling(true);
    window.setTimeout(() => setSettling(false), 250);
    if (!over) {
      setItems(toItems(board));
      return;
    }
    const container = findContainer(items, activeKey);
    if (!container) return;
    let list = items[container]!;
    const overKey = String(over.id);
    const oldIndex = list.indexOf(activeKey);
    const overIndex = list.indexOf(overKey);
    if (overIndex >= 0 && oldIndex !== overIndex) {
      list = arrayMove(list, oldIndex, overIndex);
      setItems((prev) => ({ ...prev, [container]: list }));
    }
    const index = list.indexOf(activeKey);
    const original = toItems(board);
    const unchanged =
      startContainer.current === container && original[container]!.indexOf(activeKey) === index;
    if (!unchanged) onMove(activeKey, container, index);
  }

  const active = activeId ? dealsById.get(activeId) : undefined;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setItems(toItems(board));
      }}
    >
      <LayoutGroup>
        <div className="flex h-full gap-3 overflow-x-auto px-6 pb-6">
          {board.columns.map((c) => (
            <StageColumn
              key={c.stage.id}
              column={c}
              currency={currency}
              animateLayout={!activeId && !settling}
              deals={(items[c.stage.id] ?? [])
                .map((id) => dealsById.get(id))
                .filter((d): d is BoardDeal => Boolean(d))}
              onAdd={onAdd}
            />
          ))}
        </div>
      </LayoutGroup>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {active ? <DealCardBody deal={active} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
