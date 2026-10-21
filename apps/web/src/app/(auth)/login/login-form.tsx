"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/hooks/use-auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

export const DEMO = { email: "demo@halo.dev", password: "demo1234" };

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const login = useLogin();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: Values) {
    try {
      const me = await login.mutateAsync(values);
      const target = !me.workspace.onboarding_completed
        ? "/onboarding"
        : next && next.startsWith("/")
          ? next
          : "/today";
      router.replace(target);
    } catch (e) {
      form.setError("root", { message: e instanceof Error ? e.message : "Sign in failed" });
    }
  }

  function useDemo() {
    form.setValue("email", DEMO.email);
    form.setValue("password", DEMO.password);
    void form.handleSubmit(onSubmit)();
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Sign in to your workspace.</p>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 grid gap-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            className="h-9"
            {...form.register("email")}
            aria-invalid={!!errors.email}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
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
          Sign in
        </Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        variant="outline"
        className="h-9 w-full"
        onClick={useDemo}
        disabled={isSubmitting}
        data-testid="demo-login"
      >
        <Wand2 className="text-violet-500" />
        Explore the demo workspace
      </Button>
      <p className="mt-8 text-center text-[13px] text-muted-foreground">
        New to Halo?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
