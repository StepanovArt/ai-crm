"use client";

import * as React from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

function Row({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-2 bg-surface",
        isDragging && "relative z-10 rounded-lg shadow-pop",
      )}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Vertical drag-to-reorder list with handles. Calls onReorder with the new id order. */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  render,
  className,
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  render: (item: T) => React.ReactNode;
  className?: string;
}) {
  const [order, setOrder] = React.useState(items.map((i) => i.id));
  React.useEffect(() => setOrder(items.map((i) => i.id)), [items]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    onReorder(next);
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {order.map((id) => {
            const item = byId.get(id);
            return item ? (
              <Row key={id} id={id}>
                {render(item)}
              </Row>
            ) : null;
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
