import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export function AgentAvatar({
  className,
  pulsing = false,
}: {
  className?: string;
  pulsing?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative flex size-6 shrink-0 items-center justify-center rounded-lg bg-agent text-white shadow-sm",
        className,
      )}
    >
      {pulsing && <span className="absolute inset-0 animate-ping rounded-lg bg-violet-400/40" />}
      <Sparkles className="relative size-3.5" strokeWidth={2.25} />
    </span>
  );
}
