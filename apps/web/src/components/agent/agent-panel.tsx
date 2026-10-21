"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { SquarePen, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMe } from "@/hooks/use-auth";
import { usePageContext } from "@/hooks/use-page-context";
import { useBreadcrumbStore } from "@/stores/breadcrumb-store";
import { useAgentStore } from "@/stores/agent-store";
import { useUIStore } from "@/stores/ui-store";

import { AgentAvatar } from "./agent-avatar";
import { AgentComposer } from "./agent-composer";
import { AgentHistory } from "./agent-history";
import { AgentMessageView } from "./agent-message";
import { useSuggestedPrompts } from "./suggested-prompts";

function useStickToBottom(dep: unknown) {
  const ref = React.useRef<HTMLDivElement>(null);
  const pinned = React.useRef(true);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}

function EmptyState() {
  const { data: me } = useMe();
  const ctx = usePageContext();
  const prompts = useSuggestedPrompts(ctx);
  const send = useAgentStore((s) => s.send);
  return (
    <div className="flex h-full flex-col justify-end gap-5 px-1 pb-2">
      <div>
        <AgentAvatar className="size-9 rounded-xl [&_svg]:size-5" />
        <p className="mt-3 text-[17px] font-semibold tracking-tight">
          How can I help, {me?.user.full_name.split(" ")[0] ?? "there"}?
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          I can see what you&apos;re looking at. I&apos;ll always show a plan before changing
          anything — and every change can be undone.
        </p>
      </div>
      <div className="space-y-1.5" data-agent-id="agent-suggestions">
        {prompts.map((p) => (
          <button
            key={p}
            onClick={() => void send(p)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg border bg-surface px-3 py-2 text-left text-[13px] transition-colors hover:border-violet-300 hover:bg-agent-soft dark:hover:border-violet-500/40"
          >
            <span className="text-agent">✦</span>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResizeHandle() {
  const setWidth = useUIStore((s) => s.setAgentPanelWidth);
  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const move = (ev: PointerEvent) => setWidth(window.innerWidth - ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize AI panel"
      onPointerDown={onPointerDown}
      className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize after:absolute after:inset-y-0 after:left-1 after:w-px after:bg-transparent after:transition-colors hover:after:bg-violet-400/60"
    />
  );
}

export function AgentPanel() {
  const open = useUIStore((s) => s.agentPanelOpen);
  const width = useUIStore((s) => s.agentPanelWidth);
  const setOpen = useUIStore((s) => s.setAgentPanelOpen);
  const { messages, reset, streaming } = useAgentStore();
  const crumbs = useBreadcrumbStore((s) => s.crumbs);
  const contextLabel = crumbs && crumbs.length > 1 ? crumbs[crumbs.length - 1]!.label : null;
  const lastText = messages[messages.length - 1];
  const scrollRef = useStickToBottom(lastText);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="agent-panel"
          data-agent-id="agent-panel"
          aria-label="Halo AI"
          initial={{ width: 0, opacity: 0.6 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0.6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative z-30 flex shrink-0 flex-col border-l bg-surface max-[1100px]:fixed max-[1100px]:inset-y-0 max-[1100px]:right-0 max-[1100px]:shadow-pop"
        >
          <ResizeHandle />
          <div className="flex h-full min-w-[360px] flex-col" style={{ width }}>
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
              <AgentAvatar />
              <span className="text-[13px] font-semibold">Halo AI</span>
              {streaming && <span className="shimmer-text text-xs">working…</span>}
              <div className="ml-auto flex items-center gap-0.5">
                <AgentHistory />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="New conversation"
                      onClick={reset}
                      className="text-muted-foreground"
                    >
                      <SquarePen />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New conversation</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Close AI panel"
                      onClick={() => setOpen(false)}
                      className="text-muted-foreground"
                    >
                      <X />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Close ⌘J</TooltipContent>
                </Tooltip>
              </div>
            </header>
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [overflow-anchor:none]"
            >
              {messages.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-5">
                  {messages.map((m) => (
                    <AgentMessageView key={m.id} message={m} />
                  ))}
                </div>
              )}
            </div>
            <AgentComposer contextLabel={contextLabel} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
