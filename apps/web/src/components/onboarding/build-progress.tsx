"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, CircleAlert, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { progress, type OnboardingState, type StepState } from "@/lib/onboarding/state";
import { cn } from "@/lib/utils";

export function BuildProgress({
  state,
  description,
  onOpen,
  onRetry,
  onSkip,
  skipping,
}: {
  state: OnboardingState;
  description: string;
  onOpen: () => void;
  onRetry: () => void;
  onSkip: () => void;
  skipping: boolean;
}) {
  const reduce = useReducedMotion();
  const pct = Math.round(progress(state) * 100);
  const thought = state.thoughts.at(-1);
  return (
    <div>
      <div className="flex items-center gap-2 text-[12px] font-medium">
        <span className="flex size-5 items-center justify-center rounded-md bg-agent">
          <Sparkles className="size-3 text-white" />
        </span>
        <span className="text-agent">Halo AI</span>
        <span className="text-muted-foreground">
          {state.phase === "done" ? "· Done" : "· Setting up your workspace"}
        </span>
      </div>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {state.phase === "done"
          ? "Your workspace is ready"
          : state.template
            ? `Building ${withArticle(state.template.name.toLowerCase())} workspace`
            : "Understanding your business"}
      </h1>
      <p className="mt-2 line-clamp-2 border-l-2 pl-3 text-[13px] text-muted-foreground italic">
        “{description}”
      </p>

      <div
        className="mt-6 h-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Workspace setup progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <motion.div
          className="h-full rounded-full bg-agent"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduce ? 0 : 0.5, ease: "easeOut" }}
        />
      </div>

      <div className="mt-3 min-h-5 text-[13px] text-muted-foreground" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {state.phase === "building" && thought && !state.steps.length && (
            <motion.p
              key={thought}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="shimmer-text"
            >
              {thought}
            </motion.p>
          )}
          {state.template && (
            <motion.p
              key="template"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap items-center gap-1.5"
            >
              <span>{state.template.tagline}</span>
              {state.template.matched.slice(0, 3).map((m) => (
                <span
                  key={m}
                  className="rounded-full bg-agent-soft px-1.5 py-px text-[11px] text-violet-700 dark:text-violet-300"
                >
                  {m}
                </span>
              ))}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <ol className="mt-5 space-y-1" aria-label="Setup steps">
        {state.steps.map((step, i) => (
          <motion.li
            key={step.id}
            initial={reduce ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: reduce ? 0 : i * 0.04 }}
          >
            <StepRow step={step} />
          </motion.li>
        ))}
      </ol>

      {state.phase === "done" && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-7 flex items-center gap-3"
        >
          <Button size="lg" className="h-9" onClick={onOpen} autoFocus>
            Open Today <ArrowRight />
          </Button>
          <span className="text-[12px] text-muted-foreground">Taking you there…</span>
        </motion.div>
      )}

      {state.phase === "error" && (
        <div className="mt-7 space-y-3">
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            {state.error}
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={onRetry}>Try again</Button>
            <Button variant="ghost" onClick={onSkip} disabled={skipping}>
              {skipping && <Loader2 className="animate-spin" />}
              Use the demo workspace instead
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function withArticle(noun: string) {
  return `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}

function StepRow({ step }: { step: StepState }) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg px-2.5 py-2 transition-colors duration-200",
        step.status === "running" && "bg-agent-soft",
      )}
      aria-current={step.status === "running" ? "step" : undefined}
    >
      <span className="mt-px flex size-[18px] shrink-0 items-center justify-center">
        {step.status === "done" ? (
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            className="flex size-[18px] items-center justify-center rounded-full bg-emerald-500 text-white"
          >
            <Check className="size-3" strokeWidth={3} />
          </motion.span>
        ) : step.status === "running" ? (
          <Loader2 className="size-4 animate-spin text-violet-500" />
        ) : (
          <span className="size-3.5 rounded-full border-[1.5px] border-border-strong" />
        )}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-[13px] leading-snug",
            step.status === "pending" ? "text-muted-foreground" : "font-medium",
          )}
        >
          {step.label}
          <span className="sr-only">
            {step.status === "done" ? " (done)" : step.status === "running" ? " (in progress)" : ""}
          </span>
        </span>
        <AnimatePresence initial={false}>
          {step.detail && (
            <motion.span
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="block truncate text-[12px] text-muted-foreground"
            >
              {step.detail}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </div>
  );
}
