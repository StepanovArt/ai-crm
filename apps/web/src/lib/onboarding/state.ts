/** Onboarding stream state — a pure reducer over OnboardingEvents (see app/onboarding/events.py). */
import type { components } from "@/lib/api/schema";

type S = components["schemas"];

export type OnboardingThinkingEvent = S["OnboardingThinkingEvent"];
export type OnboardingTemplateEvent = S["OnboardingTemplateEvent"];
export type OnboardingStepEvent = S["OnboardingStepEvent"];
export type OnboardingDoneEvent = S["OnboardingDoneEvent"];
export type OnboardingErrorEvent = S["OnboardingErrorEvent"];
export type OnboardingEvent =
  | OnboardingThinkingEvent
  | OnboardingTemplateEvent
  | OnboardingStepEvent
  | OnboardingDoneEvent
  | OnboardingErrorEvent;

export type StepId = OnboardingStepEvent["id"];
export type StagePreview = S["StagePreview"];
export type FieldPreview = S["FieldPreview"];
export type DealPreview = S["DealPreview"];
export type OnboardingTemplate = S["OnboardingTemplateOut"];

export type StepState = {
  id: StepId;
  label: string;
  status: "pending" | "running" | "done";
  detail: string | null;
};

export type OnboardingState = {
  phase: "idle" | "building" | "done" | "error";
  thoughts: string[];
  template: Pick<OnboardingTemplateEvent, "key" | "name" | "tagline" | "matched"> | null;
  steps: StepState[];
  terminology: Record<string, string> | null;
  stages: StagePreview[];
  fields: FieldPreview[];
  counts: Partial<Record<StepId, number>>;
  samples: Partial<Record<StepId, string[]>>;
  deals: DealPreview[];
  error: string | null;
  redirect: string | null;
};

export const initialOnboarding: OnboardingState = {
  phase: "idle",
  thoughts: [],
  template: null,
  steps: [],
  terminology: null,
  stages: [],
  fields: [],
  counts: {},
  samples: {},
  deals: [],
  error: null,
  redirect: null,
};

export function startBuilding(): OnboardingState {
  return { ...initialOnboarding, phase: "building" };
}

export function applyOnboardingEvent(
  state: OnboardingState,
  event: OnboardingEvent,
): OnboardingState {
  switch (event.type) {
    case "thinking":
      return { ...state, thoughts: [...state.thoughts, event.text] };
    case "template":
      return {
        ...state,
        template: {
          key: event.key,
          name: event.name,
          tagline: event.tagline,
          matched: event.matched,
        },
        steps: event.steps.map((s) => ({ ...s, status: "pending", detail: null })),
      };
    case "step": {
      const steps: StepState[] = state.steps.some((s) => s.id === event.id)
        ? state.steps
        : [...state.steps, { id: event.id, label: event.label, status: "pending", detail: null }];
      const next: OnboardingState = {
        ...state,
        steps: steps.map((s) =>
          s.id === event.id
            ? { ...s, label: event.label, status: event.status, detail: event.detail ?? s.detail }
            : s,
        ),
      };
      if (event.status !== "done") return next;
      if (event.terminology) next.terminology = event.terminology;
      if (event.stages) next.stages = event.stages;
      if (event.fields) next.fields = event.fields;
      if (event.deals) next.deals = event.deals;
      if (event.count != null) next.counts = { ...state.counts, [event.id]: event.count };
      if (event.samples) next.samples = { ...state.samples, [event.id]: event.samples };
      return next;
    }
    case "done":
      return { ...state, phase: "done", redirect: event.redirect ?? "/today" };
    case "error":
      return { ...state, phase: "error", error: event.message };
  }
}

/** 0..1 — completed steps over all steps (0 until the template arrives). */
export function progress(state: OnboardingState): number {
  if (state.phase === "done") return 1;
  if (!state.steps.length) return state.thoughts.length ? 0.04 : 0;
  const done = state.steps.filter((s) => s.status === "done").length;
  const running = state.steps.some((s) => s.status === "running") ? 0.5 : 0;
  return Math.min(0.98, (done + running) / state.steps.length);
}
