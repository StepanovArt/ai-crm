"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, unwrap, type Schemas } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";

import type { RecordType } from "./use-records";

export type Activity = Schemas["ActivityOut"];
export type Note = Schemas["NoteOut"];

export function useActivities(type: RecordType, id: string) {
  return useQuery({
    queryKey: qk.activities.list(type, id),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/activities", {
          params: { query: { related_type: type, related_id: id, limit: 100 } },
        }),
      ),
  });
}

export function useNotes(type: RecordType, id: string) {
  return useQuery({
    queryKey: qk.notes.list(type, id),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/notes", {
          params: { query: { related_type: type, related_id: id, limit: 100 } },
        }),
      ),
  });
}

function useInvalidateTimeline() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.activities.all });
    void qc.invalidateQueries({ queryKey: qk.notes.all });
    void qc.invalidateQueries({ queryKey: qk.deals.all });
    void qc.invalidateQueries({ queryKey: qk.contacts.all });
    void qc.invalidateQueries({ queryKey: qk.companies.all });
    void qc.invalidateQueries({ queryKey: qk.agent.all });
  };
}

export function useCreateNote() {
  const invalidate = useInvalidateTimeline();
  return useMutation({
    mutationFn: (body: Schemas["NoteCreate"]) => unwrap(api.POST("/api/v1/notes", { body })),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save note"),
  });
}

export function useDeleteNote() {
  const invalidate = useInvalidateTimeline();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/notes/{note_id}", { params: { path: { note_id: id } } })),
    onSuccess: invalidate,
  });
}
