"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AppSkeleton } from "@/components/onboarding/app-skeleton";
import { BuildProgress } from "@/components/onboarding/build-progress";
import { DescribeForm } from "@/components/onboarding/describe-form";
import { FullScreenLoader } from "@/components/layout/full-screen-loader";
import { LogoMark } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useMe } from "@/hooks/use-auth";
import {
  useDemoWorkspace,
  useOnboardingGenerator,
  useOnboardingTemplates,
} from "@/hooks/use-onboarding";
import { api, ApiError, unwrap } from "@/lib/api/client";
import { qk } from "@/lib/query-keys";
import { APP_NAME } from "@/lib/utils";

const AUTO_OPEN_MS = 1600;

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const templates = useOnboardingTemplates();
  const demo = useDemoWorkspace();
  const { state, generate, reset } = useOnboardingGenerator();
  const [description, setDescription] = React.useState("");

  const finish = React.useCallback(
    async (href = "/today") => {
      // Everything about the workspace changed: drop cached data, keep a fresh `me` so the
      // app shell sees the finished onboarding immediately.
      try {
        const fresh = await unwrap(api.GET("/api/v1/auth/me"));
        qc.clear();
        qc.setQueryData(qk.me, fresh);
      } catch {
        qc.clear();
      }
      router.replace(href);
    },
    [qc, router],
  );

  // Signed out → login; already onboarded (and not mid-flow) → app.
  React.useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace("/login");
    else if (me.data?.workspace.onboarding_completed && state.phase === "idle") {
      router.replace("/today");
    }
  }, [me.data, me.error, state.phase, router]);

  React.useEffect(() => {
    if (state.phase !== "done") return;
    const t = setTimeout(() => void finish(state.redirect ?? "/today"), AUTO_OPEN_MS);
    return () => clearTimeout(t);
  }, [state.phase, state.redirect, finish]);

  async function skip() {
    try {
      await demo.mutateAsync();
      router.replace("/today");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the demo workspace");
    }
  }

  if (!me.data || (me.data.workspace.onboarding_completed && state.phase === "idle")) {
    return <FullScreenLoader label={me.data ? "Opening your workspace…" : "Loading…"} />;
  }

  const firstName = me.data.user.full_name.split(" ")[0] ?? me.data.user.full_name;
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(420px,5fr)_7fr]">
      <div className="flex flex-col px-6 py-7 sm:px-10">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <LogoMark />
          {APP_NAME}
          <div className="flex-1" />
          <ThemeToggle />
        </div>
        <main className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-[440px]">
            {state.phase === "idle" ? (
              <DescribeForm
                firstName={firstName}
                value={description}
                onChange={setDescription}
                onSubmit={() => void generate(description.trim())}
                onSkip={() => void skip()}
                skipping={demo.isPending}
                templates={templates.data}
              />
            ) : (
              <BuildProgress
                state={state}
                description={description.trim()}
                onOpen={() => void finish(state.redirect ?? "/today")}
                onRetry={reset}
                onSkip={() => void skip()}
                skipping={demo.isPending}
              />
            )}
          </div>
        </main>
        <p className="text-xs text-muted-foreground">
          Signed in as {me.data.user.email} · Everything can be renamed later.
        </p>
      </div>
      <div className="relative hidden items-center justify-center overflow-hidden border-l bg-muted/40 px-10 py-12 lg:flex dark:bg-zinc-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_75%_15%,rgb(139_92_246/0.14),transparent_70%),radial-gradient(45%_40%_at_20%_90%,rgb(6_182_212/0.12),transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(113_113_122/0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgb(113_113_122/0.08)_1px,transparent_1px)] [mask-image:radial-gradient(70%_60%_at_50%_45%,black,transparent)] bg-[size:40px_40px]" />
        <AppSkeleton state={state} workspaceName={me.data.workspace.name} />
      </div>
    </div>
  );
}
