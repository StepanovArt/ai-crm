"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSignup } from "@/hooks/use-auth";

const schema = z.object({
  full_name: z.string().trim().min(1, "Tell us your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});
type Values = z.infer<typeof schema>;

export default function SignupPage() {
  const router = useRouter();
  const signup = useSignup();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "" },
  });

  async function onSubmit(values: Values) {
    try {
      await signup.mutateAsync(values);
      router.replace("/onboarding");
    } catch (e) {
      form.setError("root", { message: e instanceof Error ? e.message : "Sign up failed" });
    }
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        One sentence about your business is all the setup you need.
      </p>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid gap-4" noValidate>
        <Field label="Full name" htmlFor="full_name" error={errors.full_name?.message}>
          <Input
            id="full_name"
            autoComplete="name"
            autoFocus
            className="h-9"
            {...form.register("full_name")}
            aria-invalid={!!errors.full_name}
          />
        </Field>
        <Field label="Work email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            className="h-9"
            {...form.register("email")}
            aria-invalid={!!errors.email}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint="At least 8 characters."
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            className="h-9"
            {...form.register("password")}
            aria-invalid={!!errors.password}
          />
        </Field>
        {errors.root && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
          >
            {errors.root.message}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-1 h-9" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Continue
        </Button>
      </form>
      <p className="mt-8 text-center text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
