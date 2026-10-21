import type { RecordType } from "@/hooks/use-records";

export type SavedView = {
  key: string;
  label: string;
  filter?: (meId: string) => Record<string, unknown>;
  sort?: string;
};

export const VIEWS: Record<RecordType, SavedView[]> = {
  company: [
    { key: "all", label: "All" },
    { key: "mine", label: "Mine", filter: (me) => ({ owner_id: me }) },
  ],
  contact: [
    { key: "all", label: "All" },
    { key: "hot", label: "Hot leads", filter: () => ({ score_min: 70 }), sort: "-score" },
    { key: "mine", label: "Mine", filter: (me) => ({ owner_id: me }) },
    { key: "customers", label: "Customers", filter: () => ({ lead_status: "customer" }) },
  ],
  deal: [
    { key: "open", label: "Open", filter: () => ({ status: "open" }) },
    { key: "mine", label: "Mine", filter: (me) => ({ owner_id: me, status: "open" }) },
    { key: "stale", label: "Stale", filter: () => ({ stale_days: 7 }), sort: "last_activity_at" },
    { key: "won", label: "Won", filter: () => ({ status: "won" }) },
    { key: "all", label: "All" },
  ],
};

/** Human labels for ad-hoc filter chips (e.g. filters applied by the agent). */
export function describeFilter(key: string, value: unknown): string {
  switch (key) {
    case "score_min":
      return `Score ≥ ${String(value)}`;
    case "score_max":
      return `Score ≤ ${String(value)}`;
    case "stale_days":
      return `No activity ${String(value)}d+`;
    case "value_min":
      return `Value ≥ ${String(value)}`;
    case "value_max":
      return `Value ≤ ${String(value)}`;
    case "status":
      return `Status: ${String(value)}`;
    case "lead_status":
      return `Lead status: ${String(value)}`;
    case "owner_id":
      return "Owner";
    case "stage_id":
      return "Stage";
    default:
      return `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`;
  }
}
