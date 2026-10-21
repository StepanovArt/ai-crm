"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ColorPicker } from "./color-picker";

export type OptionDraft = { value?: string | null; label: string; color: string };

const OPTION_COLORS = [
  "slate",
  "blue",
  "indigo",
  "violet",
  "green",
  "teal",
  "amber",
  "orange",
  "rose",
  "pink",
  "gray",
  "red",
];

export function OptionsEditor({
  options,
  onChange,
}: {
  options: OptionDraft[];
  onChange: (o: OptionDraft[]) => void;
}) {
  function update(i: number, patch: Partial<OptionDraft>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }
  return (
    <div className="space-y-1.5">
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <ColorPicker
            value={o.color}
            onChange={(color) => update(i, { color })}
            presets={OPTION_COLORS}
            label="Option colour"
          />
          <Input
            value={o.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder={`Option ${i + 1}`}
            aria-label={`Option ${i + 1}`}
            className="h-8"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove option"
            onClick={() => onChange(options.filter((_, idx) => idx !== i))}
            disabled={options.length <= 1}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() =>
          onChange([
            ...options,
            { label: "", color: OPTION_COLORS[options.length % OPTION_COLORS.length]! },
          ])
        }
      >
        <Plus /> Add option
      </Button>
    </div>
  );
}
