"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowSelectionState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import type { RecordType } from "@/hooks/use-records";
import { agentId } from "@/lib/agent-ids";
import type { FieldDescriptor, RecordOf } from "@/lib/records/descriptors";
import { cn } from "@/lib/utils";

import { EditableField } from "./editable-field";

const INITIAL_ROWS = 60;
const ROW_CHUNK = 120;
const ROW_HEIGHT = 40;

export type SortState = { key: string; desc: boolean } | null;

export function parseSort(sort: string | undefined | null): SortState {
  if (!sort) return null;
  return { key: sort.replace(/^-/, ""), desc: sort.startsWith("-") };
}

type Props<T extends RecordType> = {
  type: T;
  rows: RecordOf<T>[];
  descriptors: FieldDescriptor<T>[];
  hidden: Set<string>;
  isLoading: boolean;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  selection: RowSelectionState;
  onSelectionChange: (s: RowSelectionState) => void;
  renderPrimary: (row: RecordOf<T>) => React.ReactNode;
  onOpen: (row: RecordOf<T>) => void;
  onUpdate: (row: RecordOf<T>, descriptor: FieldDescriptor<T>, value: unknown) => void;
  empty: React.ReactNode;
};

export function DataTable<T extends RecordType>(props: Props<T>) {
  const { type, rows, descriptors, hidden, sort, onSortChange, selection, onSelectionChange } =
    props;
  const [primary, ...rest] = descriptors;

  // Callbacks are read through refs so column definitions (and memoized rows) stay stable
  // when the parent re-renders with fresh closures.
  const renderPrimary = React.useRef(props.renderPrimary);
  const onUpdate = React.useRef(props.onUpdate);
  React.useLayoutEffect(() => {
    renderPrimary.current = props.renderPrimary;
    onUpdate.current = props.onUpdate;
  });

  const columns = React.useMemo<ColumnDef<RecordOf<T>>[]>(() => {
    const visible = rest.filter((d) => !hidden.has(d.key));
    return [
      {
        id: "__primary",
        size: primary?.width ?? 240,
        header: () => primary?.label ?? "Name",
        cell: ({ row }) => renderPrimary.current(row.original),
        meta: { descriptor: primary },
      },
      ...visible.map<ColumnDef<RecordOf<T>>>((d) => ({
        id: d.key,
        size: d.width,
        header: () => d.label,
        cell: ({ row }) => (
          <EditableField
            type={d.type}
            value={d.get(row.original)}
            options={d.options}
            label={d.label}
            editable={d.editable}
            recordId={row.original.id}
            currency={"currency" in row.original ? (row.original.currency as string) : undefined}
            onSave={(v) => onUpdate.current(row.original, d, v)}
          />
        ),
        meta: { descriptor: d },
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptors, hidden]);

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (r) => r.id,
    state: { rowSelection: selection },
    enableRowSelection: true,
    onRowSelectionChange: (u) => onSelectionChange(typeof u === "function" ? u(selection) : u),
    getCoreRowModel: getCoreRowModel(),
  });

  function toggleSort(d: FieldDescriptor<T> | undefined) {
    if (!d?.sortKey) return;
    if (!sort || sort.key !== d.sortKey) onSortChange({ key: d.sortKey, desc: false });
    else if (!sort.desc) onSortChange({ key: d.sortKey, desc: true });
    else onSortChange(null);
  }

  // Render big result sets progressively: the first rows commit at once, the rest follow in
  // low-priority transitions so the page is interactive immediately.
  const modelRows = table.getRowModel().rows;
  const dataKey = `${rows.length}:${rows[0]?.id ?? ""}`;
  const [shown, setShown] = React.useState({ key: dataKey, count: INITIAL_ROWS });
  const count = shown.key === dataKey ? shown.count : INITIAL_ROWS;
  if (shown.key !== dataKey) setShown({ key: dataKey, count: INITIAL_ROWS });
  React.useEffect(() => {
    if (count >= modelRows.length) return;
    const id = setTimeout(() =>
      React.startTransition(() =>
        setShown((s) => (s.key === dataKey ? { ...s, count: s.count + ROW_CHUNK } : s)),
      ),
    );
    return () => clearTimeout(id);
  }, [count, modelRows.length, dataKey]);
  const pending = Math.max(0, modelRows.length - count);
  const selecting = Object.keys(selection).length > 0;

  const allSelected = table.getIsAllRowsSelected();
  const someSelected = table.getIsSomeRowsSelected();

  return (
    <div className="relative min-w-0 flex-1 overflow-auto">
      <table
        className="w-max min-w-full border-separate border-spacing-0 text-[13px]"
        data-selecting={selecting || undefined}
      >
        <thead className="sticky top-0 z-20">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h, i) => {
                const d = (h.column.columnDef.meta as { descriptor?: FieldDescriptor<T> })
                  ?.descriptor;
                const active = d?.sortKey && sort?.key === d.sortKey;
                return (
                  <th
                    key={h.id}
                    scope="col"
                    style={{ width: h.getSize(), minWidth: h.getSize() }}
                    className={cn(
                      "h-9 border-b bg-background px-3 text-left text-xs font-medium whitespace-nowrap text-muted-foreground select-none",
                      i === 0 && "sticky left-0 z-10 pl-4",
                      d?.sortKey && "cursor-pointer hover:text-foreground",
                    )}
                    onClick={() => toggleSort(d)}
                    aria-sort={active ? (sort?.desc ? "descending" : "ascending") : undefined}
                  >
                    <span className="flex items-center gap-2">
                      {i === 0 && (
                        <Checkbox
                          aria-label="Select all"
                          checked={allSelected ? true : someSelected ? "indeterminate" : false}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={(v) => table.toggleAllRowsSelected(v === true)}
                        />
                      )}
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {active &&
                        (sort?.desc ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUp className="size-3" />
                        ))}
                    </span>
                  </th>
                );
              })}
              <th aria-hidden className="w-full border-b bg-background" />
            </tr>
          ))}
        </thead>
        <tbody>
          {props.isLoading && rows.length === 0
            ? Array.from({ length: 12 }).map((_, r) => (
                <tr key={r}>
                  {columns.map((c, i) => (
                    <td key={c.id} className={cn("h-10 border-b px-3", i === 0 && "pl-4")}>
                      <Skeleton className={cn("h-3.5", i === 0 ? "w-40" : "w-20")} />
                    </td>
                  ))}
                  <td className="border-b" />
                </tr>
              ))
            : modelRows
                .slice(0, count)
                .map((row) => (
                  <DataRow
                    key={row.id}
                    row={row}
                    type={type}
                    selected={row.getIsSelected()}
                    columns={columns}
                    onOpen={props.onOpen}
                  />
                ))}
          {pending > 0 && (
            <tr aria-hidden style={{ height: pending * ROW_HEIGHT }}>
              <td colSpan={columns.length + 1} />
            </tr>
          )}
        </tbody>
      </table>
      {!props.isLoading && rows.length === 0 && props.empty}
    </div>
  );
}

type RowProps<T extends RecordType> = {
  row: Row<RecordOf<T>>;
  type: T;
  selected: boolean;
  /** Only used to re-render when columns change; cells come from `row`. */
  columns: ColumnDef<RecordOf<T>>[];
  onOpen: (row: RecordOf<T>) => void;
};

/** Memoized so selecting or editing one row doesn't re-render the other 499. */
const DataRow = React.memo(function DataRow<T extends RecordType>({
  row,
  type,
  selected,
  onOpen,
}: RowProps<T>) {
  return (
    <tr
      data-agent-id={agentId.row(type, row.id)}
      onClick={() => onOpen(row.original)}
      className={cn(
        "group cursor-pointer transition-colors",
        selected ? "bg-primary/[0.04]" : "hover:bg-accent/40",
      )}
    >
      {row.getVisibleCells().map((cell, i) => (
        <td
          key={cell.id}
          style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}
          className={cn(
            "h-10 border-b px-3 align-middle",
            i === 0 &&
              "sticky left-0 z-10 bg-background pl-4 group-hover:bg-[color-mix(in_oklab,var(--accent)_40%,var(--background))]",
            i === 0 && selected && "bg-[color-mix(in_oklab,var(--primary)_4%,var(--background))]",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {i === 0 && (
              <Checkbox
                aria-label="Select row"
                checked={selected}
                onClick={(e) => e.stopPropagation()}
                onCheckedChange={(v) => row.toggleSelected(v === true)}
                className={cn(
                  !selected &&
                    "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 in-data-selecting:opacity-100",
                )}
              />
            )}
            <div className="min-w-0 flex-1">
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          </div>
        </td>
      ))}
      <td className="border-b" />
    </tr>
  );
}) as <T extends RecordType>(props: RowProps<T>) => React.ReactElement;
