"use client";

import * as React from "react";
import type { RowSelectionState } from "@tanstack/react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { parseSort, type SortState } from "@/components/records/data-table";
import { useMe } from "@/hooks/use-auth";
import type { RecordType } from "@/hooks/use-records";
import type { FieldDescriptor } from "@/lib/records/descriptors";
import { VIEWS } from "@/lib/records/views";

function readHidden(type: RecordType): string[] | null {
  try {
    const raw = localStorage.getItem(`halo-cols-${type}`);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

/** Table state: view / q / sort / extra filter live in the URL (so the agent can drive them). */
export function useTableState<T extends RecordType>(type: T, descriptors: FieldDescriptor<T>[]) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: me } = useMe();

  const views = VIEWS[type];
  const viewKey = params.get("view") ?? views[0]!.key;
  const view = views.find((v) => v.key === viewKey) ?? views[0]!;
  const q = params.get("q") ?? "";
  const extra = React.useMemo<Record<string, unknown>>(() => {
    try {
      return JSON.parse(params.get("filter") ?? "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  }, [params]);
  const sortParam = params.get("sort") ?? view.sort ?? undefined;
  const sort = parseSort(sortParam);

  const setParams = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const filter = React.useMemo(
    () => ({ ...(view.filter?.(me?.user.id ?? "") ?? {}), ...extra }),
    [view, me, extra],
  );

  const [selection, setSelection] = React.useState<RowSelectionState>({});
  const [hidden, setHiddenState] = React.useState<Set<string>>(
    () => new Set(descriptors.filter((d) => d.defaultHidden).map((d) => d.key)),
  );
  React.useEffect(() => {
    const stored = readHidden(type);
    if (stored) setHiddenState(new Set(stored));
  }, [type]);
  const setHidden = (next: Set<string>) => {
    setHiddenState(next);
    try {
      localStorage.setItem(`halo-cols-${type}`, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  return {
    view,
    views,
    setView: (key: string) => setParams({ view: key, sort: null, filter: null }),
    q,
    setQ: (value: string) => setParams({ q: value }),
    extra,
    setExtra: (next: Record<string, unknown>) =>
      setParams({ filter: Object.keys(next).length ? JSON.stringify(next) : null }),
    sort,
    setSort: (s: SortState) => setParams({ sort: s ? `${s.desc ? "-" : ""}${s.key}` : null }),
    sortParam,
    filter,
    selection,
    setSelection,
    hidden,
    setHidden,
  };
}
