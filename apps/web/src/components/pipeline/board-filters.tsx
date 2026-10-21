"use client";

import { CalendarRange, CircleDollarSign } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const VALUE_PRESETS = [
  { key: "", label: "Any value" },
  { key: "10000", label: "$10K+" },
  { key: "50000", label: "$50K+" },
  { key: "100000", label: "$100K+" },
];

export const CLOSE_PRESETS = [
  { key: "", label: "Any close date" },
  { key: "month", label: "Closing this month" },
  { key: "30", label: "Next 30 days" },
  { key: "90", label: "Next 90 days" },
];

export function closeBefore(key: string): string | undefined {
  if (!key) return undefined;
  const d = new Date();
  if (key === "month")
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  d.setDate(d.getDate() + Number(key));
  return d.toISOString().slice(0, 10);
}

function PresetMenu({
  icon: Icon,
  label,
  presets,
  value,
  onChange,
}: {
  icon: typeof CalendarRange;
  label: string;
  presets: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const current = presets.find((p) => p.key === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-7 gap-1.5", value && "border-primary/40 bg-primary/5")}
        >
          <Icon className="size-3.5" />
          {value ? current?.label : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {presets.map((p) => (
          <DropdownMenuItem key={p.key || "any"} onSelect={() => onChange(p.key)}>
            {p.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ValueFilter({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  return (
    <PresetMenu
      icon={CircleDollarSign}
      label="Value"
      presets={VALUE_PRESETS}
      value={value}
      onChange={onChange}
    />
  );
}

export function CloseFilter({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  return (
    <PresetMenu
      icon={CalendarRange}
      label="Close date"
      presets={CLOSE_PRESETS}
      value={value}
      onChange={onChange}
    />
  );
}
