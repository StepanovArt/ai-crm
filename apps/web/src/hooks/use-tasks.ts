"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, filterParam, unwrap, type Schemas } from "@/lib/api/client";
import { qk, type ListArgs } from "@/lib/query-keys";

export type Task = Schemas["TaskOut"];

export function useTasks(args: ListArgs) {
  return useQuery({
    queryKey: qk.tasks.list(args),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/tasks", {
          params: {
            query: {
              q: args.q || undefined,
              sort: args.sort,
              limit: args.limit ?? 200,
              filter: filterParam(args.filter),
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateTasks() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.tasks.all });
    void qc.invalidateQueries({ queryKey: qk.activities.all });
    void qc.invalidateQueries({ queryKey: qk.dashboard.all });
    void qc.invalidateQueries({ queryKey: qk.agent.all });
  };
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (body: Schemas["TaskCreate"]) => unwrap(api.POST("/api/v1/tasks", { body })),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create task"),
  });
}

/** Optimistically toggles/edits a task across every cached task list, with rollback. */
export function useUpdateTask() {
  const qc = useQueryClient();
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Schemas["TaskUpdate"] }) =>
      unwrap(api.PATCH("/api/v1/tasks/{task_id}", { params: { path: { task_id: id } }, body })),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: qk.tasks.all });
      const snapshots = qc.getQueriesData<{ items: Task[]; total: number }>({
        queryKey: qk.tasks.all,
      });
      for (const [key, data] of snapshots) {
        if (!data?.items) continue;
        qc.setQueryData(key, {
          ...data,
          items: data.items.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...body,
                  done: body.done ?? t.done,
                  completed_at: body.done
                    ? new Date().toISOString()
                    : body.done === false
                      ? null
                      : t.completed_at,
                }
              : t,
          ),
        });
      }
      return { snapshots };
    },
    onError: (e, _v, ctx) => {
      for (const [key, data] of ctx?.snapshots ?? []) qc.setQueryData(key, data);
      toast.error(e instanceof Error ? e.message : "Could not update task");
    },
    onSettled: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/tasks/{task_id}", { params: { path: { task_id: id } } })),
    onSuccess: invalidate,
  });
}
