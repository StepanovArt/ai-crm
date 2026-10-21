"use client";

import { useQuery } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";

import type { RecordType } from "./use-records";

export function useInsight(type: RecordType, id: string) {
  return useQuery({
    queryKey: qk.agent.insights(type, id),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/agent/insights", {
          params: { query: { record_type: type, record_id: id } },
        }),
      ),
    staleTime: 0,
  });
}
