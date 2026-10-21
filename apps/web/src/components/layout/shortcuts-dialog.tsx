"use client";

import * as React from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useTerms } from "@/hooks/use-workspace";
import { useUIStore } from "@/stores/ui-store";

type Shortcut = { keys: string[]; label: string; then?: boolean };

function useModLabel() {
  const [mod, setMod] = React.useState("⌘");
  React.useEffect(() => {
    if (!/mac|iphone|ipad/i.test(navigator.userAgent)) setMod("Ctrl");
  }, []);
  return mod;
}

export function ShortcutsDialog() {
  const open = useUIStore((s) => s.shortcutsOpen);
  const setOpen = useUIStore((s) => s.setShortcutsOpen);
  const t = useTerms();
  const mod = useModLabel();

  const groups: { title: string; items: Shortcut[] }[] = [
    {
      title: "General",
      items: [
        { keys: [mod, "K"], label: "Search, jump or ask AI" },
        { keys: [mod, "J"], label: "Open or close the AI panel" },
        { keys: ["C"], label: "New record on this page" },
        { keys: ["?"], label: "Show keyboard shortcuts" },
        { keys: ["Esc"], label: "Close dialogs and popovers" },
      ],
    },
    {
      title: "Go to",
      items: [
        { keys: ["G", "T"], label: "Today", then: true },
        { keys: ["G", "P"], label: t.pipeline, then: true },
        { keys: ["G", "D"], label: t.deals, then: true },
        { keys: ["G", "O"], label: t.companies, then: true },
        { keys: ["G", "C"], label: t.contacts, then: true },
        { keys: ["G", "K"], label: "Tasks", then: true },
        { keys: ["G", "S"], label: "Settings", then: true },
      ],
    },
    {
      title: "AI panel",
      items: [
        { keys: ["Enter"], label: "Send message" },
        { keys: ["Shift", "Enter"], label: "New line" },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>Halo is built to be driven from the keyboard.</DialogDescription>
        <div className="mt-2 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {groups.map((group) => (
            <section
              key={group.title}
              className={group.title === "Go to" ? "sm:row-span-2" : undefined}
            >
              <h3 className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-center gap-3 text-[13px]">
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      {item.keys.map((k, i) => (
                        <React.Fragment key={k}>
                          {i > 0 && item.then && <span>then</span>}
                          <Kbd>{k}</Kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
