"use client";

import { usePathname, useSearchParams } from "next/navigation";

import type { PageContext } from "@/lib/agent/types";

const RECORD = /^\/records\/(company|contact|deal)\/([0-9a-f-]{36})/;
const PIPELINE = /^\/pipeline\/([0-9a-f-]{36})/;

export function buildPageContext(pathname: string, search: URLSearchParams): PageContext {
  const record = RECORD.exec(pathname);
  const pipeline = PIPELINE.exec(pathname);
  const filters: Record<string, unknown> = {};
  for (const key of ["view", "q", "filter", "owner", "min", "close"]) {
    const v = search.get(key);
    if (v) filters[key] = v;
  }
  return {
    route: pathname,
    record_type: (record?.[1] as PageContext["record_type"]) ?? null,
    record_id: record?.[2] ?? null,
    pipeline_id: pipeline?.[1] ?? null,
    selected_ids: [],
    visible_filters: filters,
    timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null,
  };
}

export function usePageContext(): PageContext {
  const pathname = usePathname();
  const params = useSearchParams();
  return buildPageContext(pathname, new URLSearchParams(params.toString()));
}
