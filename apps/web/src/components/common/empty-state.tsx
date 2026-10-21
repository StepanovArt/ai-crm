import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 py-8" : "gap-3 py-16",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border bg-surface text-muted-foreground shadow-xs",
          compact ? "size-9" : "size-11",
        )}
      >
        <Icon className={compact ? "size-4" : "size-5"} strokeWidth={1.75} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {hint && <p className="max-w-xs text-[13px] text-muted-foreground">{hint}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
