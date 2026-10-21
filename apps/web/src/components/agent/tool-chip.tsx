"use client";

import { Check, Loader2, X } from "lucide-react";
import { motion } from "motion/react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { toolIcon } from "./tool-meta";

export function ToolChip({
  tool,
  label,
  status,
  summary,
}: {
  tool: string;
  label: string;
  status: "running" | "ok" | "error";
  summary?: string;
}) {
  const Icon = toolIcon(tool);
  const chip = (
    <motion.span
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-surface py-0.5 pr-2 pl-1 text-xs",
        status === "error" ? "border-destructive/30 text-destructive" : "text-muted-foreground",
      )}
      data-tool={tool}
      data-status={status}
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-full",
          status === "running"
            ? "bg-agent-soft text-violet-600"
            : status === "ok"
              ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/10",
        )}
      >
        {status === "running" ? (
          <Loader2 className="size-2.5 animate-spin" />
        ) : status === "ok" ? (
          <Check className="size-2.5" strokeWidth={3} />
        ) : (
          <X className="size-2.5" strokeWidth={3} />
        )}
      </span>
      <Icon className="size-3 shrink-0 opacity-70" />
      <span className={cn("truncate", status === "running" && "shimmer-text")}>{label}</span>
    </motion.span>
  );
  if (!summary) return chip;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent>{summary}</TooltipContent>
    </Tooltip>
  );
}
