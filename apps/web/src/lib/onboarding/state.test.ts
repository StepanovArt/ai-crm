import { describe, expect, it } from "vitest";

import { applyOnboardingEvent, progress, startBuilding, type OnboardingEvent } from "./state";

const template: OnboardingEvent = {
  type: "template",
  key: "real_estate",
  name: "Real estate",
  tagline: "Apartment sales",
  matched: ["apartments"],
  steps: [
    { id: "terminology", label: "Adapting the vocabulary" },
    { id: "pipeline", label: "Creating pipeline: Lead → Viewing" },
  ],
};

const run = (events: OnboardingEvent[]) => events.reduce(applyOnboardingEvent, startBuilding());

describe("applyOnboardingEvent", () => {
  it("lays out pending steps from the template", () => {
    const s = run([{ type: "thinking", text: "Reading…" }, template]);
    expect(s.thoughts).toEqual(["Reading…"]);
    expect(s.template?.key).toBe("real_estate");
    expect(s.steps.map((x) => x.status)).toEqual(["pending", "pending"]);
    expect(progress(s)).toBe(0);
  });

  it("tracks running → done and keeps the data a done step carries", () => {
    const s = run([
      template,
      { type: "step", id: "terminology", status: "running", label: "Adapting the vocabulary" },
      {
        type: "step",
        id: "terminology",
        status: "done",
        label: "Adapting the vocabulary",
        detail: "Deals → Sales",
        terminology: { deals: "Sales" },
      },
      { type: "step", id: "pipeline", status: "running", label: "Creating pipeline" },
    ]);
    expect(s.steps.map((x) => x.status)).toEqual(["done", "running"]);
    expect(s.steps[0]?.detail).toBe("Deals → Sales");
    expect(s.terminology).toEqual({ deals: "Sales" });
    expect(progress(s)).toBeCloseTo(0.75);
  });

  it("records counts, samples and stages", () => {
    const s = run([
      template,
      {
        type: "step",
        id: "pipeline",
        status: "done",
        label: "Creating pipeline",
        stages: [{ name: "Lead", color: "slate", kind: "open", probability: 10 }],
      },
      { type: "step", id: "companies", status: "done", label: "x", count: 30, samples: ["A"] },
    ]);
    expect(s.stages).toHaveLength(1);
    expect(s.counts.companies).toBe(30);
    expect(s.samples.companies).toEqual(["A"]);
    // Unknown step ids are appended rather than dropped.
    expect(s.steps.map((x) => x.id)).toContain("companies");
  });

  it("finishes or fails", () => {
    expect(run([template, { type: "done", workspace_id: "w", redirect: "/today" }]).phase).toBe(
      "done",
    );
    const failed = run([template, { type: "error", message: "Nope" }]);
    expect(failed.phase).toBe("error");
    expect(failed.error).toBe("Nope");
  });
});
