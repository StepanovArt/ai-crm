"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useUpdateWorkspace, useWorkspace, type Terminology } from "@/hooks/use-workspace";

const TERMS: { key: keyof Terminology; label: string }[] = [
  { key: "deal", label: "Deal (singular)" },
  { key: "deals", label: "Deals (plural)" },
  { key: "company", label: "Company (singular)" },
  { key: "companies", label: "Companies (plural)" },
  { key: "contact", label: "Contact (singular)" },
  { key: "contacts", label: "Contacts (plural)" },
  { key: "pipeline", label: "Pipeline" },
];

export function WorkspaceSettings() {
  const { data } = useWorkspace();
  const update = useUpdateWorkspace();
  const [name, setName] = React.useState("");
  const [terms, setTerms] = React.useState<Terminology | null>(null);
  React.useEffect(() => {
    if (data) {
      setName(data.name);
      setTerms(data.terminology);
    }
  }, [data]);
  if (!data || !terms) return null;
  const dirty = name !== data.name || TERMS.some(({ key }) => terms[key] !== data.terminology[key]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({ name: name.trim(), terminology: terms! });
    toast.success("Workspace updated");
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="rounded-xl border bg-surface p-5">
        <h3 className="text-sm font-semibold">General</h3>
        <Field label="Workspace name" htmlFor="ws-name" className="mt-4 max-w-sm">
          <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </section>
      <section className="rounded-xl border bg-surface p-5">
        <h3 className="text-sm font-semibold">Terminology</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Rename objects to match how your team talks. Navigation, tables and the AI use these
          words.
        </p>
        <div className="mt-4 grid max-w-2xl grid-cols-2 gap-x-4 gap-y-3">
          {TERMS.map(({ key, label }) => (
            <Field key={key} label={label} htmlFor={`term-${key}`}>
              <Input
                id={`term-${key}`}
                value={terms[key]}
                onChange={(e) => setTerms({ ...terms, [key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </section>
      <div className="flex justify-end">
        <Button type="submit" disabled={!dirty || update.isPending}>
          {update.isPending && <Loader2 className="animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
