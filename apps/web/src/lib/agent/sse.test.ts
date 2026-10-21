import { describe, expect, it } from "vitest";

import { parseSSE } from "./sse";

describe("parseSSE", () => {
  it("splits complete events and keeps the tail", () => {
    const { events, rest } = parseSSE('data: {"a":1}\n\ndata: {"b":2}\n\ndata: {"c"');
    expect(events).toEqual(['{"a":1}', '{"b":2}']);
    expect(rest).toBe('data: {"c"');
  });
  it("ignores pings/comments and handles CRLF", () => {
    const { events } = parseSSE(': ping\r\n\r\ndata: {"x":true}\r\n\r\n');
    expect(events).toEqual(['{"x":true}']);
  });
});
