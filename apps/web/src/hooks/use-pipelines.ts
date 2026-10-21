"use client";

import { useQuery } from "@tanstack/react-query";

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
