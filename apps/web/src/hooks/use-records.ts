"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, filterParam, unwrap, type Schemas } from "@/lib/api/client";
import { qk, type ListArgs } from "@/lib/query-keys";

export type Company = Schemas["CompanyOut"];
export type Contact = Schemas["ContactOut"];
export type Deal = Schemas["DealOut"];
export type RecordType = "company" | "contact" | "deal";
export type AnyRecord = Company | Contact | Deal;

function listQuery(args: ListArgs) {
  return {
    q: args.q || undefined,
    sort: args.sort || undefined,
    limit: args.limit ?? 200,
    filter: filterParam(args.filter),
  };
}

export function useCompanies(args: ListArgs, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.companies.list(args),
    queryFn: () => unwrap(api.GET("/api/v1/companies", { params: { query: listQuery(args) } })),
    placeholderData: keepPreviousData,
    enabled: opts.enabled ?? true,
  });
}

export function useContacts(args: ListArgs, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.contacts.list(args),
    queryFn: () => unwrap(api.GET("/api/v1/contacts", { params: { query: listQuery(args) } })),
    placeholderData: keepPreviousData,
    enabled: opts.enabled ?? true,
  });
}

export function useDeals(args: ListArgs, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.deals.list(args),
    queryFn: () => unwrap(api.GET("/api/v1/deals", { params: { query: listQuery(args) } })),
    placeholderData: keepPreviousData,
    enabled: opts.enabled ?? true,
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: qk.companies.detail(id ?? ""),
    queryFn: () =>
      unwrap(api.GET("/api/v1/companies/{company_id}", { params: { path: { company_id: id! } } })),
    enabled: Boolean(id),
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: qk.contacts.detail(id ?? ""),
    queryFn: () =>
      unwrap(api.GET("/api/v1/contacts/{contact_id}", { params: { path: { contact_id: id! } } })),
    enabled: Boolean(id),
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: qk.deals.detail(id ?? ""),
    queryFn: () =>
      unwrap(api.GET("/api/v1/deals/{deal_id}", { params: { path: { deal_id: id! } } })),
    enabled: Boolean(id),
  });
}

/** Everything that can show a record: lists, boards, dashboards, timelines. */
export function useInvalidateRecords() {
  const qc = useQueryClient();
  return (type?: RecordType) => {
    const keys =
      type === "company"
        ? [qk.companies.all, qk.contacts.all, qk.deals.all]
        : type === "contact"
          ? [qk.contacts.all, qk.companies.all, qk.deals.all]
          : [qk.deals.all, qk.pipelines.all, qk.companies.all, qk.contacts.all];
    for (const key of [...keys, qk.activities.all, qk.dashboard.all]) {
      void qc.invalidateQueries({ queryKey: key });
    }
  };
}

export type RecordPatch = {
  company: Schemas["CompanyUpdate"];
  contact: Schemas["ContactUpdate"];
  deal: Schemas["DealUpdate"];
};

async function patchRecord<T extends RecordType>(type: T, id: string, body: RecordPatch[T]) {
  if (type === "company")
    return unwrap(
      api.PATCH("/api/v1/companies/{company_id}", {
        params: { path: { company_id: id } },
        body: body as Schemas["CompanyUpdate"],
      }),
    );
  if (type === "contact")
    return unwrap(
      api.PATCH("/api/v1/contacts/{contact_id}", {
        params: { path: { contact_id: id } },
        body: body as Schemas["ContactUpdate"],
      }),
    );
  return unwrap(
    api.PATCH("/api/v1/deals/{deal_id}", {
      params: { path: { deal_id: id } },
      body: body as Schemas["DealUpdate"],
    }),
  );
}

export function useUpdateRecord(type: RecordType) {
  const invalidate = useInvalidateRecords();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RecordPatch[typeof type] }) =>
      patchRecord(type, id, patch),
    onSuccess: (record) => {
      const detailKey =
        type === "company"
          ? qk.companies.detail(record.id)
          : type === "contact"
            ? qk.contacts.detail(record.id)
            : qk.deals.detail(record.id);
      qc.setQueryData(detailKey, record);
      invalidate(type);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });
}

export function useDeleteRecords(type: RecordType) {
  const invalidate = useInvalidateRecords();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        if (type === "company")
          await unwrap(
            api.DELETE("/api/v1/companies/{company_id}", { params: { path: { company_id: id } } }),
          );
        else if (type === "contact")
          await unwrap(
            api.DELETE("/api/v1/contacts/{contact_id}", { params: { path: { contact_id: id } } }),
          );
        else
          await unwrap(
            api.DELETE("/api/v1/deals/{deal_id}", { params: { path: { deal_id: id } } }),
          );
      }
      return ids.length;
    },
    onSuccess: () => invalidate(type),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });
}

export function useCreateCompany() {
  const invalidate = useInvalidateRecords();
  return useMutation({
    mutationFn: (body: Schemas["CompanyCreate"]) => unwrap(api.POST("/api/v1/companies", { body })),
    onSuccess: () => invalidate("company"),
  });
}

export function useCreateContact() {
  const invalidate = useInvalidateRecords();
  return useMutation({
    mutationFn: (body: Schemas["ContactCreate"]) => unwrap(api.POST("/api/v1/contacts", { body })),
    onSuccess: () => invalidate("contact"),
  });
}

export function useCreateDeal() {
  const invalidate = useInvalidateRecords();
  return useMutation({
    mutationFn: (body: Schemas["DealCreate"]) => unwrap(api.POST("/api/v1/deals", { body })),
    onSuccess: () => invalidate("deal"),
  });
}
