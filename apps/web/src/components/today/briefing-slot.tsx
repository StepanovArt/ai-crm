import { Sparkles } from "lucide-react";

import { agentId } from "@/lib/agent-ids";

/** Placeholder until the streamed AI briefing lands (Phase 7). */
export function BriefingSlot({ children }: { children?: React.ReactNode }) {
  return (
    <section
      data-agent-id={agentId.briefing}
      className="relative overflow-hidden rounded-xl border border-agent p-px"
      aria-label="AI briefing"
    >
      <div className="rounded-[11px] bg-surface px-5 py-4">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <span className="flex size-6 items-center justify-center rounded-md bg-agent text-white">
            <Sparkles className="size-3.5" />
          </span>
          <span className="text-agent">AI briefing</span>
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          {children ?? "Your daily briefing will appear here."}
        </div>
      </div>
    </section>
  );
}
