"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Avatar, CompanyLogo } from "@/components/common/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCompanies, useContacts } from "@/hooks/use-records";
import { cn } from "@/lib/utils";

type Item = { id: string; label: string; sub?: string | null };

function Picker({
  value,
  onChange,
  placeholder,
  items,
  search,
  onSearch,
  kind,
  id,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder: string;
  items: Item[];
  search: string;
  onSearch: (q: string) => void;
  kind: "company" | "contact";
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedLabel, setSelectedLabel] = React.useState<string | null>(null);
  const current = items.find((i) => i.id === value)?.label ?? (value ? selectedLabel : null);
  const Icon = kind === "company" ? CompanyLogo : Avatar;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between px-2.5 font-normal"
        >
          <span
            className={cn("flex min-w-0 items-center gap-2", !current && "text-muted-foreground")}
          >
            {current && <Icon name={current} size="xs" />}
            <span className="truncate">{current ?? placeholder}</span>
          </span>
          <ChevronsUpDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={onSearch}
            placeholder="Search…"
            className="h-9 text-sm"
          />
          <CommandList className="max-h-60">
            <CommandEmpty>No matches</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  Clear selection
                </CommandItem>
              )}
              {items.map((i) => (
                <CommandItem
                  key={i.id}
                  value={i.id}
                  onSelect={() => {
                    onChange(i.id);
                    setSelectedLabel(i.label);
                    setOpen(false);
                  }}
                >
                  <Icon name={i.label} size="xs" />
                  <span className="flex-1 truncate">{i.label}</span>
                  {i.sub && <span className="truncate text-xs text-muted-foreground">{i.sub}</span>}
                  {i.id === value && <Check className="size-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function CompanyPicker(props: {
  value: string | null;
  onChange: (id: string | null) => void;
  id?: string;
}) {
  const [q, setQ] = React.useState("");
  const { data } = useCompanies({ q, limit: 20, sort: "name" });
  const items = (data?.items ?? []).map((c) => ({ id: c.id, label: c.name, sub: c.domain }));
  return (
    <Picker
      {...props}
      kind="company"
      placeholder="Select…"
      items={items}
      search={q}
      onSearch={setQ}
    />
  );
}

export function ContactPicker(props: {
  value: string | null;
  onChange: (id: string | null) => void;
  companyId?: string | null;
  id?: string;
}) {
  const [q, setQ] = React.useState("");
  const { data } = useContacts({
    q,
    limit: 20,
    filter: props.companyId ? { company_id: props.companyId } : undefined,
  });
  const items = (data?.items ?? []).map((c) => ({ id: c.id, label: c.full_name, sub: c.title }));
  return (
    <Picker
      {...props}
      kind="contact"
      placeholder="Select…"
      items={items}
      search={q}
      onSearch={setQ}
    />
  );
}
