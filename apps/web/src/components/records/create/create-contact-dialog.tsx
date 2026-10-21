"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { useCreateContact } from "@/hooks/use-records";
import { useTerms } from "@/hooks/use-workspace";

import { CompanyPicker } from "../record-picker";

const schema = z.object({
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().optional(),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
  title: z.string().trim().optional(),
  company_id: z.string().nullable(),
});
type Values = z.infer<typeof schema>;

export function CreateContactDialog({
  open,
  onOpenChange,
  defaultCompanyId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultCompanyId?: string;
}) {
  const t = useTerms();
  const router = useRouter();
  const create = useCreateContact();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      title: "",
      company_id: defaultCompanyId ?? null,
    },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(v: Values) {
    try {
      const contact = await create.mutateAsync({
        first_name: v.first_name,
        last_name: v.last_name ?? "",
        email: v.email || null,
        title: v.title || null,
        company_id: v.company_id,
      });
      toast.success(`${t.contact} created`, {
        action: { label: "Open", onClick: () => router.push(`/records/contact/${contact.id}`) },
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
          <DialogTitle>New {t.contact.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3.5" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="p-first" error={errors.first_name?.message}>
              <Input
                id="p-first"
                autoFocus
                {...form.register("first_name")}
                aria-invalid={!!errors.first_name}
              />
            </Field>
            <Field label="Last name" htmlFor="p-last">
              <Input id="p-last" {...form.register("last_name")} />
            </Field>
          </div>
          <Field label="Email" htmlFor="p-email" error={errors.email?.message}>
            <Input
              id="p-email"
              type="email"
              {...form.register("email")}
              aria-invalid={!!errors.email}
            />
          </Field>
          <Field label="Title" htmlFor="p-title">
            <Input id="p-title" placeholder="Head of Operations" {...form.register("title")} />
          </Field>
          <Field label={t.company} htmlFor="p-company">
            <Controller
              control={form.control}
              name="company_id"
              render={({ field }) => (
                <CompanyPicker id="p-company" value={field.value} onChange={field.onChange} />
              )}
            />
          </Field>
          {errors.root && <p className="text-[13px] text-destructive">{errors.root.message}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Create {t.contact.toLowerCase()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
