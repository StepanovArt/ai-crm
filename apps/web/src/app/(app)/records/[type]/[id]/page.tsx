"use client";

import { use } from "react";
import { notFound } from "next/navigation";

import { InlineInsight } from "@/components/agent/inline-insight";
import { EmptyState } from "@/components/common/empty-state";
import { CompanyView } from "@/components/records/detail/company-view";
import { ContactView } from "@/components/records/detail/contact-view";
import { DealView } from "@/components/records/detail/deal-view";
import { RecordSkeleton } from "@/components/records/detail/record-layout";
import { useCompany, useContact, useDeal } from "@/hooks/use-records";
import { FileQuestion } from "lucide-react";

function Missing() {
  return (
    <EmptyState icon={FileQuestion} title="Record not found" hint="It may have been deleted." />
  );
}

function CompanyPage({ id }: { id: string }) {
  const { data, isLoading } = useCompany(id);
  if (isLoading) return <RecordSkeleton />;
  return data ? (
    <CompanyView company={data} insight={<InlineInsight type="company" id={id} />} />
  ) : (
    <Missing />
  );
}

function ContactPage({ id }: { id: string }) {
  const { data, isLoading } = useContact(id);
  if (isLoading) return <RecordSkeleton />;
  return data ? (
    <ContactView contact={data} insight={<InlineInsight type="contact" id={id} />} />
  ) : (
    <Missing />
  );
}

function DealPage({ id }: { id: string }) {
  const { data, isLoading } = useDeal(id);
  if (isLoading) return <RecordSkeleton />;
  return data ? (
    <DealView deal={data} insight={<InlineInsight type="deal" id={id} />} />
  ) : (
    <Missing />
  );
}

export default function RecordPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = use(params);
  if (type === "company") return <CompanyPage id={id} />;
  if (type === "contact") return <ContactPage id={id} />;
  if (type === "deal") return <DealPage id={id} />;
  notFound();
}
