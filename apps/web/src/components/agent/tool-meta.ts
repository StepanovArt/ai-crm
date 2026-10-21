import {
  ArrowRightLeft,
  BarChart3,
  Compass,
  FileText,
  ListPlus,
  PenLine,
  Pencil,
  ScrollText,
  Search,
  StickyNote,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export const TOOL_ICONS: Record<string, LucideIcon> = {
  search_records: Search,
  get_record: FileText,
  pipeline_stats: BarChart3,
  summarize_record: ScrollText,
  draft_email: PenLine,
  create_task: ListPlus,
  update_record: Pencil,
  move_deal_stage: ArrowRightLeft,
  add_note: StickyNote,
  navigate: Compass,
};

export function toolIcon(tool: string): LucideIcon {
  return TOOL_ICONS[tool] ?? Wrench;
}
