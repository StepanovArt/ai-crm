"use client";

import type { RecordType } from "@/hooks/use-records";
import { useUpdateRecord } from "@/hooks/use-records";
import type { FieldDescriptor, RecordOf } from "@/lib/records/descriptors";

import { EditableField } from "../editable-field";

export function FieldsPanel<T extends RecordType>({
  type,
  record,
  descriptors,
}: {
  type: T;
  record: RecordOf<T>;
  descriptors: FieldDescriptor<T>[];
}) {
  const update = useUpdateRecord(type);
  const system = descriptors.filter((d) => !d.custom);
  const custom = descriptors.filter((d) => d.custom);
  const currency = "currency" in record ? (record.currency as string) : undefined;

  const row = (d: FieldDescriptor<T>) => (
    <div
      key={d.key}
      className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-2 py-0.5 text-[13px]"
    >
      <dt className="truncate text-muted-foreground">{d.label}</dt>
      <dd className="min-w-0">
        <EditableField
          type={d.type}
          value={d.get(record)}
          options={d.options}
          label={d.label}
          editable={d.editable}
          recordId={record.id}
          currency={currency}
          onSave={(v) => d.patch && update.mutate({ id: record.id, patch: d.patch(v) })}
          className="min-h-7"
        />
      </dd>
    </div>
  );

  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Details
        </h2>
        <dl className="space-y-0.5">{system.map(row)}</dl>
      </section>
      {custom.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Custom fields
          </h2>
          <dl className="space-y-0.5" data-agent-id={`custom-fields-${type}`}>
            {custom.map(row)}
          </dl>
        </section>
      )}
    </div>
  );
}
