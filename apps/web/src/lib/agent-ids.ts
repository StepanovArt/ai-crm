/**
 * Stable `data-agent-id` values. The agent's ui_actions target these, so they must not change.
 */
export const agentId = {
  nav: (key: string) => `nav-${key}`,
  dealCard: (id: string) => `deal-card-${id}`,
  stageColumn: (id: string) => `stage-column-${id}`,
  row: (type: string, id: string) => `${type}-row-${id}`,
  task: (id: string) => `task-${id}`,
  queueItem: (id: string) => `queue-item-${id}`,
  recordHeader: (type: string, id: string) => `record-header-${type}-${id}`,
  timeline: (type: string, id: string) => `timeline-${type}-${id}`,
  insight: (type: string, id: string) => `insight-${type}-${id}`,
  briefing: "today-briefing",
  askAi: "topbar-ask-ai",
  search: "topbar-search",
} as const;
