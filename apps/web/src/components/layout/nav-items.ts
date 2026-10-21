import {
  Building2,
  CircleDollarSign,
  ListChecks,
  Settings,
  SquareKanban,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Terminology } from "@/hooks/use-workspace";

export type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
};

export function navItems(t: Terminology): NavItem[] {
  return [
    { key: "today", href: "/today", label: "Today", icon: Sun, shortcut: "G T" },
    { key: "pipeline", href: "/pipeline", label: t.pipeline, icon: SquareKanban, shortcut: "G P" },
    { key: "deals", href: "/deals", label: t.deals, icon: CircleDollarSign, shortcut: "G D" },
    { key: "companies", href: "/companies", label: t.companies, icon: Building2, shortcut: "G O" },
    { key: "contacts", href: "/contacts", label: t.contacts, icon: Users, shortcut: "G C" },
    { key: "tasks", href: "/tasks", label: "Tasks", icon: ListChecks, shortcut: "G K" },
  ];
}

export const settingsItem: Omit<NavItem, "label"> & { label: string } = {
  key: "settings",
  href: "/settings",
  label: "Settings",
  icon: Settings,
  shortcut: "G S",
};
