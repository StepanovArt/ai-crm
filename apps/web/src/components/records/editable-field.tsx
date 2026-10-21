"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { normalizeValue, type DescriptorType, type Option } from "@/lib/records/descriptors";
import { cn } from "@/lib/utils";

import { editorWidth, FieldEditor } from "./field-editor";
import { FieldRenderer } from "./field-renderer";

function same(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Displays a value; click (or Enter) opens an editor popover anchored to the cell.
 * Used by table cells and the record fields panel.
 */
export function EditableField({
  type,
  value,
  options,
  label,
  editable,
  recordId,
  currency,
  onSave,
  className,
}: {
  type: DescriptorType;
  value: unknown;
  options?: Option[];
  label: string;
  editable: boolean;
  recordId?: string;
  currency?: string;
  onSave: (value: unknown) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const display = (
    <FieldRenderer
      type={type}
      value={value}
      options={options}
      recordId={recordId}
      currency={currency}
    />
  );
  if (!editable) return <div className={cn("flex min-w-0 items-center", className)}>{display}</div>;

  if (type === "checkbox") {
    return (
      <div className={cn("flex items-center", className)} onClick={(e) => e.stopPropagation()}>
        <Checkbox
          aria-label={label}
          checked={Boolean(value)}
          onCheckedChange={(v) => onSave(v === true)}
        />
      </div>
    );
  }

  function commit(next: unknown) {
    setOpen(false);
    const normalized = normalizeValue(type, next);
    if (!same(normalized, value)) onSave(normalized);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          role="button"
          tabIndex={0}
          aria-label={`Edit ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className={cn(
            "-mx-1.5 flex min-h-7 min-w-0 cursor-text items-center rounded-md px-1.5 transition-colors outline-none hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring/40",
            open && "bg-accent",
            className,
          )}
        >
          {display}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={-30}
        className="overflow-hidden p-0"
        style={{ width: editorWidth(type) }}
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => {
          // Let the editor's own autoFocus win.
          e.preventDefault();
        }}
      >
        <FieldEditor
          type={type}
          value={value}
          options={options}
          label={label}
          onCommit={commit}
          onCancel={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
