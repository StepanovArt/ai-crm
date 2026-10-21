/** Pure reducer: AgentEvents → chat transcript. ui_actions are handled by the executor, not stored. */
import type { AgentEvent, CardKind, PlanStepOut } from "./types";

export type PlanStatus = "proposed" | "approving" | "approved" | "executed" | "rejected";

export type Block =
  | { type: "text"; text: string }
  | {
      type: "tool";
      callId: string;
      tool: string;
      label: string;
      status: "running" | "ok" | "error";
      summary?: string;
    }
  | { type: "plan"; planId: string; title: string; steps: PlanStepOut[]; status: PlanStatus }
  | { type: "card"; kind: CardKind; data: Record<string, unknown> }
  | { type: "error"; message: string };

export type AssistantMessage = {
  role: "assistant";
  id: string;
  status: "streaming" | "done" | "error";
  blocks: Block[];
  thinking: string | null;
  undoIds: string[];
  undone: boolean;
  suggestions: string[];
};

export type UserMessage = { role: "user"; id: string; text: string };
export type ChatMessage = UserMessage | AssistantMessage;

export function newAssistant(id: string): AssistantMessage {
  return {
    role: "assistant",
    id,
    status: "streaming",
    blocks: [],
    thinking: null,
    undoIds: [],
    undone: false,
    suggestions: [],
  };
}

function updateLast(
  messages: ChatMessage[],
  fn: (m: AssistantMessage) => AssistantMessage,
): ChatMessage[] {
  const idx = messages.length - 1;
  const last = messages[idx];
  if (!last || last.role !== "assistant") return messages;
  const next = messages.slice();
  next[idx] = fn(last);
  return next;
}

/** Apply one event to the transcript. The streaming assistant message is always the last one. */
export function applyEvent(messages: ChatMessage[], event: AgentEvent): ChatMessage[] {
  switch (event.type) {
    case "message_start": {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && last.status === "streaming" && last.blocks.length === 0) {
        return updateLast(messages, (m) => ({ ...m, id: event.message_id }));
      }
      return [...messages, newAssistant(event.message_id)];
    }
    case "token":
      return updateLast(messages, (m) => {
        const blocks = m.blocks.slice();
        const tail = blocks[blocks.length - 1];
        if (tail?.type === "text")
          blocks[blocks.length - 1] = { ...tail, text: tail.text + event.text };
        else blocks.push({ type: "text", text: event.text });
        return { ...m, blocks, thinking: null };
      });
    case "thinking":
      return updateLast(messages, (m) => ({ ...m, thinking: event.label }));
    case "tool_call":
      return updateLast(messages, (m) => ({
        ...m,
        thinking: null,
        blocks: [
          ...m.blocks,
          {
            type: "tool",
            callId: event.call_id,
            tool: event.tool,
            label: event.label,
            status: "running",
          },
        ],
      }));
    case "tool_result":
      return updateLast(messages, (m) => ({
        ...m,
        blocks: m.blocks.map((b) =>
          b.type === "tool" && b.callId === event.call_id
            ? { ...b, status: event.ok ? "ok" : "error", summary: event.summary }
            : b,
        ),
      }));
    case "plan":
      return updateLast(messages, (m) => ({
        ...m,
        thinking: null,
        blocks: [
          ...m.blocks,
          {
            type: "plan",
            planId: event.plan_id,
            title: event.title,
            steps: event.steps,
            status: "proposed",
          },
        ],
      }));
    case "card":
      return updateLast(messages, (m) => ({
        ...m,
        blocks: [
          ...m.blocks,
          { type: "card", kind: event.kind, data: event.data as Record<string, unknown> },
        ],
      }));
    case "error":
      return updateLast(messages, (m) => ({
        ...m,
        thinking: null,
        status: "error",
        blocks: [...m.blocks, { type: "error", message: event.message }],
      }));
    case "message_end":
      return updateLast(messages, (m) => ({
        ...m,
        status: m.status === "error" ? "error" : "done",
        thinking: null,
        undoIds: event.undo_action_ids ?? [],
        suggestions: event.suggestions ?? [],
        blocks: m.blocks.map((b) =>
          b.type === "tool" && b.status === "running" ? { ...b, status: "error" } : b,
        ),
      }));
    default:
      return messages;
  }
}

export function setPlanStatus(
  messages: ChatMessage[],
  planId: string,
  status: PlanStatus,
): ChatMessage[] {
  return messages.map((m) =>
    m.role !== "assistant"
      ? m
      : {
          ...m,
          blocks: m.blocks.map((b) =>
            b.type === "plan" && b.planId === planId ? { ...b, status } : b,
          ),
        },
  );
}

/** Rebuild a transcript from stored messages (GET /agent/conversations/{id}). */
export function hydrate(
  stored: { id: string; role: string; content: string; events: Record<string, unknown>[] }[],
  planStatus: Record<string, string>,
  undone: string[],
): ChatMessage[] {
  let out: ChatMessage[] = [];
  for (const msg of stored) {
    if (msg.role === "user") {
      out.push({ role: "user", id: msg.id, text: msg.content });
      continue;
    }
    out.push(newAssistant(msg.id));
    for (const ev of msg.events as AgentEvent[]) {
      if (ev.type === "message_start") continue;
      out = applyEvent(out, ev);
    }
    out = updateLast(out, (m) => ({
      ...m,
      status: m.status === "streaming" ? "done" : m.status,
      undone: m.undoIds.length > 0 && m.undoIds.every((id) => undone.includes(id)),
    }));
  }
  for (const [planId, status] of Object.entries(planStatus))
    out = setPlanStatus(out, planId, status as PlanStatus);
  return out;
}
