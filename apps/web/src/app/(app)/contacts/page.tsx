"use client";

import { Suspense } from "react";
import { Users } from "lucide-react";

import { Avatar } from "@/components/common/avatar";
import { CreateContactDialog } from "@/components/records/create/create-contact-dialog";
import { RecordTablePage } from "@/components/records/record-table-page";
import { useFields } from "@/hooks/use-fields";
import { useContacts } from "@/hooks/use-records";
import { useTerms } from "@/hooks/use-workspace";
import { contactDescriptors } from "@/lib/records/descriptors";

function ContactsTable() {
  const t = useTerms();
  const { data: defs } = useFields("contact");
  if (!defs) return null;
  return (
    <RecordTablePage
      type="contact"
      title={t.contacts}
      singular={t.contact}
      icon={Users}
      descriptors={contactDescriptors(defs, t)}
      useRows={useContacts}
      renderPrimary={(c) => (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar name={c.full_name} size="xs" />
          <span className="truncate font-medium">{c.full_name}</span>
        </span>
      )}
      createDialog={(open, setOpen) => <CreateContactDialog open={open} onOpenChange={setOpen} />}
    />
  );
}

export default function ContactsPage() {
  return (
    <Suspense>
      <ContactsTable />
    </Suspense>
  );
}
