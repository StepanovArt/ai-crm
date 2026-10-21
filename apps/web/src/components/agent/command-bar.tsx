"use client";

import * as React from "react";
import { Building2, CircleDollarSign, Keyboard, Moon, Plus, Sparkles, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import { navItems, settingsItem } from "@/components/layout/nav-items";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { usePageContext } from "@/hooks/use-page-context";
import { useCompanies, useContacts, useDeals } from "@/hooks/use-records";
import { useTerms } from "@/hooks/use-workspace";
import { useAgentStore } from "@/stores/agent-store";
import { useUIStore } from "@/stores/ui-store";

import { useSuggestedPrompts } from "./suggested-prompts";

function useDebounced<T>(value: T, ms = 180) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function RecordResults({ q, onPick }: { q: string; onPick: (href: string) => void }) {
  const t = useTerms();
  const enabled = q.length >= 2;
  const args = { q, limit: 4 };
  const deals = useDeals(args, { enabled });
  const companies = useCompanies(args, { enabled });
  const contacts = useContacts(args, { enabled });
  if (!enabled) return null;
  const groups = [
    {
      label: t.deals,
      icon: CircleDollarSign,
      items: (deals.data?.items ?? []).map((d) => ({
        id: d.id,
        title: d.name,
        sub: d.stage?.name,
        href: `/records/deal/${d.id}`,
      })),
    },
    {
      label: t.companies,
      icon: Building2,
      items: (companies.data?.items ?? []).map((c) => ({
        id: c.id,
        title: c.name,
        sub: c.domain,
        href: `/records/company/${c.id}`,
      })),
    },
    {
      label: t.contacts,
      icon: User,
      items: (contacts.data?.items ?? []).map((c) => ({
        id: c.id,
        title: c.full_name,
        sub: c.company?.name,
        href: `/records/contact/${c.id}`,
      })),
    },
  ];
  return (
    <>
      {groups
        .filter((g) => g.items.length)
        .map(({ label, icon: Icon, items }) => (
          <CommandGroup key={label} heading={label}>
            {items.map((i) => (
              <CommandItem key={i.id} value={`${label}-${i.id}`} onSelect={() => onPick(i.href)}>
                <Icon />
                <span className="truncate">{i.title}</span>
                {i.sub && (
                  <span className="ml-auto truncate text-xs text-muted-foreground">{i.sub}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
    </>
  );
}

export function CommandBar() {
  const open = useUIStore((s) => s.commandOpen);
  const setOpen = useUIStore((s) => s.setCommandOpen);
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);
  const send = useAgentStore((s) => s.send);
  const router = useRouter();
  const t = useTerms();
  const ctx = usePageContext();
  const prompts = useSuggestedPrompts(ctx);
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = React.useState("");
  const q = useDebounced(query.trim());

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }
  function ask(text: string) {
    setOpen(false);
    void send(text);
  }

  const lower = query.trim().toLowerCase();
  const nav = [...navItems(t), settingsItem].filter(
    (n) => !lower || n.label.toLowerCase().includes(lower),
  );
  const create = [
    { label: `New ${t.deal.toLowerCase()}`, href: "/deals?create=1" },
    { label: `New ${t.company.toLowerCase()}`, href: "/companies?create=1" },
    { label: `New ${t.contact.toLowerCase()}`, href: "/contacts?create=1" },
  ].filter((c) => !lower || c.label.toLowerCase().includes(lower));
  const actions = [
    {
      key: "theme",
      label: "Toggle dark mode",
      icon: Moon,
      hint: null,
      run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    },
    {
      key: "shortcuts",
      label: "Keyboard shortcuts",
      icon: Keyboard,
      hint: "?",
      run: () => setShortcutsOpen(true),
    },
  ].filter((a) => !lower || `${a.label} ${a.key}`.toLowerCase().includes(lower));
  const matchingPrompts = prompts.filter((p) => !lower || p.toLowerCase().includes(lower));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="top-[18%] translate-y-0 overflow-hidden p-0 sm:max-w-xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Search or ask AI</DialogTitle>
        <Command shouldFilter={false} loop>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search records, jump to a page, or ask Halo…"
            data-agent-id="command-input"
          />
          <CommandList>
            <CommandEmpty>Nothing found — press Enter to ask Halo.</CommandEmpty>
            {query.trim() && (
              <CommandGroup heading="Ask AI">
                <CommandItem
                  value="__ask__"
                  onSelect={() => ask(query)}
                  data-agent-id="command-ask-ai"
                >
                  <span className="flex size-5 items-center justify-center rounded-md bg-agent text-white">
                    <Sparkles className="size-3 text-white" />
                  </span>
                  <span className="truncate">
                    Ask Halo: <span className="font-medium">“{query.trim()}”</span>
                  </span>
                  <Kbd className="ml-auto">↵</Kbd>
                </CommandItem>
              </CommandGroup>
            )}
            {matchingPrompts.length > 0 && (
              <CommandGroup heading={query.trim() ? "Suggested" : "Ask AI"}>
                {matchingPrompts.map((p) => (
                  <CommandItem key={p} value={`prompt-${p}`} onSelect={() => ask(p)}>
                    <Sparkles className="text-violet-500" />
                    <span className="truncate">{p}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <RecordResults q={q} onPick={go} />
            {nav.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Go to">
                  {nav.map((n) => (
                    <CommandItem key={n.key} value={`nav-${n.key}`} onSelect={() => go(n.href)}>
                      <n.icon />
                      {n.label}
                      {n.shortcut && (
                        <span className="ml-auto text-xs tracking-widest text-muted-foreground">
                          {n.shortcut}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {(create.length > 0 || actions.length > 0) && (
              <CommandGroup heading="Actions">
                {create.map((c) => (
                  <CommandItem key={c.href} value={c.href} onSelect={() => go(c.href)}>
                    <Plus />
                    {c.label}
                  </CommandItem>
                ))}
                {actions.map((a) => (
                  <CommandItem
                    key={a.key}
                    value={a.key}
                    onSelect={() => {
                      setOpen(false);
                      a.run();
                    }}
                  >
                    <a.icon />
                    {a.label}
                    {a.hint && <Kbd className="ml-auto">{a.hint}</Kbd>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
            </span>
            <span>
              <Kbd>↵</Kbd> select
            </span>
            <span className="ml-auto">
              <Kbd>⌘</Kbd> <Kbd>J</Kbd> AI panel
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
