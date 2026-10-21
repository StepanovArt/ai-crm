"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { Avatar } from "@/components/common/avatar";
import { ColorDot } from "@/components/common/status-badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMembers } from "@/hooks/use-workspace";
import type { DescriptorType, Option } from "@/lib/records/descriptors";

type EditorProps = {
  type: DescriptorType;
  value: unknown;
  options?: Option[];
  label: string;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

function TextEditor({ type, value, label, onCommit: commitOnce, onCancel }: EditorProps) {
  const [draft, setDraft] = React.useState(
    value === null || value === undefined ? "" : String(value),
  );
  const done = React.useRef(false);
  const onCommit = (v: unknown) => {
    if (done.current) return;
    done.current = true;
    commitOnce(v);
  };
  const inputType = type === "email" ? "email" : type === "date" ? "date" : "text";
  if (type === "long_text") {
    return (
      <Textarea
        autoFocus
        aria-label={label}
        value={draft}
        rows={4}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onCommit(draft);
        }}
        onBlur={() => onCommit(draft)}
        className="min-h-24 border-0 shadow-none focus-visible:ring-0"
      />
    );
  }
  return (
    <Input
      autoFocus
      aria-label={label}
      type={inputType}
      inputMode={type === "number" || type === "currency" ? "decimal" : undefined}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (type === "date") onCommit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter") onCommit(draft);
      }}
      onBlur={() => type !== "date" && onCommit(draft)}
      className="h-9 border-0 shadow-none focus-visible:ring-0"
    />
  );
}

function OptionsEditor({ type, value, options = [], label, onCommit }: EditorProps) {
  const multi = type === "multi_select";
  const [selected, setSelected] = React.useState<string[]>(
    multi ? ((value as string[] | null) ?? []) : value ? [String(value)] : [],
  );
  const selectedRef = React.useRef(selected);
  selectedRef.current = selected;
  React.useEffect(
    () => () => {
      if (multi) onCommit(selectedRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <Command className="rounded-none">
      <CommandInput placeholder={`Search ${label.toLowerCase()}…`} className="h-9 text-sm" />
      <CommandList className="max-h-64">
        <CommandEmpty>No options</CommandEmpty>
        <CommandGroup>
          {options.map((o) => {
            const isOn = selected.includes(o.value);
            return (
              <CommandItem
                key={o.value}
                value={o.label}
                onSelect={() => {
                  if (multi)
                    setSelected((s) => (isOn ? s.filter((v) => v !== o.value) : [...s, o.value]));
                  else onCommit(o.value);
                }}
              >
                <ColorDot color={o.color} />
                <span className="flex-1 truncate">{o.label}</span>
                {isOn && <Check className="size-3.5 text-foreground" />}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function UserEditor({ value, label, onCommit }: EditorProps) {
  const { list } = useMembers();
  return (
    <Command className="rounded-none">
      <CommandInput placeholder={`Assign ${label.toLowerCase()}…`} className="h-9 text-sm" />
      <CommandList className="max-h-64">
        <CommandEmpty>No people</CommandEmpty>
        <CommandGroup>
          {list.map((m) => (
            <CommandItem key={m.id} value={m.full_name} onSelect={() => onCommit(m.id)}>
              <Avatar name={m.full_name} size="xs" />
              <span className="flex-1 truncate">{m.full_name}</span>
              {value === m.id && <Check className="size-3.5 text-foreground" />}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

export function FieldEditor(props: EditorProps) {
  switch (props.type) {
    case "select":
    case "multi_select":
    case "lead_status":
    case "stage":
      return <OptionsEditor {...props} />;
    case "user":
      return <UserEditor {...props} />;
    default:
      return <TextEditor {...props} />;
  }
}

export function editorWidth(type: DescriptorType): number {
  if (type === "long_text") return 320;
  if (["select", "multi_select", "lead_status", "stage", "user"].includes(type)) return 240;
  return 260;
}
