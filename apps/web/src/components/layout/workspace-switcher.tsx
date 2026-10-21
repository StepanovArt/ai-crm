"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, LogOut, Monitor, Moon, RotateCcw, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout, useMe } from "@/hooks/use-auth";
import { api, unwrap } from "@/lib/api/client";
import { cn } from "@/lib/utils";

import { LogoMark } from "./logo";

const INDUSTRY_LABEL: Record<string, string> = {
  b2b_saas: "B2B SaaS",
  real_estate: "Real estate",
  industrial_equipment: "Industrial equipment",
  agency_services: "Agency services",
  recruitment: "Recruitment",
};

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { data: me } = useMe();
  const logout = useLogout();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const ws = me?.workspace;

  async function resetDemo() {
    await toast.promise(unwrap(api.POST("/api/v1/demo/reset")), {
      loading: "Resetting demo data…",
      success: "Demo workspace restored",
      error: "Could not reset demo data",
    });
    await qc.invalidateQueries();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1.5 text-left transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/40",
          collapsed && "justify-center px-0",
        )}
        data-agent-id="workspace-switcher"
      >
        <LogoMark />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-foreground">
                {ws?.name ?? "Workspace"}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-foreground">{ws?.name}</span>
          <span className="font-normal">
            {INDUSTRY_LABEL[ws?.industry ?? ""] ?? "Workspace"} · {me?.user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun /> Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <Sun /> Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon /> Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor /> System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {me?.user.email === "demo@halo.dev" && (
          <DropdownMenuItem onSelect={resetDemo}>
            <RotateCcw /> Reset demo data
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
