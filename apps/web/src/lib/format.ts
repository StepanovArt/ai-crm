const moneyFormatters = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${compact}`;
  let fmt = moneyFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 0,
      minimumFractionDigits: 0,
    });
    moneyFormatters.set(key, fmt);
  }
  return fmt;
}

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(
  value: string | number | null | undefined,
  currency = "USD",
  opts: { compact?: boolean } = {},
): string {
  try {
    return moneyFormatter(currency, Boolean(opts.compact)).format(toNumber(value));
  } catch {
    return `${toNumber(value).toLocaleString("en-US")} ${currency}`;
  }
}

export function formatNumber(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(toNumber(value));
}

const DAY = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Calendar-day difference (target - now), negative for the past. */
export function dayDiff(target: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(target) - startOfDay(now)) / DAY);
}

export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const diffMs = date.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) {
    const m = Math.round(abs / 60_000);
    return diffMs < 0 ? `${m}m ago` : `in ${m}m`;
  }
  const days = dayDiff(date, now);
  if (days === 0) {
    const h = Math.round(abs / 3_600_000);
    return diffMs < 0 ? `${h}h ago` : `in ${h}h`;
  }
  if (days === -1) return "yesterday";
  if (days === 1) return "tomorrow";
  if (Math.abs(days) < 30) return days < 0 ? `${-days}d ago` : `in ${days}d`;
  return formatDate(date);
}

export function formatDate(value: string | Date | null | undefined, opts?: { year?: boolean }) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: opts?.year || !sameYear ? "numeric" : undefined,
  });
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return (first + second).toUpperCase();
}

export function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pluralize(count: number, one: string, many?: string) {
  return `${count} ${count === 1 ? one : (many ?? `${one}s`)}`;
}

export function daysSince(value: string | null | undefined, now: Date = new Date()): number | null {
  if (!value) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / DAY));
}
