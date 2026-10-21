"use client";

import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";

export function PlaceholderPage({ title, icon }: { title: string; icon: LucideIcon }) {
  return (
    <div>
      <PageHeader title={title} />
      <EmptyState
        icon={icon}
        title={`${title} is being built`}
        hint="This screen arrives in the next phase."
      />
    </div>
  );
}
