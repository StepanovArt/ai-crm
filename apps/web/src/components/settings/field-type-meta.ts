import {
  AlignLeft,
  AtSign,
  Calendar,
  CircleChevronDown,
  DollarSign,
  Hash,
  Link2,
  Phone,
  SquareCheck,
  Tags,
  Type,
  User,
  type LucideIcon,
} from "lucide-react";

import type { FieldType } from "@/hooks/use-fields";

export const FIELD_TYPES: { type: FieldType; label: string; icon: LucideIcon; hint: string }[] = [
  { type: "text", label: "Text", icon: Type, hint: "A short line of text" },
  { type: "long_text", label: "Long text", icon: AlignLeft, hint: "Paragraphs, descriptions" },
  { type: "number", label: "Number", icon: Hash, hint: "Counts, sizes" },
  { type: "currency", label: "Currency", icon: DollarSign, hint: "Money amounts" },
  { type: "date", label: "Date", icon: Calendar, hint: "A calendar date" },
  {
    type: "select",
    label: "Single select",
    icon: CircleChevronDown,
    hint: "One option from a list",
  },
  { type: "multi_select", label: "Multi select", icon: Tags, hint: "Several options from a list" },
  { type: "email", label: "Email", icon: AtSign, hint: "An email address" },
  { type: "phone", label: "Phone", icon: Phone, hint: "A phone number" },
  { type: "url", label: "URL", icon: Link2, hint: "A web link" },
  { type: "user", label: "Person", icon: User, hint: "A workspace member" },
  { type: "checkbox", label: "Checkbox", icon: SquareCheck, hint: "Yes / no" },
];

export function fieldTypeMeta(type: FieldType) {
  return FIELD_TYPES.find((t) => t.type === type) ?? FIELD_TYPES[0]!;
}
