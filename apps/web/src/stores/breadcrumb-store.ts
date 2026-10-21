import * as React from "react";
import { create } from "zustand";

export type Crumb = { label: string; href?: string };

type BreadcrumbState = { crumbs: Crumb[] | null; set: (crumbs: Crumb[] | null) => void };

export const useBreadcrumbStore = create<BreadcrumbState>((set) => ({
  crumbs: null,
  set: (crumbs) => set({ crumbs }),
}));

/** Pages call this to override the topbar breadcrumb (e.g. record names). */
export function useBreadcrumb(crumbs: Crumb[] | null) {
  const set = useBreadcrumbStore((s) => s.set);
  const key = JSON.stringify(crumbs);
  React.useEffect(() => {
    set(crumbs);
    return () => set(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, set]);
}
