"use client";

import * as React from "react";
import { Check, Copy, Mail, StickyNote } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCreateNote } from "@/hooks/use-timeline";
import type { EmailDraftData } from "@/lib/agent/types";

export function EmailDraftCard({ data }: { data: EmailDraftData }) {
  const save = useCreateNote();
  const [copied, setCopied] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const text = `Subject: ${data.subject}\n\n${data.body}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  }

  async function saveNote() {
    await save.mutateAsync({
      related_type: data.related_type as "company" | "contact" | "deal",
      related_id: data.related_id,
      body: `Email draft — ${data.subject}\n\n${data.body}`,
    });
    setSaved(true);
    toast.success(`Saved to ${data.to_name}'s timeline`);
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-surface" data-card="email_draft">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Mail className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Email draft
        </span>
      </div>
      <div className="space-y-1 px-3 pt-2.5 text-[13px]">
        <p className="truncate">
          <span className="text-muted-foreground">To </span>
          <span className="font-medium">{data.to_name}</span>
          {data.to && <span className="text-muted-foreground"> &lt;{data.to}&gt;</span>}
        </p>
        <p className="truncate">
          <span className="text-muted-foreground">Subject </span>
          <span className="font-medium">{data.subject}</span>
        </p>
      </div>
      <p
        className="mx-3 mt-2.5 mb-3 rounded-lg bg-muted/50 px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap"
        data-draft-body
      >
        {data.body}
      </p>
      <div className="flex items-center gap-1.5 border-t px-2 py-1.5">
        <Button size="xs" variant="ghost" onClick={copy}>
          {copied ? <Check className="text-emerald-500" /> : <Copy />} {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={saveNote}
          disabled={saved || save.isPending}
          data-agent-id="draft-save-note"
        >
          {saved ? <Check className="text-emerald-500" /> : <StickyNote />}{" "}
          {saved ? "Saved as note" : "Save as note"}
        </Button>
        {data.to && (
          <Button size="xs" variant="ghost" asChild className="ml-auto text-muted-foreground">
            <a
              href={`mailto:${data.to}?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.body)}`}
            >
              Open in mail
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
