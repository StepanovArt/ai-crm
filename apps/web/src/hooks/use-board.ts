"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, filterParam, unwrap, type Schemas } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";

export type Board = Schemas["BoardOut"];
export type BoardDeal = Board["deals"][number];

export function useBoard(pipelineId: string, filter: Record<string, unknown>) {
  return useQuery({
    queryKey: qk.pipelines.board(pipelineId, filter),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/pipelines/{pipeline_id}/board", {
          params: { path: { pipeline_id: pipelineId }, query: { filter: filterParam(filter) } },
        }),
      ),
    enabled: Boolean(pipelineId),
  });
}

/** Re-order a deal inside a board snapshot and recompute column totals (pure, for optimistic UI). */
export function applyMove(board: Board, dealId: string, toStageId: string, index: number): Board {
  const deal = board.deals.find((d) => d.id === dealId);
  if (!deal) return board;
  const stage = board.columns.find((c) => c.stage.id === toStageId)?.stage;
  const column = board.deals
    .filter((d) => d.stage_id === toStageId && d.id !== dealId)
    .sort((a, b) => a.position - b.position);
  const clamped = Math.max(0, Math.min(index, column.length));
  const before = column[clamped - 1]?.position;
  const after = column[clamped]?.position;
  const position =
    before === undefined && after === undefined
      ? 0
      : before === undefined
        ? after! - 1000
        : after === undefined
          ? before + 1000
          : (before + after) / 2;
  const moved: BoardDeal = {
    ...deal,
    stage_id: toStageId,
    position,
    stage: stage
      ? {
          id: stage.id,
          name: stage.name,
          color: stage.color,
          kind: stage.kind,
          probability: stage.probability,
          position: stage.position,
        }
      : deal.stage,
    stage_entered_at:
      deal.stage_id === toStageId ? deal.stage_entered_at : new Date().toISOString(),
  };
  const deals = board.deals.map((d) => (d.id === dealId ? moved : d));
  const columns = board.columns.map((c) => {
    const inCol = deals.filter((d) => d.stage_id === c.stage.id);
    const total = inCol.reduce((s, d) => s + Number(d.value), 0);
    return {
      ...c,
      count: inCol.length,
      total_value: total.toFixed(2),
      weighted_value: ((total * c.stage.probability) / 100).toFixed(2),
    };
  });
  return { ...board, deals, columns };
}

export function useMoveDeal(pipelineId: string, filter: Record<string, unknown>) {
  const qc = useQueryClient();
  const key = qk.pipelines.board(pipelineId, filter);
  return useMutation({
    mutationFn: ({ dealId, stageId, index }: { dealId: string; stageId: string; index: number }) =>
      unwrap(
        api.PATCH("/api/v1/deals/{deal_id}/move", {
          params: { path: { deal_id: dealId } },
          body: { stage_id: stageId, index },
        }),
      ),
    onMutate: async ({ dealId, stageId, index }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Board>(key);
      if (previous) qc.setQueryData<Board>(key, applyMove(previous, dealId, stageId, index));
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(e instanceof Error ? `Couldn't move deal: ${e.message}` : "Couldn't move deal");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.pipelines.all });
      void qc.invalidateQueries({ queryKey: qk.deals.all });
      void qc.invalidateQueries({ queryKey: qk.activities.all });
      void qc.invalidateQueries({ queryKey: qk.dashboard.all });
    },
  });
}
