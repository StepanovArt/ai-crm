"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";

export type FieldDefinition = Schemas["FieldDefinitionOut"];
export type FieldType = FieldDefinition["type"];
export type ObjectType = FieldDefinition["object_type"];

export function useFields(objectType: ObjectType) {
  return useQuery({
    queryKey: qk.fields.list(objectType),
    queryFn: () =>
      unwrap(api.GET("/api/v1/fields", { params: { query: { object_type: objectType } } })),
    staleTime: 60_000,
  });
}

function useInvalidateFields() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.fields.all });
  };
}

export function useCreateField() {
  const invalidate = useInvalidateFields();
  return useMutation({
    mutationFn: (body: Schemas["FieldDefinitionCreate"]) =>
      unwrap(api.POST("/api/v1/fields", { body })),
    onSuccess: invalidate,
  });
}

export function useUpdateField() {
  const invalidate = useInvalidateFields();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Schemas["FieldDefinitionUpdate"] }) =>
      unwrap(api.PATCH("/api/v1/fields/{field_id}", { params: { path: { field_id: id } }, body })),
    onSuccess: invalidate,
  });
}

export function useDeleteField() {
  const qc = useQueryClient();
  const invalidate = useInvalidateFields();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/fields/{field_id}", { params: { path: { field_id: id } } })),
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: qk.companies.all });
      void qc.invalidateQueries({ queryKey: qk.contacts.all });
      void qc.invalidateQueries({ queryKey: qk.deals.all });
    },
  });
}

export function useReorderFields() {
  const invalidate = useInvalidateFields();
  return useMutation({
    mutationFn: (body: Schemas["FieldReorder"]) =>
      unwrap(api.POST("/api/v1/fields/reorder", { body })),
    onSuccess: invalidate,
  });
}
