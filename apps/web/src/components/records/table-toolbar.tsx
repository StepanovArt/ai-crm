"use client";

import * as React from "react";
import { Columns3, Search, User, X } from "lucide-react";

import { Avatar } from "@/components/common/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useMembers } from "@/hooks/use-workspace";
import type { FieldDescriptor } from "@/lib/records/descriptors";
import { describeFilter, type SavedView } from "@/lib/records/views";
import { cn } from "@/lib/utils";

function useDebounced(value: string, ms: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function ViewTabs({
  views,
  active,
  onChange,
}: {
  views: SavedView[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5" role="tablist">
      {views.map((v) => (
        <button
          key={v.key}
          role="tab"
          aria-selected={v.key === active}
          onClick={() => onChange(v.key)}
          data-agent-id={`view-${v.key}`}
          className={cn(
            "h-7 cursor-pointer rounded-md px-2.5 text-[13px] font-medium transition-colors",
            v.key === active
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = React.useState(value);
  const debounced = useDebounced(draft, 250);
  React.useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-7 w-56 pl-8 text-[13px]"
      />
    </div>
  );
}

export function OwnerFilter({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
}) {
  const { list, byId } = useMembers();
  const current = value ? byId.get(value) : undefined;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-7 gap-1.5", current && "border-primary/40 bg-primary/5")}
        >
          {current ? <Avatar name={current.full_name} size="xs" /> : <User className="size-3.5" />}
          {current ? current.full_name.split(" ")[0] : "Owner"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Filter by owner</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onChange(undefined)}>Anyone</DropdownMenuItem>
        <DropdownMenuSeparator />
        {list.map((m) => (
          <DropdownMenuItem key={m.id} onSelect={() => onChange(m.id)}>
            <Avatar name={m.full_name} size="xs" /> {m.full_name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FilterChips({
  filter,
  onRemove,
  skip = [],
}: {
  filter: Record<string, unknown>;
  onRemove: (key: string) => void;
  skip?: string[];
}) {
  const entries = Object.entries(filter).filter(([k]) => !skip.includes(k));
  if (!entries.length) return null;
  return (
    <div className="flex items-center gap-1.5">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-primary/30 bg-primary/5 pr-1 pl-2 text-[13px] text-primary"
        >
          {describeFilter(k, v)}
          <button
            aria-label={`Remove ${k} filter`}
            onClick={() => onRemove(k)}
            className="cursor-pointer rounded p-0.5 hover:bg-primary/10"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

export function ColumnsMenu<T extends "company" | "contact" | "deal">({
  descriptors,
  hidden,
  onChange,
}: {
  descriptors: FieldDescriptor<T>[];
  hidden: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-muted-foreground">
          <Columns3 className="size-3.5" /> Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-56">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        {descriptors.slice(1).map((d) => (
          <DropdownMenuCheckboxItem
            key={d.key}
            checked={!hidden.has(d.key)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(on) => {
              const next = new Set(hidden);
              if (on) next.delete(d.key);
              else next.add(d.key);
              onChange(next);
            }}
          >
            <span className="flex-1 truncate">{d.label}</span>
            {d.custom && (
              <span className="text-[10px] text-muted-foreground uppercase">custom</span>
            )}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
