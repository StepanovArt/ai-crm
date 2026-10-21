"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateStage,
  usePipelines,
  useReorderStages,
  useUpdatePipeline,
  type Pipeline,
} from "@/hooks/use-pipelines";

import { SortableList } from "./sortable-list";
import { StageRow } from "./stage-row";

function PipelineCard({ pipeline }: { pipeline: Pipeline }) {
  const rename = useUpdatePipeline();
  const reorder = useReorderStages();
  const create = useCreateStage();
  const [name, setName] = React.useState(pipeline.name);
  const [newStage, setNewStage] = React.useState("");
  React.useEffect(() => setName(pipeline.name), [pipeline.name]);

  return (
    <div className="rounded-xl border bg-surface">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() =>
            name.trim() &&
            name !== pipeline.name &&
            rename.mutate({ id: pipeline.id, name: name.trim() })
          }
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label="Pipeline name"
          className="h-8 max-w-sm border-transparent bg-transparent px-1 text-sm font-semibold shadow-none hover:border-input"
        />
        <span className="ml-auto text-xs text-muted-foreground">
          {pipeline.stages.length} stages · drag to reorder
        </span>
      </div>
      <SortableList
        items={pipeline.stages}
        className="divide-y px-1"
        onReorder={(ids) => reorder.mutate({ pipelineId: pipeline.id, stageIds: ids })}
        render={(s) => <StageRow stage={s} />}
      />
      <form
        className="flex items-center gap-2 border-t px-4 py-2.5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!newStage.trim()) return;
          await create.mutateAsync({
            pipelineId: pipeline.id,
            body: { name: newStage.trim(), probability: 50 },
          });
          setNewStage("");
        }}
      >
        <Plus className="size-4 text-muted-foreground" />
        <Input
          value={newStage}
          onChange={(e) => setNewStage(e.target.value)}
          placeholder="Add a stage…"
          aria-label="New stage name"
          className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
        />
        <Button size="sm" type="submit" variant="outline" disabled={!newStage.trim()}>
          Add stage
        </Button>
      </form>
    </div>
  );
}

export function PipelineSettings() {
  const { data, isLoading } = usePipelines();
  if (isLoading) return <Skeleton className="h-80 rounded-xl" />;
  return (
    <div className="space-y-6">
      {(data ?? []).map((p) => (
        <PipelineCard key={p.id} pipeline={p} />
      ))}
    </div>
  );
}
