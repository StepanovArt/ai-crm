import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MoneyText({
  value,
  currency = "USD",
  compact = false,
  className,
}: {
  value: string | number | null | undefined;
  currency?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("tabular", className)} title={formatMoney(value, currency)}>
      {formatMoney(value, currency, { compact })}
    </span>
  );
}
