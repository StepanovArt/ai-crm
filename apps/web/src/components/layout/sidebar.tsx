"use client";

import { useQuery } from "@tanstack/react-query";
import { PanelLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMe } from "@/hooks/use-auth";
import { useTerms } from "@/hooks/use-workspace";
import { agentId } from "@/lib/agent-ids";
import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";

import { navItems, settingsItem, type NavItem } from "./nav-items";
import { WorkspaceSwitcher } from "./workspace-switcher";

function useOverdueCount() {
  const { data: me } = useMe();
  const filter = { bucket: "overdue", assignee_id: me?.user.id };
  const { data } = useQuery({
    queryKey: qk.tasks.list({ filter, limit: 1 }),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/tasks", {
          params: { query: { filter: JSON.stringify(filter), limit: 1 } },
        }),
      ),
    enabled: Boolean(me),
  });
  return data?.total ?? 0;
}

function NavLink({
  item,
  active,
  collapsed,
  badge,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  badge?: number;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      data-agent-id={agentId.nav(item.key)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
        )}
        strokeWidth={1.9}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && badge ? (
        <span className="ml-auto rounded-full bg-rose-500/12 px-1.5 text-[11px] font-semibold text-rose-600 tabular dark:text-rose-300">
          {badge}
        </span>
      ) : null}
      {collapsed && badge ? (
        <span className="absolute top-1 right-1.5 size-1.5 rounded-full bg-rose-500" />
      ) : null}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const terms = useTerms();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);
  const overdue = useOverdueCount();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out",
        collapsed ? "w-14" : "w-60",
      )}
      data-agent-id="sidebar"
    >
      <div className={cn("flex h-12 items-center gap-1 px-2.5", collapsed && "flex-col px-2")}>
        <WorkspaceSwitcher collapsed={collapsed} />
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-label="Collapse sidebar"
            className="text-muted-foreground"
          >
            <PanelLeft />
          </Button>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2.5 pt-2" aria-label="Main">
        {navItems(terms).map((item) => (
          <NavLink
            key={item.key}
            item={item}
            active={isActive(item.href)}
            collapsed={collapsed}
            badge={item.key === "tasks" ? overdue : undefined}
          />
        ))}
      </nav>
      <div className="flex flex-col gap-0.5 px-2.5 pb-3">
        <NavLink item={settingsItem} active={isActive("/settings")} collapsed={collapsed} />
        {collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-label="Expand sidebar"
            className="mx-auto mt-1 text-muted-foreground"
          >
            <PanelLeft />
          </Button>
        )}
      </div>
    </aside>
  );
}
