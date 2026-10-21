"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateField,
  useUpdateField,
  type FieldDefinition,
  type FieldType,
  type ObjectType,
} from "@/hooks/use-fields";

import { FIELD_TYPES } from "./field-type-meta";
import { OptionsEditor, type OptionDraft } from "./options-editor";

const SELECT_TYPES: FieldType[] = ["select", "multi_select"];

export function FieldDialog({
  open,
  onOpenChange,
  objectType,
  objectLabel,
  field,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  objectType: ObjectType;
  objectLabel: string;
  field?: FieldDefinition;
}) {
  const create = useCreateField();
  const update = useUpdateField();
  const [label, setLabel] = React.useState("");
  const [type, setType] = React.useState<FieldType>("text");
  const [options, setOptions] = React.useState<OptionDraft[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setLabel(field?.label ?? "");
    setType(field?.type ?? "text");
    setOptions(
      field?.options.length
        ? field.options
        : [
            { label: "", color: "blue" },
            { label: "", color: "green" },
          ],
    );
    setError(null);
  }, [open, field]);

  const needsOptions = SELECT_TYPES.includes(type);
  const busy = create.isPending || update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return setError("Give the field a name");
    const cleanOptions = options
      .filter((o) => o.label.trim())
      .map((o) => ({ ...o, label: o.label.trim() }));
    if (needsOptions && cleanOptions.length === 0) return setError("Add at least one option");
    try {
      if (field) {
        await update.mutateAsync({
          id: field.id,
          body: { label: label.trim(), options: needsOptions ? cleanOptions : undefined },
        });
        toast.success("Field updated");
      } else {
        await create.mutateAsync({
          object_type: objectType,
          label: label.trim(),
          type,
          options: needsOptions ? cleanOptions : undefined,
        });
        toast.success(`“${label.trim()}” added to ${objectLabel}`);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save field");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {field ? "Edit field" : `New ${objectLabel.toLowerCase()} field`}
          </DialogTitle>
          <DialogDescription>
            {field
              ? "Changes apply everywhere this field is shown."
              : "It appears in tables and record pages right away."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Name" htmlFor="field-label">
            <Input
              id="field-label"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Budget"
            />
          </Field>
          <Field
            label="Type"
            htmlFor="field-type"
            hint={field ? "The type can't change once data exists." : undefined}
          >
            <Select
              value={type}
              onValueChange={(v) => setType(v as FieldType)}
              disabled={Boolean(field)}
            >
              <SelectTrigger id="field-type" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(({ type: t, label: l, icon: Icon, hint }) => (
                  <SelectItem key={t} value={t}>
                    <Icon className="text-muted-foreground" /> {l}
                    <span className="text-xs text-muted-foreground">{hint}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {needsOptions && (
            <Field label="Options">
              <OptionsEditor options={options} onChange={setOptions} />
            </Field>
          )}
          {error && <p className="text-[13px] text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {field ? "Save changes" : "Add field"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
