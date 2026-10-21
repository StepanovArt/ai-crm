import type { FieldDefinition, FieldType } from "@/hooks/use-fields";
import type { Company, Contact, Deal, RecordPatch, RecordType } from "@/hooks/use-records";
import type { Stage } from "@/hooks/use-pipelines";
import type { Terminology } from "@/hooks/use-workspace";
import { LEAD_STATUS } from "@/components/common/status-badge";

export type Option = { value: string; label: string; color: string };

export type DescriptorType =
  FieldType | "stage" | "company_link" | "contact_link" | "score" | "lead_status" | "datetime";

export type RecordOf<T extends RecordType> = T extends "company"
  ? Company
  : T extends "contact"
    ? Contact
    : Deal;

export interface FieldDescriptor<T extends RecordType = RecordType> {
  /** Stable key, e.g. "name" or "custom.arr" (used for column ids, visibility, sorting). */
  key: string;
  label: string;
  type: DescriptorType;
  options?: Option[];
  custom: boolean;
  editable: boolean;
  sortKey?: string;
  width: number;
  defaultHidden?: boolean;
  get: (record: RecordOf<T>) => unknown;
  patch?: (value: unknown) => RecordPatch[T];
}

function customDescriptors<T extends RecordType>(defs: FieldDefinition[]): FieldDescriptor<T>[] {
  return defs.map((d) => ({
    key: `custom.${d.key}`,
    label: d.label,
    type: d.type,
    options: d.options,
    custom: true,
    editable: true,
    sortKey: `custom.${d.key}`,
    width: d.type === "long_text" ? 260 : d.type === "multi_select" ? 220 : 160,
    get: (r: RecordOf<T>) => (r.custom as Record<string, unknown>)[d.key],
    patch: (value: unknown) => ({ custom: { [d.key]: value } }) as RecordPatch[T],
  }));
}

const leadOptions: Option[] = Object.entries(LEAD_STATUS).map(([value, m]) => ({
  value,
  label: m.label,
  color: m.color,
}));

export function companyDescriptors(defs: FieldDefinition[], t: Terminology) {
  const system: FieldDescriptor<"company">[] = [
    {
      key: "name",
      label: "Name",
      type: "text",
      custom: false,
      editable: true,
      sortKey: "name",
      width: 240,
      get: (r) => r.name,
      patch: (v) => ({ name: String(v ?? "") }),
    },
    {
      key: "domain",
      label: "Domain",
      type: "url",
      custom: false,
      editable: true,
      sortKey: "domain",
      width: 170,
      get: (r) => r.domain,
      patch: (v) => ({ domain: (v as string) || null }),
    },
    {
      key: "industry",
      label: "Industry",
      type: "text",
      custom: false,
      editable: true,
      sortKey: "industry",
      width: 140,
      get: (r) => r.industry,
      patch: (v) => ({ industry: (v as string) || null }),
    },
    {
      key: "size",
      label: "Size",
      type: "text",
      custom: false,
      editable: true,
      sortKey: "size",
      width: 100,
      get: (r) => r.size,
      patch: (v) => ({ size: (v as string) || null }),
    },
    {
      key: "owner",
      label: "Owner",
      type: "user",
      custom: false,
      editable: true,
      width: 150,
      get: (r) => r.owner_id,
      patch: (v) => ({ owner_id: (v as string) || null }),
    },
    {
      key: "contacts_count",
      label: t.contacts,
      type: "number",
      custom: false,
      editable: false,
      width: 100,
      get: (r) => r.contacts_count,
    },
    {
      key: "open_deals_value",
      label: `Open ${t.deals.toLowerCase()}`,
      type: "currency",
      custom: false,
      editable: false,
      width: 140,
      get: (r) => (r.open_deals_count ? r.open_deals_value : null),
    },
    {
      key: "last_activity_at",
      label: "Last activity",
      type: "datetime",
      custom: false,
      editable: false,
      width: 130,
      get: (r) => r.last_activity_at,
    },
    {
      key: "created_at",
      label: "Created",
      type: "datetime",
      custom: false,
      editable: false,
      sortKey: "created_at",
      width: 120,
      defaultHidden: true,
      get: (r) => r.created_at,
    },
  ];
  return [...system, ...customDescriptors<"company">(defs)];
}

export function contactDescriptors(defs: FieldDefinition[], t: Terminology) {
  const system: FieldDescriptor<"contact">[] = [
    {
      key: "name",
      label: "Name",
      type: "text",
      custom: false,
      editable: false,
      sortKey: "name",
      width: 220,
      get: (r) => r.full_name,
    },
    {
      key: "score",
      label: "Score",
      type: "score",
      custom: false,
      editable: false,
      sortKey: "score",
      width: 90,
      get: (r) => r.score,
    },
    {
      key: "title",
      label: "Title",
      type: "text",
      custom: false,
      editable: true,
      sortKey: "title",
      width: 190,
      get: (r) => r.title,
      patch: (v) => ({ title: (v as string) || null }),
    },
    {
      key: "company",
      label: t.company,
      type: "company_link",
      custom: false,
      editable: false,
      width: 190,
      get: (r) => r.company,
    },
    {
      key: "email",
      label: "Email",
      type: "email",
      custom: false,
      editable: true,
      sortKey: "email",
      width: 230,
      get: (r) => r.email,
      patch: (v) => ({ email: (v as string) || null }),
    },
    {
      key: "phone",
      label: "Phone",
      type: "phone",
      custom: false,
      editable: true,
      width: 160,
      defaultHidden: true,
      get: (r) => r.phone,
      patch: (v) => ({ phone: (v as string) || null }),
    },
    {
      key: "lead_status",
      label: "Lead status",
      type: "lead_status",
      options: leadOptions,
      custom: false,
      editable: true,
      sortKey: "lead_status",
      width: 130,
      get: (r) => r.lead_status,
      patch: (v) => ({ lead_status: v as RecordPatch["contact"]["lead_status"] }),
    },
    {
      key: "owner",
      label: "Owner",
      type: "user",
      custom: false,
      editable: true,
      width: 150,
      get: (r) => r.owner_id,
      patch: (v) => ({ owner_id: (v as string) || null }),
    },
    {
      key: "last_activity_at",
      label: "Last activity",
      type: "datetime",
      custom: false,
      editable: false,
      width: 130,
      get: (r) => r.last_activity_at,
    },
  ];
  return [...system, ...customDescriptors<"contact">(defs)];
}

export function dealDescriptors(defs: FieldDefinition[], t: Terminology, stages: Stage[]) {
  const stageOptions: Option[] = stages.map((s) => ({
    value: s.id,
    label: s.name,
    color: s.color,
  }));
  const system: FieldDescriptor<"deal">[] = [
    {
      key: "name",
      label: "Name",
      type: "text",
      custom: false,
      editable: true,
      sortKey: "name",
      width: 280,
      get: (r) => r.name,
      patch: (v) => ({ name: String(v ?? "") }),
    },
    {
      key: "stage",
      label: "Stage",
      type: "stage",
      options: stageOptions,
      custom: false,
      editable: true,
      sortKey: "stage",
      width: 150,
      get: (r) => r.stage_id,
      patch: (v) => ({ stage_id: v as string }),
    },
    {
      key: "value",
      label: "Value",
      type: "currency",
      custom: false,
      editable: true,
      sortKey: "value",
      width: 120,
      get: (r) => r.value,
      patch: (v) => ({ value: (v as string) || "0" }),
    },
    {
      key: "company",
      label: t.company,
      type: "company_link",
      custom: false,
      editable: false,
      width: 180,
      get: (r) => r.company,
    },
    {
      key: "primary_contact",
      label: "Primary contact",
      type: "contact_link",
      custom: false,
      editable: false,
      width: 170,
      get: (r) => r.primary_contact,
    },
    {
      key: "owner",
      label: "Owner",
      type: "user",
      custom: false,
      editable: true,
      width: 150,
      get: (r) => r.owner_id,
      patch: (v) => ({ owner_id: (v as string) || null }),
    },
    {
      key: "expected_close",
      label: "Expected close",
      type: "date",
      custom: false,
      editable: true,
      sortKey: "expected_close",
      width: 130,
      get: (r) => r.expected_close,
      patch: (v) => ({ expected_close: (v as string) || null }),
    },
    {
      key: "last_activity_at",
      label: "Last activity",
      type: "datetime",
      custom: false,
      editable: false,
      sortKey: "last_activity_at",
      width: 130,
      get: (r) => r.last_activity_at,
    },
  ];
  return [...system, ...customDescriptors<"deal">(defs)];
}

/** Normalise an editor value before sending it to the API. */
export function normalizeValue(type: DescriptorType, raw: unknown): unknown {
  if (raw === "" || raw === undefined) return null;
  if (type === "number" && typeof raw === "string") {
    const n = Number(raw.replace(/,/g, ""));
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}
