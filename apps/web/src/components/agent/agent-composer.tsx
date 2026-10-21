"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/stores/agent-store";

export function AgentComposer({ contextLabel }: { contextLabel: string | null }) {
  const { send, stop, streaming } = useAgentStore();
  const [value, setValue] = React.useState("");
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function submit() {
    if (!value.trim() || streaming) return;
    void send(value);
    setValue("");
  }

  return (
    <div className="border-t bg-surface p-3">
      <div className="rounded-xl border bg-background shadow-xs transition-shadow focus-within:border-violet-400/60 focus-within:ring-[3px] focus-within:ring-violet-500/15">
        {contextLabel && (
          <p className="truncate px-3 pt-2 text-[11px] text-muted-foreground">
            Looking at <span className="font-medium text-foreground/80">{contextLabel}</span>
          </p>
        )}
        <textarea
          ref={ref}
          value={value}
          rows={1}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask Halo to find, summarize, move or plan…"
          aria-label="Message Halo AI"
          data-agent-id="agent-input"
          className="block max-h-40 w-full resize-none bg-transparent px-3 py-2.5 text-[13.5px] outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="pl-1 text-[11px] text-muted-foreground">↵ send · ⇧↵ new line</span>
          {streaming ? (
            <Button
              size="icon-xs"
              variant="outline"
              onClick={stop}
              aria-label="Stop"
              className="rounded-full"
            >
              <Square className="size-2.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon-xs"
              variant="agent"
              onClick={submit}
              disabled={!value.trim()}
              aria-label="Send"
              className={cn("rounded-full", !value.trim() && "opacity-40")}
            >
              <ArrowUp className="size-3.5" strokeWidth={2.5} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
