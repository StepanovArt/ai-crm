"use client";

import { useQuery } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";

export type Today = Schemas["TodayOut"];
export type QueueItem = Today["contact_queue"][number];

export function useToday() {
  return useQuery({
    queryKey: qk.dashboard.today(),
    queryFn: () => unwrap(api.GET("/api/v1/dashboard/today")),
  });
}
