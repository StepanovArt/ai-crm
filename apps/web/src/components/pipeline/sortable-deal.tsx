"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";

import type { BoardDeal } from "@/hooks/use-board";
import { agentId } from "@/lib/agent-ids";
import { cn } from "@/lib/utils";

import { DealCardBody } from "./deal-card";

export function SortableDeal({ deal, animateLayout }: { deal: BoardDeal; animateLayout: boolean }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { stageId: deal.stage_id },
  });
  return (
    // Outer motion layer animates cross-column moves (e.g. the agent's move_card);
    // inner layer carries dnd-kit's drag transforms.
    <motion.div
      layout={animateLayout ? "position" : false}
      layoutId={animateLayout ? `deal-${deal.id}` : undefined}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
    >
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        data-agent-id={agentId.dealCard(deal.id)}
        className={cn(
          "cursor-grab touch-none outline-none active:cursor-grabbing",
          isDragging && "opacity-35",
        )}
        onClick={() => router.push(`/records/deal/${deal.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter") router.push(`/records/deal/${deal.id}`);
        }}
        {...attributes}
        {...listeners}
        aria-label={`${deal.name}, open deal`}
      >
        <DealCardBody deal={deal} />
      </div>
    </motion.div>
  );
}
