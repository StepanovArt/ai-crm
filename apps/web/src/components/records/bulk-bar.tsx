"use client";

import { AnimatePresence, motion } from "motion/react";
import { Trash2, UserRoundPen, X } from "lucide-react";

import { Avatar } from "@/components/common/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMembers } from "@/hooks/use-workspace";

export function BulkBar({
  count,
  onClear,
  onDelete,
  onAssign,
  busy,
}: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onAssign: (ownerId: string) => void;
  busy?: boolean;
}) {
  const { list } = useMembers();
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl border bg-popover p-1.5 pl-3 shadow-pop"
          role="toolbar"
          aria-label="Bulk actions"
        >
          <span className="mr-2 text-[13px] font-medium tabular">{count} selected</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={busy}>
                <UserRoundPen /> Assign owner
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-52">
              {list.map((m) => (
                <DropdownMenuItem key={m.id} onSelect={() => onAssign(m.id)}>
                  <Avatar name={m.full_name} size="xs" /> {m.full_name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={busy}
          >
            <Trash2 /> Delete
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear selection">
            <X />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
