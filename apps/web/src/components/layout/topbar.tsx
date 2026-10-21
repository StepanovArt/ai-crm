"use client";

import { ChevronRight, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar } from "@/components/common/avatar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMe } from "@/hooks/use-auth";
import { useTerms } from "@/hooks/use-workspace";
import { agentId } from "@/lib/agent-ids";
import { cn } from "@/lib/utils";
import { useBreadcrumbStore, type Crumb } from "@/stores/breadcrumb-store";
import { useUIStore } from "@/stores/ui-store";

import { ThemeToggle } from "./theme-toggle";

function useDefaultCrumbs(): Crumb[] {
  const pathname = usePathname();
  const t = useTerms();
  const top: Record<string, string> = {
    today: "Today",
    pipeline: t.pipeline,
    deals: t.deals,
    companies: t.companies,
    contacts: t.contacts,
    tasks: "Tasks",
    settings: "Settings",
  };
  const seg = pathname.split("/").filter(Boolean)[0] ?? "today";
  return [{ label: top[seg] ?? "Halo" }];
}

export function Topbar() {
  const custom = useBreadcrumbStore((s) => s.crumbs);
  const fallback = useDefaultCrumbs();
  const crumbs = custom ?? fallback;
  const { data: me } = useMe();
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const agentOpen = useUIStore((s) => s.agentPanelOpen);
  const toggleAgent = useUIStore((s) => s.toggleAgentPanel);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-surface/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 text-[13px]">
        {crumbs.map((c, i) => (
          <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />}
            {c.href && i < crumbs.length - 1 ? (
              <Link
                href={c.href}
                className="truncate text-muted-foreground transition-colors hover:text-foreground"
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "truncate",
                  i === crumbs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        data-agent-id={agentId.search}
        className="hidden h-8 w-64 cursor-pointer items-center gap-2 rounded-md border bg-background px-2.5 text-[13px] text-muted-foreground shadow-xs transition-colors hover:border-border-strong hover:text-foreground md:flex"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search or ask AI…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="agent"
            size="sm"
            onClick={toggleAgent}
            data-agent-id={agentId.askAi}
            aria-pressed={agentOpen}
            className="gap-1.5 px-3"
          >
            <Sparkles className="size-3.5" />
            Ask AI
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Toggle the AI panel <span className="ml-1 opacity-70">⌘J</span>
        </TooltipContent>
      </Tooltip>

      <ThemeToggle />
      <Avatar name={me?.user.full_name} src={me?.user.avatar_url} size="sm" />
    </header>
  );
}
