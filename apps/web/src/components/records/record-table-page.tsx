"use client";

import * as React from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useKeySequences } from "@/hooks/use-hotkeys";
import {
  useDeleteRecords,
  useUpdateRecord,
  type RecordPatch,
  type RecordType,
} from "@/hooks/use-records";
import { useTableState } from "@/hooks/use-table-state";
import type { ListArgs } from "@/lib/query-keys";
import type { FieldDescriptor, RecordOf } from "@/lib/records/descriptors";

import { BulkBar } from "./bulk-bar";
import { DataTable } from "./data-table";
import { ColumnsMenu, FilterChips, OwnerFilter, SearchBox, ViewTabs } from "./table-toolbar";

type Page<R> = { items: R[]; total: number };

export function RecordTablePage<T extends RecordType>({
  type,
  title,
  singular,
  icon,
  descriptors,
  useRows,
  renderPrimary,
  createDialog,
  extraFilters,
}: {
  type: T;
  title: string;
  singular: string;
  icon: LucideIcon;
  descriptors: FieldDescriptor<T>[];
  useRows: (args: ListArgs) => UseQueryResult<Page<RecordOf<T>>>;
  renderPrimary: (row: RecordOf<T>) => React.ReactNode;
  createDialog: (open: boolean, setOpen: (o: boolean) => void) => React.ReactNode;
  extraFilters?: (
    filter: Record<string, unknown>,
    set: (k: string, v: unknown) => void,
  ) => React.ReactNode;
}) {
  const router = useRouter();
  const state = useTableState(type, descriptors);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const { data, isLoading, isFetching } = useRows({
    q: state.q,
    sort: state.sortParam,
    filter: state.filter,
    limit: 500,
  });
  const rows = data?.items ?? [];
  const update = useUpdateRecord(type);
  const remove = useDeleteRecords(type);
  const selectedIds = Object.keys(state.selection).filter((k) => state.selection[k]);

  useKeySequences(React.useMemo(() => ({ c: () => setCreateOpen(true) }), []));

  const onUpdate = React.useCallback(
    (row: RecordOf<T>, d: FieldDescriptor<T>, value: unknown) => {
      if (!d.patch) return;
      update.mutate({ id: row.id, patch: d.patch(value) });
    },
    [update],
  );
  const onOpen = React.useCallback(
    (row: RecordOf<T>) => router.push(`/records/${type}/${row.id}`),
    [router, type],
  );

  function setExtra(key: string, value: unknown) {
    const next = { ...state.extra };
    if (value === undefined || value === null || value === "") delete next[key];
    else next[key] = value;
    state.setExtra(next);
  }

  async function bulkAssign(ownerId: string) {
    await Promise.all(
      selectedIds.map((id) =>
        update.mutateAsync({ id, patch: { owner_id: ownerId } as RecordPatch[T] }),
      ),
    );
    toast.success(
      `Reassigned ${selectedIds.length} ${selectedIds.length === 1 ? singular.toLowerCase() : title.toLowerCase()}`,
    );
    state.setSelection({});
  }

  async function bulkDelete() {
    const n = await remove.mutateAsync(selectedIds);
    toast.success(`Deleted ${n} ${n === 1 ? singular.toLowerCase() : title.toLowerCase()}`);
    state.setSelection({});
    setConfirmOpen(false);
  }

  const filtered = Boolean(state.q) || Object.keys(state.extra).length > 0;
  const Icon = icon;

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground tabular">
            {data ? data.total : "–"}
          </span>
          {isFetching && !isLoading && (
            <span className="size-1.5 animate-pulse rounded-full bg-primary/60" />
          )}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} data-agent-id={`create-${type}`}>
          <Plus /> New {singular.toLowerCase()}
          <Kbd className="ml-1 border-white/20 bg-white/15 text-white/90 dark:text-primary-foreground">
            C
          </Kbd>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b px-6 pb-3">
        <ViewTabs views={state.views} active={state.view.key} onChange={state.setView} />
        <div className="flex-1" />
        <FilterChips
          filter={state.extra}
          onRemove={(k) => setExtra(k, undefined)}
          skip={["owner_id"]}
        />
        {extraFilters?.(state.extra, setExtra)}
        <OwnerFilter
          value={state.extra.owner_id as string | undefined}
          onChange={(id) => setExtra("owner_id", id)}
        />
        <SearchBox
          value={state.q}
          onChange={state.setQ}
          placeholder={`Search ${title.toLowerCase()}…`}
        />
        <ColumnsMenu descriptors={descriptors} hidden={state.hidden} onChange={state.setHidden} />
      </div>
      <DataTable
        type={type}
        rows={rows}
        descriptors={descriptors}
        hidden={state.hidden}
        isLoading={isLoading}
        sort={state.sort}
        onSortChange={state.setSort}
        selection={state.selection}
        onSelectionChange={state.setSelection}
        renderPrimary={renderPrimary}
        onOpen={onOpen}
        onUpdate={onUpdate}
        empty={
          <EmptyState
            icon={Icon}
            title={filtered ? `No ${title.toLowerCase()} match` : `No ${title.toLowerCase()} yet`}
            hint={
              filtered
                ? "Try a different search or clear the filters."
                : `Create your first ${singular.toLowerCase()} to get started.`
            }
            action={
              filtered ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    state.setQ("");
                    state.setExtra({});
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus /> New {singular.toLowerCase()}
                </Button>
              )
            }
          />
        }
      />
      <BulkBar
        count={selectedIds.length}
        onClear={() => state.setSelection({})}
        onDelete={() => setConfirmOpen(true)}
        onAssign={bulkAssign}
        busy={remove.isPending || update.isPending}
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${selectedIds.length} ${selectedIds.length === 1 ? singular.toLowerCase() : title.toLowerCase()}?`}
        description="Their notes, tasks and timeline will be removed too. This can't be undone."
        busy={remove.isPending}
        onConfirm={bulkDelete}
      />
      {createDialog(createOpen, setCreateOpen)}
    </div>
  );
}
