"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useDeleteRecords, type RecordType } from "@/hooks/use-records";
import { useUIStore } from "@/stores/ui-store";

export function useRecordActions(type: RecordType, id: string, listHref: string, label: string) {
  const router = useRouter();
  const remove = useDeleteRecords(type);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const openAgent = useUIStore((s) => s.setAgentPanelOpen);
  return {
    confirmOpen,
    setConfirmOpen,
    busy: remove.isPending,
    askAi: () => openAgent(true),
    requestDelete: () => setConfirmOpen(true),
    confirmDelete: async () => {
      await remove.mutateAsync([id]);
      toast.success(`${label} deleted`);
      setConfirmOpen(false);
      router.push(listHref);
    },
  };
}
