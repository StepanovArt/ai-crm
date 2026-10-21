"use client";

import * as React from "react";
import { SquareKanban } from "lucide-react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePipelines } from "@/hooks/use-pipelines";

export default function PipelineIndex() {
  const router = useRouter();
  const { data, isLoading } = usePipelines();
  const first = data?.[0];
  React.useEffect(() => {
    if (first) router.replace(`/pipeline/${first.id}`);
  }, [first, router]);
  if (isLoading || first)
    return (
      <div className="flex gap-3 px-6 pt-20">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-96 w-[284px] rounded-xl" />
        ))}
      </div>
    );
  return (
    <EmptyState
      icon={SquareKanban}
      title="No pipeline yet"
      hint="Create one in Settings → Pipelines."
    />
  );
}
