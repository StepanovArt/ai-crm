"use client";

import * as React from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import type { OnboardingTemplate } from "@/lib/onboarding/state";

const FALLBACK_EXAMPLES = [
  "We sell a B2B analytics platform to mid-market companies",
  "We sell apartments in new developments",
  "We sell industrial equipment to factories",
  "We're a digital agency selling branding and web projects",
  "We're a recruitment agency placing software engineers",
];

export function DescribeForm({
  firstName,
  value,
  onChange,
  onSubmit,
  onSkip,
  skipping,
  templates,
}: {
  firstName: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  skipping: boolean;
  templates: OnboardingTemplate[] | undefined;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const examples = templates?.map((t) => t.example_prompt) ?? FALLBACK_EXAMPLES;
  const ready = value.trim().length >= 3;

  return (
    <div>
      <p className="text-[13px] font-medium text-muted-foreground">Welcome, {firstName}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance">
        Describe your business in one sentence
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Halo sets up your pipeline, fields, vocabulary and realistic sample data. You can change
        everything later in Settings.
      </p>

      <form
        className="mt-7"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onSubmit();
        }}
      >
        <label htmlFor="business" className="sr-only">
          Your business in one sentence
        </label>
        <div className="rounded-xl border bg-surface shadow-xs transition-[box-shadow,border-color] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/25">
          <Textarea
            ref={ref}
            id="business"
            autoFocus
            rows={2}
            maxLength={500}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (ready) onSubmit();
              }
            }}
            placeholder="e.g. We sell apartments in new developments"
            className="min-h-20 resize-none border-0 bg-transparent px-3.5 pt-3 text-[15px] shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center gap-2 px-2.5 pb-2.5">
            <span className="hidden text-[11px] text-muted-foreground sm:inline">
              <Kbd>↵</Kbd> to build
            </span>
            <div className="flex-1" />
            <Button type="submit" variant="agent" disabled={!ready} data-testid="build-workspace">
              <Sparkles />
              Build my workspace
            </Button>
          </div>
        </div>
      </form>

      <div className="mt-6">
        <p className="text-[12px] font-medium text-muted-foreground">Try an example</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                onChange(example);
                ref.current?.focus();
              }}
              className="rounded-full border bg-surface px-3 py-1 text-left text-[12.5px] text-foreground/80 transition-colors outline-none hover:border-border-strong hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 flex items-center gap-3 border-t pt-5">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">Just exploring?</p>
          <p className="text-[12px] text-muted-foreground">
            Start with a B2B software sales team and sample deals.
          </p>
        </div>
        <Button variant="outline" onClick={onSkip} disabled={skipping}>
          {skipping ? <Loader2 className="animate-spin" /> : null}
          Skip, use demo workspace
          {!skipping && <ArrowRight />}
        </Button>
      </div>
    </div>
  );
}
