"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, unwrap, type Schemas } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";

export type Pipeline = Schemas["PipelineOut"];
export type Stage = Schemas["StageOut"];

export function usePipelines() {
  return useQuery({
    queryKey: qk.pipelines.list(),
    queryFn: () => unwrap(api.GET("/api/v1/pipelines")),
    staleTime: 60_000,
  });
}

/** All stages across pipelines, keyed by id. */
export function useStageMap() {
  const { data } = usePipelines();
  const map = new Map<string, Stage>();
  for (const p of data ?? []) for (const s of p.stages) map.set(s.id, s);
  return map;
}

function useInvalidatePipelines() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.pipelines.all });
    void qc.invalidateQueries({ queryKey: qk.deals.all });
    void qc.invalidateQueries({ queryKey: qk.dashboard.all });
  };
}

function useStageMutation<V>(fn: (v: V) => Promise<unknown>) {
  const invalidate = useInvalidatePipelines();
  return useMutation({
    mutationFn: fn,
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Something went wrong"),
  });
}

export function useCreateStage() {
  return useStageMutation(
    ({ pipelineId, body }: { pipelineId: string; body: Schemas["StageCreate"] }) =>
      unwrap(
        api.POST("/api/v1/pipelines/{pipeline_id}/stages", {
          params: { path: { pipeline_id: pipelineId } },
          body,
        }),
      ),
  );
}

export function useUpdateStage() {
  return useStageMutation(({ id, body }: { id: string; body: Schemas["StageUpdate"] }) =>
    unwrap(api.PATCH("/api/v1/stages/{stage_id}", { params: { path: { stage_id: id } }, body })),
  );
}

export function useDeleteStage() {
  return useStageMutation((id: string) =>
    unwrap(api.DELETE("/api/v1/stages/{stage_id}", { params: { path: { stage_id: id } } })),
  );
}

export function useReorderStages() {
  return useStageMutation(({ pipelineId, stageIds }: { pipelineId: string; stageIds: string[] }) =>
    unwrap(
      api.POST("/api/v1/pipelines/{pipeline_id}/stages/reorder", {
        params: { path: { pipeline_id: pipelineId } },
        body: { stage_ids: stageIds },
      }),
    ),
  );
}

export function useUpdatePipeline() {
  return useStageMutation(({ id, name }: { id: string; name: string }) =>
    unwrap(
      api.PATCH("/api/v1/pipelines/{pipeline_id}", {
        params: { path: { pipeline_id: id } },
        body: { name },
      }),
    ),
  );
}

export function useCreatePipeline() {
  return useStageMutation((name: string) =>
    unwrap(api.POST("/api/v1/pipelines", { body: { name } })),
  );
}
