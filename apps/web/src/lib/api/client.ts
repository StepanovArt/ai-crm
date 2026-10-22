import createClient from "openapi-fetch";

import type { components, paths } from "./schema";

/**
 * Where the API lives. Unset → local dev API. Empty string → same origin: the browser calls
 * `/api/...` on the current host and a reverse proxy / Kubernetes ingress routes it (Docker
 * images are built this way, so one image works on any domain).
 */
const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL;
export const API_URL =
  RAW_API_URL === undefined ? "http://localhost:8000" : RAW_API_URL.replace(/\/$/, "");

export const api = createClient<paths>({ baseUrl: API_URL, credentials: "include" });

export type Schemas = components["schemas"];

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ErrorBody = { error?: { code?: string; message?: string } };

/** Unwrap an openapi-fetch result: return data or throw a typed ApiError. */
export async function unwrap<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await request;
  if (error !== undefined || !response.ok) {
    const body = (error ?? {}) as ErrorBody;
    throw new ApiError(
      body.error?.message ?? `Request failed (${response.status})`,
      response.status,
      body.error?.code ?? "error",
    );
  }
  return data as T;
}

export function filterParam(filter: Record<string, unknown> | undefined): string | undefined {
  if (!filter) return undefined;
  const clean = Object.fromEntries(
    Object.entries(filter).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
  return Object.keys(clean).length ? JSON.stringify(clean) : undefined;
}
