"use client";

import * as React from "react";
import { Loader2, StickyNote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import type { RecordType } from "@/hooks/use-records";
import { useCreateNote } from "@/hooks/use-timeline";
import { cn } from "@/lib/utils";

export function NoteComposer({ type, id }: { type: RecordType; id: string }) {
  const [body, setBody] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const create = useCreateNote();
  const expanded = focused || body.length > 0;

  async function submit() {
    const text = body.trim();
    if (!text) return;
    await create.mutateAsync({ related_type: type, related_id: id, body: text });
    setBody("");
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-surface shadow-xs transition-shadow",
        focused && "border-ring/50 ring-[3px] ring-ring/15",
      )}
      data-agent-id="note-composer"
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="Write a note…"
        aria-label="Write a note"
        rows={expanded ? 3 : 1}
        className="min-h-0 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
      {expanded && (
        <div className="flex items-center justify-between border-t px-2.5 py-1.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <StickyNote className="size-3.5" /> Visible to your workspace
          </span>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              <Kbd>⌘</Kbd> <Kbd>↵</Kbd>
            </span>
            <Button
              size="xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void submit()}
              disabled={!body.trim() || create.isPending}
            >
              {create.isPending && <Loader2 className="animate-spin" />}
              Add note
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
