"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ColorDot } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePipelines } from "@/hooks/use-pipelines";
import { useCreateDeal } from "@/hooks/use-records";
import { useTerms } from "@/hooks/use-workspace";

import { CompanyPicker, ContactPicker } from "../record-picker";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  value: z
    .string()
    .trim()
    .refine(
      (v) =>
        v === "" ||
        (!Number.isNaN(Number(v.replace(/,/g, ""))) && Number(v.replace(/,/g, "")) >= 0),
      "Enter an amount",
    ),
  stage_id: z.string().optional(),
  company_id: z.string().nullable(),
  primary_contact_id: z.string().nullable(),
  expected_close: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function CreateDealDialog({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaults?: Partial<Pick<Values, "stage_id" | "company_id" | "primary_contact_id">>;
}) {
  const t = useTerms();
  const router = useRouter();
  const create = useCreateDeal();
  const { data: pipelines } = usePipelines();
  const stages = pipelines?.[0]?.stages ?? [];
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      name: "",
      value: "",
      stage_id: defaults?.stage_id ?? stages[0]?.id,
      company_id: defaults?.company_id ?? null,
      primary_contact_id: defaults?.primary_contact_id ?? null,
      expected_close: "",
    },
    resetOptions: { keepDirtyValues: true },
  });
  const { errors, isSubmitting } = form.formState;
  const companyId = form.watch("company_id");

  async function onSubmit(v: Values) {
    try {
      const deal = await create.mutateAsync({
        name: v.name,
        value: v.value ? v.value.replace(/,/g, "") : "0",
        stage_id: v.stage_id ?? null,
        company_id: v.company_id,
        primary_contact_id: v.primary_contact_id,
        expected_close: v.expected_close || null,
      });
      toast.success(`${t.deal} created`, {
        action: { label: "Open", onClick: () => router.push(`/records/deal/${deal.id}`) },
      });
      form.reset();
      onOpenChange(false);
    } catch (e) {
      form.setError("root", { message: e instanceof Error ? e.message : "Could not create" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New {t.deal.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3.5" noValidate>
          <Field label="Name" htmlFor="d-name" error={errors.name?.message}>
            <Input
              id="d-name"
              autoFocus
              placeholder="Acme — Annual plan"
              {...form.register("name")}
              aria-invalid={!!errors.name}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Value" htmlFor="d-value" error={errors.value?.message}>
              <Input
                id="d-value"
                inputMode="decimal"
                placeholder="25,000"
                {...form.register("value")}
              />
            </Field>
            <Field label="Stage" htmlFor="d-stage">
              <Controller
                control={form.control}
                name="stage_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="d-stage" className="h-9">
                      <SelectValue placeholder="Stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <ColorDot color={s.color} /> {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.company} htmlFor="d-company">
              <Controller
                control={form.control}
                name="company_id"
                render={({ field }) => (
                  <CompanyPicker id="d-company" value={field.value} onChange={field.onChange} />
                )}
              />
            </Field>
            <Field label="Primary contact" htmlFor="d-contact">
              <Controller
                control={form.control}
                name="primary_contact_id"
                render={({ field }) => (
                  <ContactPicker
                    id="d-contact"
                    value={field.value}
                    onChange={field.onChange}
                    companyId={companyId}
                  />
                )}
              />
            </Field>
          </div>
          <Field label="Expected close" htmlFor="d-close">
            <Input id="d-close" type="date" {...form.register("expected_close")} />
          </Field>
          {errors.root && <p className="text-[13px] text-destructive">{errors.root.message}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Create {t.deal.toLowerCase()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
