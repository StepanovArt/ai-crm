"use client";

import * as React from "react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

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
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const display = (
    <FieldRenderer
      type={type}
      value={value}
      options={options}
      recordId={recordId}
      currency={currency}
      plain={editable}
    />
  );
  const link = editable ? linkFor(type, value) : null;
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

  // The popover mounts only while editing: a 500-row table would otherwise create thousands
  // of idle Popper instances. It anchors to the cell through a virtual ref, so the cell
  // element itself never remounts.
  return (
    <div className={cn("group/field flex min-w-0 items-center gap-0.5", link && className)}>
      <div
        ref={anchorRef}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
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
      {link && <OpenLink link={link} label={label} />}
      {open && (
        <Popover open onOpenChange={setOpen}>
          <PopoverAnchor virtualRef={anchorRef as React.RefObject<HTMLDivElement>} />
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
            onCloseAutoFocus={(e) => {
              // Return focus to the cell unless the user moved it somewhere else.
              e.preventDefault();
              if (document.activeElement === document.body) anchorRef.current?.focus();
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
      )}
    </div>
  );
}

type FieldLink = { href: string; external: boolean };

/** Where a link-like value points, so the editor trigger and the link can be siblings. */
function linkFor(type: DescriptorType, value: unknown): FieldLink | null {
  if (value === null || value === undefined || value === "") return null;
  if (type === "email") return { href: `mailto:${String(value)}`, external: true };
  if (type === "url") {
    const raw = String(value);
    return { href: raw.startsWith("http") ? raw : `https://${raw}`, external: true };
  }
  const id = (value as { id?: string }).id;
  if (type === "company_link" && id) return { href: `/records/company/${id}`, external: false };
  if (type === "contact_link" && id) return { href: `/records/contact/${id}`, external: false };
  return null;
}

function OpenLink({ link, label }: { link: FieldLink; label: string }) {
  const className =
    "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity outline-none group-hover/field:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40";
  const icon = <ArrowUpRight className="size-3.5" />;
  if (link.external)
    return (
      <a
        href={link.href}
        target={link.href.startsWith("mailto:") ? undefined : "_blank"}
        rel="noreferrer"
        aria-label={`Open ${label}`}
        onClick={(e) => e.stopPropagation()}
        className={className}
      >
        {icon}
      </a>
    );
  return (
    <Link
      href={link.href}
      aria-label={`Open ${label}`}
      onClick={(e) => e.stopPropagation()}
      className={className}
    >
      {icon}
    </Link>
  );
}
