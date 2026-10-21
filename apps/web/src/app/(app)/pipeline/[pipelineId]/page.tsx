"use client";

import * as React from "react";
import { Suspense, use } from "react";
import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { MoneyText } from "@/components/common/money";
import { CloseFilter, closeBefore, ValueFilter } from "@/components/pipeline/board-filters";
import { Kanban } from "@/components/pipeline/kanban";
import { CreateDealDialog } from "@/components/records/create/create-deal-dialog";
import { OwnerFilter } from "@/components/records/table-toolbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBoard, useMoveDeal } from "@/hooks/use-board";
import { useKeySequences } from "@/hooks/use-hotkeys";
import { usePipelines } from "@/hooks/use-pipelines";
import { useTerms } from "@/hooks/use-workspace";
import { useBreadcrumb } from "@/stores/breadcrumb-store";

function BoardSkeleton() {
  return (
    <div className="flex gap-3 px-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="w-[284px] shrink-0 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-24" />
          <div className="space-y-2 rounded-xl bg-muted/50 p-2">
            {Array.from({ length: 3 - (i % 2) }).map((_, j) => (
              <Skeleton key={j} className="h-24 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PipelineBoard({ pipelineId }: { pipelineId: string }) {
  const t = useTerms();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: pipelines } = usePipelines();
  const pipeline = pipelines?.find((p) => p.id === pipelineId);
  const owner = params.get("owner") ?? undefined;
  const min = params.get("min") ?? "";
  const close = params.get("close") ?? "";
  const filter = React.useMemo(
    () => ({ owner_id: owner, value_min: min || undefined, close_before: closeBefore(close) }),
    [owner, min, close],
  );
  const { data: board, isLoading } = useBoard(pipelineId, filter);
  const move = useMoveDeal(pipelineId, filter);
  const [createStage, setCreateStage] = React.useState<string | null>(null);
  useBreadcrumb([{ label: t.pipeline }, { label: pipeline?.name ?? "" }]);
  useKeySequences(
    React.useMemo(() => ({ c: () => setCreateStage(pipeline?.stages[0]?.id ?? "") }), [pipeline]),
  );

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
  }

  const open = board?.columns.filter((c) => c.stage.kind === "open") ?? [];
  const openValue = open.reduce((s, c) => s + Number(c.total_value), 0);
  const weighted = open.reduce((s, c) => s + Number(c.weighted_value), 0);
  const openCount = open.reduce((s, c) => s + c.count, 0);
  const currency = board?.deals[0]?.currency ?? "USD";

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-5 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{pipeline?.name ?? t.pipeline}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <span>
              <span className="tabular">{openCount}</span> open{" "}
              {openCount === 1 ? t.deal.toLowerCase() : t.deals.toLowerCase()}
            </span>
            <span className="opacity-40">·</span>
            <MoneyText
              value={openValue}
              currency={currency}
              className="font-medium text-foreground"
            />
            <span className="opacity-40">·</span>
            <span>
              <MoneyText value={weighted} currency={currency} /> weighted
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OwnerFilter value={owner} onChange={(id) => setParam("owner", id)} />
          <ValueFilter value={min} onChange={(k) => setParam("min", k)} />
          <CloseFilter value={close} onChange={(k) => setParam("close", k)} />
          <Button size="sm" onClick={() => setCreateStage(pipeline?.stages[0]?.id ?? "")}>
            <Plus /> New {t.deal.toLowerCase()}
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {isLoading || !board ? (
          <BoardSkeleton />
        ) : (
          <Kanban
            board={board}
            onMove={(dealId, stageId, index) => move.mutate({ dealId, stageId, index })}
            onAdd={(stageId) => setCreateStage(stageId)}
          />
        )}
      </div>
      <CreateDealDialog
        open={createStage !== null}
        onOpenChange={(o) => !o && setCreateStage(null)}
        defaults={{ stage_id: createStage ?? undefined }}
      />
    </div>
  );
}

export default function PipelinePage({ params }: { params: Promise<{ pipelineId: string }> }) {
  const { pipelineId } = use(params);
  return (
    <Suspense>
      <PipelineBoard pipelineId={pipelineId} />
    </Suspense>
  );
}
