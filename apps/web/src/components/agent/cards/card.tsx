"use client";

import type {
  CardKind,
  ChartCardData,
  EmailDraftData,
  NextStepData,
  RecordsCardData,
} from "@/lib/agent/types";

import { ChartCard } from "./chart-card";
import { EmailDraftCard } from "./email-draft-card";
import { NextStepCard } from "./next-step-card";
import { RecordsCard } from "./records-card";

export function AgentCard({ kind, data }: { kind: CardKind; data: Record<string, unknown> }) {
  switch (kind) {
    case "records":
      return <RecordsCard data={data as unknown as RecordsCardData} />;
    case "chart":
      return <ChartCard data={data as unknown as ChartCardData} />;
    case "email_draft":
      return <EmailDraftCard data={data as unknown as EmailDraftData} />;
    case "next_step":
      return <NextStepCard data={data as unknown as NextStepData} />;
    default:
      return (
        <pre className="overflow-auto rounded-xl border bg-surface p-3 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
  }
}
