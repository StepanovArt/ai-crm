"use client";

import { Check } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { colorClasses, STAGE_COLOR_PRESETS } from "@/lib/colors";
import { cn } from "@/lib/utils";

export function ColorPicker({
  value,
  onChange,
  presets = STAGE_COLOR_PRESETS,
  label = "Colour",
}: {
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
  label?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="flex size-6 cursor-pointer items-center justify-center rounded-md hover:bg-accent"
        >
          <span className={cn("size-3 rounded-full", colorClasses(value).dot)} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-4 gap-1.5">
          {presets.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => onChange(c)}
              className={cn(
                "flex size-7 cursor-pointer items-center justify-center rounded-md transition-transform hover:scale-110",
                colorClasses(c).dot,
              )}
            >
              {c === value && <Check className="size-3.5 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
