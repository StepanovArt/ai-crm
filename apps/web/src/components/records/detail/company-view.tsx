"use client";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Avatar, CompanyLogo } from "@/components/common/avatar";
import { MoneyText } from "@/components/common/money";
import { RelativeDate } from "@/components/common/relative-date";
import { Timeline } from "@/components/timeline/timeline";
import { useFields } from "@/hooks/use-fields";
import type { Company } from "@/hooks/use-records";
import { useMembers, useTerms } from "@/hooks/use-workspace";
import { companyDescriptors } from "@/lib/records/descriptors";
import { useBreadcrumb } from "@/stores/breadcrumb-store";

import { FieldsPanel } from "./fields-panel";
import { RecordHeader } from "./record-header";
import { RecordLayout } from "./record-layout";
import { RecordTasks } from "./record-tasks";
import { CompanyRelated } from "./related-panel";
import { useRecordActions } from "./use-record-actions";

export function CompanyView({ company, insight }: { company: Company; insight?: React.ReactNode }) {
  const t = useTerms();
  const { byId } = useMembers();
  const { data: defs } = useFields("company");
  const actions = useRecordActions("company", company.id, "/companies", t.company);
  useBreadcrumb([{ label: t.companies, href: "/companies" }, { label: company.name }]);
  const owner = company.owner_id ? byId.get(company.owner_id) : undefined;
  return (
    <>
      <RecordLayout
        header={
          <RecordHeader
            type="company"
            id={company.id}
            icon={
              <CompanyLogo
                name={company.name}
                src={company.logo_url}
                size="xl"
                className="rounded-xl"
              />
            }
            title={company.name}
            subtitle={[
              company.domain,
              company.industry,
              company.size && `${company.size} employees`,
            ]
              .filter(Boolean)
              .map((s, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="opacity-40">·</span>}
                  {s}
                </span>
              ))}
            stats={[
              {
                label: t.contacts,
                value: <span className="tabular">{company.contacts_count}</span>,
              },
              {
                label: `Open ${t.deals.toLowerCase()}`,
                value: (
                  <span className="tabular">
                    {company.open_deals_count} · <MoneyText value={company.open_deals_value} />
                  </span>
                ),
              },
              { label: "Last activity", value: <RelativeDate value={company.last_activity_at} /> },
              {
                label: "Owner",
                value: owner ? (
                  <span className="flex items-center gap-1.5">
                    <Avatar name={owner.full_name} size="xs" /> {owner.full_name}
                  </span>
                ) : (
                  "—"
                ),
              },
            ]}
            onAskAi={actions.askAi}
            onDelete={actions.requestDelete}
          />
        }
        left={
          defs && (
            <FieldsPanel
              type="company"
              record={company}
              descriptors={companyDescriptors(defs, t)}
            />
          )
        }
        center={<Timeline type="company" id={company.id} />}
        right={
          <>
            {insight}
            <RecordTasks type="company" id={company.id} />
            <CompanyRelated company={company} />
          </>
        }
      />
      <ConfirmDialog
        open={actions.confirmOpen}
        onOpenChange={actions.setConfirmOpen}
        title={`Delete ${company.name}?`}
        description="Its notes, tasks and timeline are removed. Contacts and deals stay but lose the link."
        busy={actions.busy}
        onConfirm={actions.confirmDelete}
      />
    </>
  );
}
