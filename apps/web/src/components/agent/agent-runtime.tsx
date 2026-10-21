"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { usePageContext } from "@/hooks/use-page-context";
import { uiExecutor } from "@/lib/agent/executor";
import { setPageContextProvider } from "@/stores/agent-store";

/** Connects the agent store + executor to Next's router, the query cache and the page context. */
export function AgentRuntime() {
  const router = useRouter();
  const qc = useQueryClient();
  const context = usePageContext();
  const ref = React.useRef(context);
  ref.current = context;
  React.useEffect(() => {
    uiExecutor.attach(router, qc);
  }, [router, qc]);
  React.useEffect(() => {
    setPageContextProvider(() => ref.current);
  }, []);
  return null;
}
