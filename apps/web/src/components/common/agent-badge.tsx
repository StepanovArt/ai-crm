import { Sparkles } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Small sparkle marking things the AI agent created or touched. */
export function AgentBadge({
  label = "Done by Halo AI",
  className,
  withText = false,
}: {
  label?: string;
  className?: string;
  withText?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full bg-agent-soft px-1 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300",
            className,
          )}
          aria-label={label}
          data-agent-badge
        >
          <Sparkles className="size-3 text-violet-500" strokeWidth={2.25} />
          {withText && <span className="pr-0.5">AI</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
