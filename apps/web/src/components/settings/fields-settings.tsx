"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteField,
  useFields,
  useReorderFields,
  type FieldDefinition,
  type ObjectType,
} from "@/hooks/use-fields";
import { useTerms } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";

import { FieldDialog } from "./field-dialog";
import { fieldTypeMeta } from "./field-type-meta";
import { SortableList } from "./sortable-list";

const OPTION_PREVIEW = 3;

export function FieldsSettings() {
  const t = useTerms();
  const [objectType, setObjectType] = React.useState<ObjectType>("deal");
  const objects: { key: ObjectType; label: string }[] = [
    { key: "deal", label: t.deals },
    { key: "company", label: t.companies },
    { key: "contact", label: t.contacts },
  ];
  const objectLabel = objects.find((o) => o.key === objectType)!.label;
  const singular = { deal: t.deal, company: t.company, contact: t.contact }[objectType];
  const { data: fields, isLoading } = useFields(objectType);
  const reorder = useReorderFields();
  const remove = useDeleteField();
  const [editing, setEditing] = React.useState<FieldDefinition | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<FieldDefinition | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-0.5">
          {objects.map((o) => (
            <button
              key={o.key}
              onClick={() => setObjectType(o.key)}
              className={cn(
                "h-7 cursor-pointer rounded-md px-3 text-[13px] font-medium transition-colors",
                objectType === o.key
                  ? "bg-surface text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setCreating(true)} data-agent-id="settings-add-field">
          <Plus /> Add field
        </Button>
      </div>
      <div className="rounded-xl border bg-surface">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        ) : !fields?.length ? (
          <p className="p-6 text-center text-[13px] text-muted-foreground">
            No custom fields on {objectLabel.toLowerCase()} yet.
          </p>
        ) : (
          <SortableList
            items={fields}
            className="divide-y"
            onReorder={(ids) => reorder.mutate({ object_type: objectType, field_ids: ids })}
            render={(f) => {
              const meta = fieldTypeMeta(f.type);
              const Icon = meta.icon;
              return (
                <div className="flex items-center gap-3 py-2.5 pr-3">
                  <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">{f.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {meta.label} · <span className="font-mono">{f.key}</span>
                    </p>
                  </div>
                  <div className="hidden max-w-sm min-w-0 items-center justify-end gap-1 overflow-hidden md:flex">
                    {f.options.slice(0, OPTION_PREVIEW).map((o) => (
                      <StatusBadge key={o.value} label={o.label} color={o.color} />
                    ))}
                    {f.options.length > OPTION_PREVIEW && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        +{f.options.length - OPTION_PREVIEW}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${f.label}`}
                    onClick={() => setEditing(f)}
                    className="text-muted-foreground"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${f.label}`}
                    onClick={() => setDeleting(f)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            }}
          />
        )}
      </div>
      <FieldDialog
        open={creating}
        onOpenChange={setCreating}
        objectType={objectType}
        objectLabel={singular}
      />
      <FieldDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        objectType={objectType}
        objectLabel={singular}
        field={editing ?? undefined}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.label}”?`}
        description="Its values are removed from every record. This can't be undone."
        busy={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          await remove.mutateAsync(deleting.id);
          toast.success("Field deleted");
          setDeleting(null);
        }}
      />
    </div>
  );
}
