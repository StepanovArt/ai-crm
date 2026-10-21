"use client";

import Link from "next/link";
import { Mail, Phone } from "lucide-react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Avatar } from "@/components/common/avatar";
import { RelativeDate } from "@/components/common/relative-date";
import { ScoreBadge } from "@/components/common/score-badge";
import { LeadStatusBadge } from "@/components/common/status-badge";
import { Timeline } from "@/components/timeline/timeline";
import { useFields } from "@/hooks/use-fields";
import type { Contact } from "@/hooks/use-records";
import { useTerms } from "@/hooks/use-workspace";
import { contactDescriptors } from "@/lib/records/descriptors";
import { useBreadcrumb } from "@/stores/breadcrumb-store";

import { FieldsPanel } from "./fields-panel";
import { RecordHeader } from "./record-header";
import { RecordLayout } from "./record-layout";
import { RecordTasks } from "./record-tasks";
import { ContactRelated } from "./related-panel";
import { useRecordActions } from "./use-record-actions";

export function ContactView({ contact, insight }: { contact: Contact; insight?: React.ReactNode }) {
  const t = useTerms();
  const { data: defs } = useFields("contact");
  const actions = useRecordActions("contact", contact.id, "/contacts", t.contact);
  useBreadcrumb([{ label: t.contacts, href: "/contacts" }, { label: contact.full_name }]);
  return (
    <>
      <RecordLayout
        header={
          <RecordHeader
            type="contact"
            id={contact.id}
            icon={<Avatar name={contact.full_name} size="xl" />}
            title={contact.full_name}
            badges={
              <>
                <ScoreBadge score={contact.score} contactId={contact.id} />
                <LeadStatusBadge status={contact.lead_status} />
              </>
            }
            subtitle={
              <>
                {contact.title && <span>{contact.title}</span>}
                {contact.company && (
                  <>
                    <span className="opacity-60">at</span>
                    <Link
                      href={`/records/company/${contact.company.id}`}
                      className="font-medium text-foreground/80 hover:underline"
                    >
                      {contact.company.name}
                    </Link>
                  </>
                )}
              </>
            }
            stats={[
              {
                label: "Email",
                value: contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-1.5 hover:underline"
                  >
                    <Mail className="size-3.5 text-muted-foreground" /> {contact.email}
                  </a>
                ) : (
                  "—"
                ),
              },
              {
                label: "Phone",
                value: contact.phone ? (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5 text-muted-foreground" /> {contact.phone}
                  </span>
                ) : (
                  "—"
                ),
              },
              { label: "Last activity", value: <RelativeDate value={contact.last_activity_at} /> },
            ]}
            onAskAi={actions.askAi}
            onDelete={actions.requestDelete}
          />
        }
        left={
          defs && (
            <FieldsPanel
              type="contact"
              record={contact}
              descriptors={contactDescriptors(defs, t)}
            />
          )
        }
        center={<Timeline type="contact" id={contact.id} />}
        right={
          <>
            {insight}
            <RecordTasks type="contact" id={contact.id} />
            <ContactRelated contact={contact} />
          </>
        }
      />
      <ConfirmDialog
        open={actions.confirmOpen}
        onOpenChange={actions.setConfirmOpen}
        title={`Delete ${contact.full_name}?`}
        description="Their notes, tasks and timeline are removed. This can't be undone."
        busy={actions.busy}
        onConfirm={actions.confirmDelete}
      />
    </>
  );
}
