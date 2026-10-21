"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { useCreateCompany } from "@/hooks/use-records";
import { useTerms } from "@/hooks/use-workspace";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  domain: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  size: z.string().trim().optional(),
});
type Values = z.infer<typeof schema>;

export function CreateCompanyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTerms();
  const router = useRouter();
  const create = useCreateCompany();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", domain: "", industry: "", size: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(v: Values) {
    try {
      const company = await create.mutateAsync({
        name: v.name,
        domain: v.domain || null,
        industry: v.industry || null,
        size: v.size || null,
      });
      toast.success(`${t.company} created`, {
        action: { label: "Open", onClick: () => router.push(`/records/company/${company.id}`) },
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
          <DialogTitle>New {t.company.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3.5" noValidate>
          <Field label="Name" htmlFor="c-name" error={errors.name?.message}>
            <Input id="c-name" autoFocus {...form.register("name")} aria-invalid={!!errors.name} />
          </Field>
          <Field label="Domain" htmlFor="c-domain">
            <Input id="c-domain" placeholder="acme.com" {...form.register("domain")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Industry" htmlFor="c-industry">
              <Input id="c-industry" {...form.register("industry")} />
            </Field>
            <Field label="Size" htmlFor="c-size">
              <Input id="c-size" placeholder="51-200" {...form.register("size")} />
            </Field>
          </div>
          {errors.root && <p className="text-[13px] text-destructive">{errors.root.message}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Create {t.company.toLowerCase()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
