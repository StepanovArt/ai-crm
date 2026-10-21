"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";

export type Terminology = Schemas["Terminology"];
export type Member = Schemas["MemberOut"];

export const DEFAULT_TERMS: Terminology = {
  deal: "Deal",
  deals: "Deals",
  company: "Company",
  companies: "Companies",
  contact: "Contact",
  contacts: "Contacts",
  pipeline: "Pipeline",
};

export function useWorkspace() {
  return useQuery({
    queryKey: qk.workspace,
    queryFn: () => unwrap(api.GET("/api/v1/workspaces/current")),
    staleTime: 5 * 60_000,
  });
}

export function useTerms(): Terminology {
  const { data } = useWorkspace();
  return data?.terminology ?? DEFAULT_TERMS;
}

export function useMembers() {
  const { data } = useWorkspace();
  return React.useMemo(() => {
    const list = data?.members ?? [];
    return { list, byId: new Map(list.map((m) => [m.id, m])) };
  }, [data]);
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["WorkspaceUpdate"]) =>
      unwrap(api.PATCH("/api/v1/workspaces/current", { body })),
    onSuccess: (ws) => {
      qc.setQueryData(qk.workspace, ws);
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}
