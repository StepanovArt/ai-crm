import { describe, expect, it } from "vitest";

import {
  applyEvent,
  hydrate,
  setPlanStatus,
  type AssistantMessage,
  type ChatMessage,
} from "./reducer";
import type { AgentEvent } from "./types";

function run(events: AgentEvent[], start: ChatMessage[] = []) {
  return events.reduce(applyEvent, start);
}

const start: AgentEvent = { type: "message_start", message_id: "m1", conversation_id: "c1" };

describe("applyEvent", () => {
  it("merges tokens into one text block and clears thinking", () => {
    const out = run([
      start,
      { type: "thinking", label: "Looking" },
      { type: "token", text: "Hello " },
      { type: "token", text: "world" },
    ]);
    const msg = out[0] as AssistantMessage;
    expect(msg.blocks).toEqual([{ type: "text", text: "Hello world" }]);
    expect(msg.thinking).toBeNull();
  });

  it("tracks tool calls from running to ok", () => {
    const out = run([
      start,
      { type: "tool_call", call_id: "t1", tool: "search_records", label: "Searching", args: {} },
      { type: "tool_result", call_id: "t1", ok: true, summary: "Found 3 deals", data: null },
    ]);
    expect((out[0] as AssistantMessage).blocks[0]).toMatchObject({
      type: "tool",
      status: "ok",
      summary: "Found 3 deals",
    });
  });

  it("keeps text, plan and card blocks in order and records undo ids", () => {
    const out = run([
      start,
      { type: "token", text: "Plan:" },
      {
        type: "plan",
        plan_id: "p1",
        title: "Do it",
        steps: [{ id: "s1", label: "Step", tool: "create_task" }],
      },
      { type: "card", kind: "records", data: { title: "x", items: [] } },
      { type: "message_end", message_id: "m1", undo_action_ids: ["a1"], suggestions: ["Next"] },
    ]);
    const msg = out[0] as AssistantMessage;
    expect(msg.blocks.map((b) => b.type)).toEqual(["text", "plan", "card"]);
    expect(msg.undoIds).toEqual(["a1"]);
    expect(msg.suggestions).toEqual(["Next"]);
    expect(msg.status).toBe("done");
    expect(setPlanStatus(out, "p1", "rejected")[0]).toMatchObject({
      blocks: [{}, { status: "rejected" }, {}],
    });
  });

  it("marks unfinished tool calls as failed when the message ends", () => {
    const out = run([
      start,
      { type: "tool_call", call_id: "t1", tool: "x", label: "x", args: {} },
      { type: "error", message: "boom" },
      { type: "message_end", message_id: "m1", undo_action_ids: null, suggestions: null },
    ]);
    const msg = out[0] as AssistantMessage;
    expect(msg.status).toBe("error");
    expect(msg.blocks[0]).toMatchObject({ status: "error" });
  });
});

describe("hydrate", () => {
  it("rebuilds messages, plan status and undone state", () => {
    const out = hydrate(
      [
        { id: "u1", role: "user", content: "hi", events: [] },
        {
          id: "a1",
          role: "assistant",
          content: "ok",
          events: [
            { type: "token", text: "ok" },
            { type: "plan", plan_id: "p1", title: "t", steps: [] },
            { type: "message_end", message_id: "a1", undo_action_ids: ["x"], suggestions: null },
          ],
        },
      ],
      { p1: "executed" },
      ["x"],
    );
    expect(out[0]).toEqual({ role: "user", id: "u1", text: "hi" });
    const msg = out[1] as AssistantMessage;
    expect(msg.undone).toBe(true);
    expect(msg.blocks[1]).toMatchObject({ type: "plan", status: "executed" });
  });
});
