import { create } from "zustand";
import { toast } from "sonner";

import { api, unwrap } from "@/lib/api/client";
import { uiExecutor } from "@/lib/agent/executor";
import {
  applyEvent,
  hydrate,
  newAssistant,
  setPlanStatus,
  type ChatMessage,
} from "@/lib/agent/reducer";
import { streamAgent } from "@/lib/agent/sse";
import type { AgentEvent, PageContext, UIAction } from "@/lib/agent/types";
import { useUIStore } from "@/stores/ui-store";

type AgentState = {
  conversationId: string | null;
  messages: ChatMessage[];
  streaming: boolean;
  controller: AbortController | null;
  send: (text: string) => Promise<void>;
  approve: (planId: string) => Promise<void>;
  reject: (planId: string) => Promise<void>;
  undo: (messageId: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
  load: (conversationId: string) => Promise<void>;
};

let contextProvider: () => PageContext = () => ({
  route: "/",
  selected_ids: [],
  visible_filters: {},
});

/** The AgentRuntime component registers how to read the current page context. */
export function setPageContextProvider(fn: () => PageContext) {
  contextProvider = fn;
}

let sendQueue: Promise<void> = Promise.resolve();

/** Resolves once no agent run is streaming or animating. */
function whenIdle(): Promise<void> {
  if (!useAgentStore.getState().streaming) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useAgentStore.subscribe((s) => {
      if (!s.streaming) {
        unsubscribe();
        resolve();
      }
    });
  });
}

function tempId() {
  return `local-${Math.random().toString(36).slice(2)}`;
}

export const useAgentStore = create<AgentState>((set, get) => {
  function onEvent(event: AgentEvent) {
    if (event.type === "ui_action") {
      void uiExecutor.enqueue(event.action as UIAction);
      return;
    }
    if (event.type === "message_start" && event.conversation_id) {
      set({ conversationId: event.conversation_id });
    }
    set((s) => ({ messages: applyEvent(s.messages, event) }));
  }

  async function runStream(path: string, body: unknown, method: "POST" | "GET" = "POST") {
    const controller = new AbortController();
    set((s) => ({
      streaming: true,
      controller,
      messages: [...s.messages, newAssistant(tempId())],
    }));
    try {
      await streamAgent(path, { method, body, signal: controller.signal, onEvent });
    } catch (err) {
      onEvent({ type: "error", message: err instanceof Error ? err.message : "Connection lost" });
      onEvent({ type: "message_end", message_id: "", undo_action_ids: null, suggestions: null });
    } finally {
      // Let queued UI actions finish before the composer unlocks.
      await uiExecutor.idle();
      set({ streaming: false, controller: null });
    }
  }

  return {
    conversationId: null,
    messages: [],
    streaming: false,
    controller: null,

    send(text) {
      const message = text.trim();
      if (!message) return Promise.resolve();
      useUIStore.getState().setAgentPanelOpen(true);
      // Show the message right away; if a run (or its UI animations) is still going, start once
      // it finishes instead of dropping the message. Sends are serialized.
      set((s) => ({ messages: [...s.messages, { role: "user", id: tempId(), text: message }] }));
      sendQueue = sendQueue
        .then(async () => {
          await whenIdle();
          await runStream("/api/v1/agent/chat", {
            conversation_id: get().conversationId,
            message,
            context: contextProvider(),
          });
        })
        .catch(() => undefined);
      return sendQueue;
    },

    async approve(planId) {
      if (get().streaming) return;
      set((s) => ({ messages: setPlanStatus(s.messages, planId, "approving") }));
      await runStream(`/api/v1/agent/plans/${planId}/approve`, { context: contextProvider() });
      set((s) => ({ messages: setPlanStatus(s.messages, planId, "executed") }));
    },

    async reject(planId) {
      try {
        await unwrap(
          api.POST("/api/v1/agent/plans/{plan_id}/reject", {
            params: { path: { plan_id: planId } },
          }),
        );
        set((s) => {
          const reply = { ...newAssistant(tempId()), status: "done" as const };
          reply.blocks = [{ type: "text", text: "Okay — I won't make those changes." }];
          return { messages: [...setPlanStatus(s.messages, planId, "rejected"), reply] };
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not reject the plan");
      }
    },

    async undo(messageId) {
      const msg = get().messages.find((m) => m.id === messageId);
      if (!msg || msg.role !== "assistant" || !msg.undoIds.length) return;
      try {
        const res = await unwrap(
          api.POST("/api/v1/agent/actions/undo", { body: { action_ids: msg.undoIds } }),
        );
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId && m.role === "assistant" ? { ...m, undone: true } : m,
          ),
        }));
        for (const action of res.ui_actions) await uiExecutor.enqueue(action as UIAction);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Undo failed");
      }
    },

    stop() {
      get().controller?.abort();
    },

    reset() {
      get().controller?.abort();
      set({ conversationId: null, messages: [], streaming: false, controller: null });
    },

    async load(conversationId) {
      const detail = await unwrap(
        api.GET("/api/v1/agent/conversations/{conversation_id}", {
          params: { path: { conversation_id: conversationId } },
        }),
      );
      set({
        conversationId,
        messages: hydrate(detail.messages, detail.plan_status, detail.undone_action_ids),
      });
    },
  };
});
