"use client";

import Link from "next/link";

import { Avatar, CompanyLogo } from "@/components/common/avatar";
import { MoneyText } from "@/components/common/money";
import { ScoreBadge } from "@/components/common/score-badge";
import { ColorDot } from "@/components/common/status-badge";
import { useContacts, useDeals, type Company, type Contact, type Deal } from "@/hooks/use-records";
import { useTerms } from "@/hooks/use-workspace";

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
        {count !== undefined && (
          <span className="rounded bg-muted px-1 text-[11px] normal-case tabular">{count}</span>
        )}
      </h2>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

const rowCls =
  "-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] transition-colors hover:bg-accent/60";

function DealLinks({ deals }: { deals: Deal[] }) {
  if (!deals.length) return <p className="py-1 text-[13px] text-muted-foreground">None yet.</p>;
  return (
    <>
      {deals.map((d) => (
        <Link key={d.id} href={`/records/deal/${d.id}`} className={rowCls}>
          <ColorDot color={d.stage?.color ?? "slate"} />
          <span className="min-w-0 flex-1 truncate">{d.name}</span>
          <MoneyText
            value={d.value}
            currency={d.currency}
            compact
            className="text-xs text-muted-foreground"
          />
        </Link>
      ))}
    </>
  );
}

function ContactLinks({ contacts }: { contacts: Contact[] }) {
  if (!contacts.length) return <p className="py-1 text-[13px] text-muted-foreground">None yet.</p>;
  return (
    <>
      {contacts.map((c) => (
        <Link key={c.id} href={`/records/contact/${c.id}`} className={rowCls}>
          <Avatar name={c.full_name} size="xs" />
          <span className="min-w-0 flex-1 truncate">
            {c.full_name}
            {c.title && <span className="ml-1.5 text-xs text-muted-foreground">{c.title}</span>}
          </span>
          <ScoreBadge score={c.score} />
        </Link>
      ))}
    </>
  );
}

export function CompanyRelated({ company }: { company: Company }) {
  const t = useTerms();
  const { data: contacts } = useContacts({ filter: { company_id: company.id }, limit: 50 });
  const { data: deals } = useDeals({ filter: { company_id: company.id }, limit: 50 });
  return (
    <div className="space-y-6">
      <Section title={t.deals} count={deals?.total}>
        <DealLinks deals={deals?.items ?? []} />
      </Section>
      <Section title={t.contacts} count={contacts?.total}>
        <ContactLinks contacts={contacts?.items ?? []} />
      </Section>
    </div>
  );
}

export function ContactRelated({ contact }: { contact: Contact }) {
  const t = useTerms();
  const { data: deals } = useDeals({ filter: { primary_contact_id: contact.id }, limit: 50 });
  return (
    <div className="space-y-6">
      {contact.company && (
        <Section title={t.company}>
          <Link href={`/records/company/${contact.company.id}`} className={rowCls}>
            <CompanyLogo name={contact.company.name} size="xs" />
            <span className="truncate">{contact.company.name}</span>
          </Link>
        </Section>
      )}
      <Section title={t.deals} count={deals?.total}>
        <DealLinks deals={deals?.items ?? []} />
      </Section>
    </div>
  );
}

export function DealRelated({ deal }: { deal: Deal }) {
  const t = useTerms();
  return (
    <div className="space-y-6">
      {deal.company && (
        <Section title={t.company}>
          <Link href={`/records/company/${deal.company.id}`} className={rowCls}>
            <CompanyLogo name={deal.company.name} size="xs" />
            <span className="truncate">{deal.company.name}</span>
          </Link>
        </Section>
      )}
      {deal.primary_contact && (
        <Section title="Primary contact">
          <Link href={`/records/contact/${deal.primary_contact.id}`} className={rowCls}>
            <Avatar name={deal.primary_contact.full_name} size="xs" />
            <span className="min-w-0 flex-1 truncate">{deal.primary_contact.full_name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {deal.primary_contact.title}
            </span>
          </Link>
        </Section>
      )}
    </div>
  );
}
