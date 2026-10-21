import { colorClasses } from "@/lib/colors";
import { cn } from "@/lib/utils";

export function ColorDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        colorClasses(color).dot,
        className,
      )}
    />
  );
}

/** Soft coloured pill used for stages, select options and lead status. */
export function StatusBadge({
  label,
  color = "slate",
  dot = false,
  className,
}: {
  label: string;
  color?: string;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1.5 truncate rounded-md px-1.5 text-xs font-medium whitespace-nowrap",
        colorClasses(color).soft,
        className,
      )}
    >
      {dot && <ColorDot color={color} className="size-1.5" />}
      <span className="truncate">{label}</span>
    </span>
  );
}

export const LEAD_STATUS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "slate" },
  contacted: { label: "Contacted", color: "blue" },
  qualified: { label: "Qualified", color: "violet" },
  unqualified: { label: "Unqualified", color: "gray" },
  customer: { label: "Customer", color: "green" },
};

export function LeadStatusBadge({ status }: { status: string }) {
  const meta = LEAD_STATUS[status] ?? { label: status, color: "slate" };
  return <StatusBadge label={meta.label} color={meta.color} dot />;
}
