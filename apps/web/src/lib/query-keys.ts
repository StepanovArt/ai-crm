/**
 * Query key factory. Agent `invalidate` ui_actions send key prefixes such as ["deals"],
 * which TanStack Query matches against these keys by prefix.
 */
export type ListArgs = {
  q?: string;
  sort?: string;
  filter?: Record<string, unknown>;
  limit?: number;
};

export const qk = {
  me: ["me"] as const,
  workspace: ["workspace"] as const,
  fields: {
    all: ["fields"] as const,
    list: (objectType?: string) => ["fields", objectType ?? "all"] as const,
  },
  pipelines: {
    all: ["pipelines"] as const,
    list: () => ["pipelines", "list"] as const,
    board: (id: string, filter?: Record<string, unknown>) =>
      ["pipelines", "board", id, filter ?? {}] as const,
  },
  companies: {
    all: ["companies"] as const,
    list: (args: ListArgs) => ["companies", "list", args] as const,
    detail: (id: string) => ["companies", "detail", id] as const,
  },
  contacts: {
    all: ["contacts"] as const,
    list: (args: ListArgs) => ["contacts", "list", args] as const,
    detail: (id: string) => ["contacts", "detail", id] as const,
    score: (id: string) => ["contacts", "score", id] as const,
  },
  deals: {
    all: ["deals"] as const,
    list: (args: ListArgs) => ["deals", "list", args] as const,
    detail: (id: string) => ["deals", "detail", id] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (args: ListArgs) => ["tasks", "list", args] as const,
  },
  notes: {
    all: ["notes"] as const,
    list: (type: string, id: string) => ["notes", type, id] as const,
  },
  activities: {
    all: ["activities"] as const,
    list: (type: string, id: string) => ["activities", type, id] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    today: () => ["dashboard", "today"] as const,
  },
  agent: {
    all: ["agent"] as const,
    insights: (type: string, id: string) => ["agent", "insights", type, id] as const,
    briefing: () => ["agent", "briefing"] as const,
    conversations: () => ["agent", "conversations"] as const,
  },
};
