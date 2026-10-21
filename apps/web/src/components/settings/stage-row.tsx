"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeleteStage, useUpdateStage, type Stage } from "@/hooks/use-pipelines";

import { ColorPicker } from "./color-picker";

const KIND_LABEL = { open: "Open", won: "Won", lost: "Lost" } as const;

export function StageRow({ stage }: { stage: Stage }) {
  const update = useUpdateStage();
  const remove = useDeleteStage();
  const [name, setName] = React.useState(stage.name);
  const [prob, setProb] = React.useState(String(stage.probability));
  React.useEffect(() => {
    setName(stage.name);
    setProb(String(stage.probability));
  }, [stage.name, stage.probability]);

  function saveName() {
    const v = name.trim();
    if (v && v !== stage.name) update.mutate({ id: stage.id, body: { name: v } });
    else setName(stage.name);
  }
  function saveProb() {
    const n = Math.max(0, Math.min(100, Math.round(Number(prob))));
    if (Number.isFinite(n) && n !== stage.probability)
      update.mutate({ id: stage.id, body: { probability: n } });
    else setProb(String(stage.probability));
  }

  return (
    <div className="flex items-center gap-2 py-2 pr-3">
      <ColorPicker
        value={stage.color}
        onChange={(color) => update.mutate({ id: stage.id, body: { color } })}
        label={`${stage.name} colour`}
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveName}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        aria-label="Stage name"
        className="h-8 max-w-64 border-transparent bg-transparent shadow-none hover:border-input focus-visible:bg-surface"
      />
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <Input
          value={prob}
          onChange={(e) => setProb(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={saveProb}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label="Win probability"
          inputMode="numeric"
          className="h-8 w-14 text-right tabular"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
      <Select
        value={stage.kind}
        onValueChange={(kind) => update.mutate({ id: stage.id, body: { kind } })}
      >
        <SelectTrigger size="sm" className="w-24" aria-label="Stage type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(KIND_LABEL).map(([k, l]) => (
            <SelectItem key={k} value={k}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${stage.name}`}
        onClick={() => remove.mutate(stage.id)}
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 />
      </Button>
    </div>
  );
}
