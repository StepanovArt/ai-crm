"use client";

import { Suspense } from "react";
import { Building2 } from "lucide-react";

import { CompanyLogo } from "@/components/common/avatar";
import { CreateCompanyDialog } from "@/components/records/create/create-company-dialog";
import { RecordTablePage } from "@/components/records/record-table-page";
import { useFields } from "@/hooks/use-fields";
import { useCompanies } from "@/hooks/use-records";
import { useTerms } from "@/hooks/use-workspace";
import { companyDescriptors } from "@/lib/records/descriptors";

function CompaniesTable() {
  const t = useTerms();
  const { data: defs } = useFields("company");
  if (!defs) return null;
  return (
    <RecordTablePage
      type="company"
      title={t.companies}
      singular={t.company}
      icon={Building2}
      descriptors={companyDescriptors(defs, t)}
      useRows={useCompanies}
      renderPrimary={(c) => (
        <span className="flex min-w-0 items-center gap-2">
          <CompanyLogo name={c.name} src={c.logo_url} size="xs" />
          <span className="truncate font-medium">{c.name}</span>
        </span>
      )}
      createDialog={(open, setOpen) => <CreateCompanyDialog open={open} onOpenChange={setOpen} />}
    />
  );
}

export default function CompaniesPage() {
  return (
    <Suspense>
      <CompaniesTable />
    </Suspense>
  );
}
