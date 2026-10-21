"use client";

import { Suspense } from "react";
import { CircleDollarSign, Layers } from "lucide-react";

import { AgentBadge } from "@/components/common/agent-badge";
import { ColorDot } from "@/components/common/status-badge";
import { CreateDealDialog } from "@/components/records/create/create-deal-dialog";
import { RecordTablePage } from "@/components/records/record-table-page";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFields } from "@/hooks/use-fields";
import { usePipelines, type Stage } from "@/hooks/use-pipelines";
import { useDeals } from "@/hooks/use-records";
import { useTerms } from "@/hooks/use-workspace";
import { dealDescriptors } from "@/lib/records/descriptors";
import { cn } from "@/lib/utils";

function StageFilter({
  stages,
  value,
  onChange,
}: {
  stages: Stage[];
  value?: string;
  onChange: (v?: string) => void;
}) {
  const current = stages.find((s) => s.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-7 gap-1.5", current && "border-primary/40 bg-primary/5")}
        >
          {current ? <ColorDot color={current.color} /> : <Layers className="size-3.5" />}
          {current?.name ?? "Stage"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onSelect={() => onChange(undefined)}>Any stage</DropdownMenuItem>
        <DropdownMenuSeparator />
        {stages.map((s) => (
          <DropdownMenuItem key={s.id} onSelect={() => onChange(s.id)}>
            <ColorDot color={s.color} /> {s.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DealsTable() {
  const t = useTerms();
  const { data: defs } = useFields("deal");
  const { data: pipelines } = usePipelines();
  if (!defs || !pipelines) return null;
  const stages = pipelines.flatMap((p) => p.stages);
  return (
    <RecordTablePage
      type="deal"
      title={t.deals}
      singular={t.deal}
      icon={CircleDollarSign}
      descriptors={dealDescriptors(defs, t, stages)}
      useRows={useDeals}
      renderPrimary={(d) => (
        <span className="flex min-w-0 items-center gap-2">
          <ColorDot color={d.stage?.color ?? "slate"} />
          <span className="truncate font-medium">{d.name}</span>
          {d.agent_touched_at && <AgentBadge label="Recently updated by Halo AI" />}
        </span>
      )}
      createDialog={(open, setOpen) => <CreateDealDialog open={open} onOpenChange={setOpen} />}
      extraFilters={(filter, set) => (
        <StageFilter
          stages={stages}
          value={filter.stage_id as string | undefined}
          onChange={(v) => set("stage_id", v)}
        />
      )}
    />
  );
}

export default function DealsPage() {
  return (
    <Suspense>
      <DealsTable />
    </Suspense>
  );
}
