import { API_URL } from "@/lib/api/client";

import type { AgentEvent } from "./types";

export class StreamError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "StreamError";
  }
}

type StreamOptions<E> = {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
  onEvent: (event: E) => void;
  /** Retries only happen if the connection fails before the first event (safe to resend). */
  retries?: number;
};

/** Parse an SSE text buffer into complete `data:` payloads, returning the unconsumed tail. */
export function parseSSE(buffer: string): { events: string[]; rest: string } {
  const events: string[] = [];
  const normalized = buffer.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).replace(/^ /, ""))
      .join("\n");
    if (data) events.push(data);
  }
  return { events, rest };
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

/** fetch + ReadableStream SSE client (EventSource can't POST or send credentials cross-origin). */
export async function streamSSE<E>(path: string, opts: StreamOptions<E>): Promise<void> {
  const retries = opts.retries ?? 2;
  let received = false;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method: opts.method ?? "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: opts.signal,
      });
      if (!res.ok || !res.body) throw new StreamError(await errorMessage(res), res.status);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSSE(buffer);
        buffer = rest;
        for (const raw of events) {
          received = true;
          opts.onEvent(JSON.parse(raw) as E);
        }
      }
      return;
    } catch (err) {
      if (opts.signal?.aborted) return;
      const retryable =
        !received &&
        attempt < retries &&
        !(err instanceof StreamError && err.status && err.status < 500);
      if (!retryable) throw err instanceof Error ? err : new StreamError(String(err));
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}

export function streamAgent(path: string, opts: StreamOptions<AgentEvent>): Promise<void> {
  return streamSSE<AgentEvent>(path, opts);
}
