"use client";

import Link from "next/link";
import { CircleDollarSign } from "lucide-react";

import { AgentBadge } from "@/components/common/agent-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { MoneyText } from "@/components/common/money";
import { RelativeDate } from "@/components/common/relative-date";
import { StatusBadge } from "@/components/common/status-badge";
import { Timeline } from "@/components/timeline/timeline";
import { useFields } from "@/hooks/use-fields";
import { usePipelines } from "@/hooks/use-pipelines";
import type { Deal } from "@/hooks/use-records";
import { useTerms } from "@/hooks/use-workspace";
import { colorClasses } from "@/lib/colors";
import { daysSince, formatDate } from "@/lib/format";
import { dealDescriptors } from "@/lib/records/descriptors";
import { cn } from "@/lib/utils";
import { useBreadcrumb } from "@/stores/breadcrumb-store";

import { FieldsPanel } from "./fields-panel";
import { RecordHeader } from "./record-header";
import { RecordLayout } from "./record-layout";
import { RecordTasks } from "./record-tasks";
import { DealRelated } from "./related-panel";
import { useRecordActions } from "./use-record-actions";

export function DealView({ deal, insight }: { deal: Deal; insight?: React.ReactNode }) {
  const t = useTerms();
  const { data: defs } = useFields("deal");
  const { data: pipelines } = usePipelines();
  const actions = useRecordActions("deal", deal.id, "/deals", t.deal);
  useBreadcrumb([{ label: t.deals, href: "/deals" }, { label: deal.name }]);
  const stages = pipelines?.flatMap((p) => p.stages) ?? [];
  const color = deal.stage?.color ?? "slate";
  const inStage = daysSince(deal.stage_entered_at);
  return (
    <>
      <RecordLayout
        header={
          <RecordHeader
            type="deal"
            id={deal.id}
            icon={
              <span
                className={cn(
                  "flex size-12 items-center justify-center rounded-xl",
                  colorClasses(color).soft,
                )}
              >
                <CircleDollarSign className="size-6" />
              </span>
            }
            title={deal.name}
            badges={
              <>
                {deal.stage && <StatusBadge label={deal.stage.name} color={color} dot />}
                {deal.agent_touched_at && (
                  <AgentBadge label="Recently updated by Halo AI" withText />
                )}
              </>
            }
            subtitle={
              <>
                {deal.company && (
                  <Link
                    href={`/records/company/${deal.company.id}`}
                    className="font-medium text-foreground/80 hover:underline"
                  >
                    {deal.company.name}
                  </Link>
                )}
                {deal.primary_contact && (
                  <>
                    <span className="opacity-40">·</span>
                    <Link
                      href={`/records/contact/${deal.primary_contact.id}`}
                      className="hover:underline"
                    >
                      {deal.primary_contact.full_name}
                    </Link>
                  </>
                )}
              </>
            }
            stats={[
              {
                label: "Value",
                value: (
                  <MoneyText value={deal.value} currency={deal.currency} className="text-base" />
                ),
              },
              {
                label: "Probability",
                value: <span className="tabular">{deal.stage?.probability ?? 0}%</span>,
              },
              { label: "Expected close", value: formatDate(deal.expected_close) },
              {
                label: "In stage",
                value: inStage === null ? "—" : <span className="tabular">{inStage}d</span>,
              },
              { label: "Last activity", value: <RelativeDate value={deal.last_activity_at} /> },
            ]}
            onAskAi={actions.askAi}
            onDelete={actions.requestDelete}
          />
        }
        left={
          defs && (
            <FieldsPanel type="deal" record={deal} descriptors={dealDescriptors(defs, t, stages)} />
          )
        }
        center={<Timeline type="deal" id={deal.id} />}
        right={
          <>
            {insight}
            <RecordTasks type="deal" id={deal.id} />
            <DealRelated deal={deal} />
          </>
        }
      />
      <ConfirmDialog
        open={actions.confirmOpen}
        onOpenChange={actions.setConfirmOpen}
        title={`Delete ${deal.name}?`}
        description="Its notes, tasks and timeline are removed. This can't be undone."
        busy={actions.busy}
        onConfirm={actions.confirmDelete}
      />
    </>
  );
}
