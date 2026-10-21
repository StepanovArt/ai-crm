"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { streamSSE } from "@/lib/agent/sse";
import { api, unwrap } from "@/lib/api/client";
import {
  applyOnboardingEvent,
  initialOnboarding,
  startBuilding,
  type OnboardingEvent,
  type OnboardingState,
} from "@/lib/onboarding/state";
import { qk } from "@/lib/query-keys";

export function useOnboardingTemplates() {
  return useQuery({
    queryKey: ["onboarding", "templates"],
    queryFn: () => unwrap(api.GET("/api/v1/onboarding/templates")),
    staleTime: Infinity,
  });
}

/** "Skip, use demo workspace": fills the workspace instantly from the demo template. */
export function useDemoWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/onboarding/demo", { body: {} })),
    onSuccess: (me) => {
      qc.clear();
      qc.setQueryData(qk.me, me);
    },
  });
}

type Action = { type: "start" } | { type: "event"; event: OnboardingEvent } | { type: "reset" };

function reducer(state: OnboardingState, action: Action): OnboardingState {
  if (action.type === "start") return startBuilding();
  if (action.type === "reset") return { ...initialOnboarding };
  return applyOnboardingEvent(state, action.event);
}

/** Streams `/onboarding/generate` into reducer state; aborts on unmount. */
export function useOnboardingGenerator() {
  const [state, dispatch] = React.useReducer(reducer, initialOnboarding);
  const controller = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => controller.current?.abort(), []);

  const generate = React.useCallback(async (description: string) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    dispatch({ type: "start" });
    let finished = false;
    try {
      await streamSSE<OnboardingEvent>("/api/v1/onboarding/generate", {
        body: { description },
        signal: ctrl.signal,
        retries: 1,
        onEvent: (event) => {
          if (event.type === "done" || event.type === "error") finished = true;
          dispatch({ type: "event", event });
        },
      });
      if (!finished && !ctrl.signal.aborted)
        throw new Error("Connection lost — nothing was saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection lost";
      dispatch({ type: "event", event: { type: "error", message } });
    }
  }, []);

  const reset = React.useCallback(() => {
    controller.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  return { state, generate, reset };
}
