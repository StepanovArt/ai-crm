/** Agent protocol types — aliases of the generated OpenAPI schemas (see app/agent/events.py). */
import type { components } from "@/lib/api/schema";

type S = components["schemas"];

export type MessageStartEvent = S["MessageStartEvent"];
export type TokenEvent = S["TokenEvent"];
export type ThinkingEvent = S["ThinkingEvent"];
export type PlanEvent = S["PlanEvent"];
export type PlanStepOut = S["PlanStepOut"];
export type ToolCallEvent = S["ToolCallEvent"];
export type ToolResultEvent = S["ToolResultEvent"];
export type UIActionEvent = S["UIActionEvent"];
export type CardEvent = S["CardEvent"];
export type MessageEndEvent = S["MessageEndEvent"];
export type ErrorEvent = S["ErrorEvent"];

export type AgentEvent =
  | MessageStartEvent
  | TokenEvent
  | ThinkingEvent
  | PlanEvent
  | ToolCallEvent
  | ToolResultEvent
  | UIActionEvent
  | CardEvent
  | MessageEndEvent
  | ErrorEvent;

export type UIAction = UIActionEvent["action"];
export type CardKind = CardEvent["kind"];

export type RecordsCardData = S["RecordsCard"];
export type RecordItem = S["RecordItem"];
export type ChartCardData = S["ChartCard"];
export type EmailDraftData = S["EmailDraft"];
export type NextStepData = S["NextStep"];
export type Insight = S["Insight"];
export type Briefing = S["Briefing"];
export type PageContext = S["PageContext"];
export type ConversationDetail = S["ConversationDetailOut"];
export type ConversationSummary = S["ConversationOut"];
