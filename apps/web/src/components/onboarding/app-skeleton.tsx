"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Search, Sparkles } from "lucide-react";

import { MoneyText } from "@/components/common/money";
import { ColorDot } from "@/components/common/status-badge";
import { navItems } from "@/components/layout/nav-items";
import { LogoMark } from "@/components/layout/logo";
import { Skeleton } from "@/components/ui/skeleton";
import type { Terminology } from "@/hooks/use-workspace";
import type { DealPreview, OnboardingState, StepId } from "@/lib/onboarding/state";
import { cn } from "@/lib/utils";

const PLACEHOLDER_COLUMNS = 6;
const OBJECTS = [
  { type: "company", term: "company" },
  { type: "contact", term: "contact" },
  { type: "deal", term: "deal" },
] as const;
const NAV_COUNTS: Record<string, StepId> = {
  deals: "deals",
  companies: "companies",
  contacts: "contacts",
  tasks: "tasks",
};

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * A miniature, live copy of the app: sidebar labels switch to the workspace's vocabulary,
 * kanban columns drop in one by one, then sample deals and custom fields fill in.
 */
export function AppSkeleton({
  state,
  workspaceName,
}: {
  state: OnboardingState;
  workspaceName: string;
}) {
  const reduce = useReducedMotion();
  const terms = state.terminology as Terminology | null;
  const building = state.phase === "building";
  const nav = terms ? navItems(terms) : null;
  const pipelineTitle = terms?.pipeline ?? null;
  // The preview shows the active funnel; lost deals stay out of the picture.
  const columns = state.stages
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => stage.kind !== "lost");

  return (
    <div
      className={cn(
        "relative flex h-[min(620px,calc(100dvh-8rem))] w-full max-w-[920px] overflow-hidden rounded-2xl border bg-background shadow-pop",
        building && "animate-agent-glow border-agent",
      )}
      aria-hidden
    >
      {/* Sidebar */}
      <aside className="flex w-[164px] shrink-0 flex-col gap-0.5 border-r bg-sidebar p-2.5">
        <div className="mb-3 flex items-center gap-2 px-1.5 pt-0.5">
          <LogoMark className="size-5 rounded-[6px]" />
          <span className="truncate text-[12px] font-semibold">{workspaceName}</span>
        </div>
        <div className="mb-2 flex h-7 items-center gap-1.5 rounded-md border bg-surface px-2 text-[11px] text-muted-foreground">
          <Search className="size-3" />
          Search
        </div>
        {(nav ?? Array.from({ length: 6 }, () => null)).map((item, i) => {
          const count = item && NAV_COUNTS[item.key] ? state.counts[NAV_COUNTS[item.key]!] : null;
          const Icon = item?.icon;
          return (
            <div
              key={item?.key ?? i}
              className={cn(
                "flex h-7 items-center gap-2 rounded-md px-1.5 text-[12px] font-medium",
                item?.key === "pipeline" && "bg-sidebar-accent",
              )}
            >
              {Icon ? (
                <Icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.9} />
              ) : (
                <Skeleton className="size-3.5 rounded" />
              )}
              <AnimatePresence mode="wait" initial={false}>
                {item ? (
                  <motion.span
                    key={item.label}
                    initial={reduce ? false : { opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: reduce ? 0 : i * 0.05, ease }}
                    className="truncate"
                  >
                    {item.label}
                  </motion.span>
                ) : (
                  <Skeleton
                    className="h-2.5 rounded"
                    style={{ width: `${48 + ((i * 17) % 30)}%` }}
                  />
                )}
              </AnimatePresence>
              {count != null && (
                <motion.span
                  initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="ml-auto text-[10px] text-muted-foreground tabular"
                >
                  {count}
                </motion.span>
              )}
            </div>
          );
        })}
      </aside>

      {/* Main */}
      <div className="@container flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
          {pipelineTitle ? (
            <motion.span
              key={pipelineTitle}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[13px] font-semibold"
            >
              {pipelineTitle}
            </motion.span>
          ) : (
            <Skeleton className="h-3 w-24 rounded" />
          )}
          <div className="flex-1" />
          <StatPill show={state.counts.deals != null}>
            {state.counts.deals} {terms?.deals.toLowerCase()}
          </StatPill>
          <StatPill show={state.counts.history != null}>{state.counts.history} activities</StatPill>
          <StatPill show={state.counts.tasks != null}>{state.counts.tasks} tasks</StatPill>
          <span className="flex h-6 items-center gap-1 rounded-md bg-agent px-2 text-[10px] font-medium text-white">
            <Sparkles className="size-3" /> Ask AI
          </span>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden p-3">
          {columns.length ? (
            <div
              className="grid h-full gap-2"
              style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
            >
              {columns.map(({ stage, index }, i) => {
                const deals = state.deals.filter((d) => d.stage_index === index);
                return (
                  <motion.section
                    key={stage.name}
                    initial={reduce ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: reduce ? 0 : i * 0.12, ease }}
                    className="flex min-w-0 flex-col"
                  >
                    <div className="px-0.5 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <ColorDot color={stage.color} className="size-1.5" />
                        <span className="truncate text-[11px] font-semibold">{stage.name}</span>
                      </div>
                      <span className="pl-3 text-[10px] text-muted-foreground tabular">
                        {stage.probability}%
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 rounded-lg bg-muted/60 p-1.5 dark:bg-zinc-900/60">
                      {deals.map((d, j) => (
                        <motion.div
                          key={d.name}
                          initial={reduce ? false : { opacity: 0, y: -8, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.35, delay: reduce ? 0 : (i + j) * 0.06, ease }}
                          className="rounded-md border bg-surface p-1.5 shadow-xs"
                        >
                          <p className="line-clamp-2 text-[10.5px] leading-snug font-medium">
                            {cardLines(d).title}
                          </p>
                          {cardLines(d).sub && (
                            <p className="mt-0.5 line-clamp-2 text-[9.5px] leading-snug text-muted-foreground">
                              {cardLines(d).sub}
                            </p>
                          )}
                          <MoneyText
                            value={d.value}
                            currency={d.currency}
                            compact
                            className="mt-1 block text-[10px] font-semibold"
                          />
                        </motion.div>
                      ))}
                      {!deals.length &&
                        Array.from({ length: i < 3 ? 2 : 1 }, (_, k) => (
                          <div
                            key={k}
                            className="h-9 rounded-md border border-dashed bg-surface/40"
                          />
                        ))}
                    </div>
                  </motion.section>
                );
              })}
            </div>
          ) : (
            <div
              className="grid h-full gap-2"
              style={{ gridTemplateColumns: `repeat(${PLACEHOLDER_COLUMNS}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: PLACEHOLDER_COLUMNS }, (_, i) => (
                <div key={i} className="flex min-w-0 flex-col gap-1.5">
                  <Skeleton className="mx-0.5 h-2.5 w-3/5 rounded" />
                  <div className="flex flex-1 flex-col gap-1.5 rounded-lg bg-muted/40 p-1.5">
                    {Array.from({ length: 3 - (i % 3) }, (_, k) => (
                      <Skeleton key={k} className="h-10 rounded-md opacity-60" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <FieldsTray state={state} terms={terms} />
      </div>

      {state.phase === "idle" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
          <p className="rounded-full border bg-surface px-3.5 py-1.5 text-[12px] text-muted-foreground shadow-sm">
            Your workspace will assemble here
          </p>
        </div>
      )}
    </div>
  );
}

/** "Harper Family — Riverside Lofts B-1910" → title "Harper Family", sub "Riverside Lofts B-1910". */
function cardLines(d: DealPreview): { title: string; sub: string | null } {
  if (d.company && d.name.startsWith(d.company)) {
    const rest = d.name.slice(d.company.length).replace(/^[\s—–:·-]+/, "");
    return { title: d.company, sub: rest || null };
  }
  return { title: d.name, sub: d.company ?? null };
}

function StatPill({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="hidden h-6 items-center rounded-md border px-2 text-[10.5px] text-muted-foreground tabular @[560px]:flex"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function FieldsTray({ state, terms }: { state: OnboardingState; terms: Terminology | null }) {
  const reduce = useReducedMotion();
  if (!state.fields.length) {
    return (
      <div className="flex h-[74px] shrink-0 items-center gap-2 border-t px-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-5 rounded-full" style={{ width: 56 + ((i * 23) % 40) }} />
        ))}
      </div>
    );
  }
  let n = 0;
  return (
    <div className="shrink-0 border-t px-4 py-2.5">
      <p className="mb-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        Custom fields
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {OBJECTS.map(({ type, term }) => {
          const fields = state.fields.filter((f) => f.object_type === type);
          if (!fields.length) return null;
          return (
            <div key={type} className="flex flex-wrap items-center gap-1">
              <span className="mr-0.5 text-[10.5px] font-semibold">{terms?.[term] ?? type}</span>
              {fields.map((f) => (
                <motion.span
                  key={f.label}
                  initial={reduce ? false : { opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25, delay: reduce ? 0 : n++ * 0.04, ease }}
                  className="rounded-full border bg-surface px-1.5 py-px text-[10px] text-muted-foreground"
                >
                  {f.label}
                </motion.span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
