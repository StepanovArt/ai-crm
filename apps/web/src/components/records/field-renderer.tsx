"use client";

import { Check, ExternalLink } from "lucide-react";
import Link from "next/link";

import { Avatar, CompanyLogo } from "@/components/common/avatar";
import { MoneyText } from "@/components/common/money";
import { RelativeDate } from "@/components/common/relative-date";
import { ScoreBadge } from "@/components/common/score-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { useMembers } from "@/hooks/use-workspace";
import { formatDate, formatNumber } from "@/lib/format";
import type { DescriptorType, Option } from "@/lib/records/descriptors";
import { cn } from "@/lib/utils";

const Empty = () => <span className="text-muted-foreground/50">—</span>;

type Brief = { id: string; name?: string; full_name?: string; domain?: string | null } | null;

export function FieldRenderer({
  type,
  value,
  options,
  recordId,
  currency = "USD",
  className,
}: {
  type: DescriptorType;
  value: unknown;
  options?: Option[];
  recordId?: string;
  currency?: string;
  className?: string;
}) {
  const { byId } = useMembers();
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && !value.length)
  ) {
    if (type === "checkbox") return <Empty />;
    return <Empty />;
  }
  switch (type) {
    case "text":
    case "phone":
      return <span className={cn("truncate", className)}>{String(value)}</span>;
    case "long_text":
      return (
        <span className={cn("line-clamp-2 whitespace-pre-wrap", className)}>{String(value)}</span>
      );
    case "number":
      return <span className={cn("tabular", className)}>{formatNumber(value as number)}</span>;
    case "currency":
      return <MoneyText value={value as string} currency={currency} className={className} />;
    case "date":
      return (
        <span className={cn("tabular", className)}>
          {formatDate(String(value), { year: false })}
        </span>
      );
    case "datetime":
      return (
        <RelativeDate value={String(value)} className={cn("text-muted-foreground", className)} />
      );
    case "select":
    case "lead_status":
    case "stage": {
      const opt = options?.find((o) => o.value === value);
      return (
        <StatusBadge
          label={opt?.label ?? String(value)}
          color={opt?.color ?? "slate"}
          dot={type !== "select"}
        />
      );
    }
    case "multi_select": {
      const values = value as string[];
      return (
        <span className={cn("flex flex-wrap gap-1", className)}>
          {values.map((v) => {
            const opt = options?.find((o) => o.value === v);
            return <StatusBadge key={v} label={opt?.label ?? v} color={opt?.color ?? "slate"} />;
          })}
        </span>
      );
    }
    case "email":
      return (
        <a
          href={`mailto:${value as string}`}
          onClick={(e) => e.stopPropagation()}
          className={cn("truncate text-foreground/90 hover:underline", className)}
        >
          {String(value)}
        </a>
      );
    case "url": {
      const href = String(value).startsWith("http") ? String(value) : `https://${value as string}`;
      const label = String(value)
        .replace(/^https?:\/\/(www\.)?/, "")
        .replace(/\/$/, "");
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "group/link inline-flex min-w-0 items-center gap-1 text-foreground/90 hover:underline",
            className,
          )}
        >
          <span className="truncate">{label}</span>
          <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-60" />
        </a>
      );
    }
    case "user": {
      const member = byId.get(String(value));
      return (
        <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
          <Avatar name={member?.full_name ?? "Unknown"} size="xs" />
          <span className="truncate">{member?.full_name ?? "Unknown"}</span>
        </span>
      );
    }
    case "checkbox":
      return value ? (
        <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Empty />
      );
    case "score":
      return <ScoreBadge score={Number(value)} contactId={recordId} />;
    case "company_link": {
      const c = value as Brief;
      if (!c) return <Empty />;
      return (
        <Link
          href={`/records/company/${c.id}`}
          onClick={(e) => e.stopPropagation()}
          className={cn("flex min-w-0 items-center gap-1.5 hover:underline", className)}
        >
          <CompanyLogo name={c.name} size="xs" />
          <span className="truncate">{c.name}</span>
        </Link>
      );
    }
    case "contact_link": {
      const c = value as Brief;
      if (!c) return <Empty />;
      return (
        <Link
          href={`/records/contact/${c.id}`}
          onClick={(e) => e.stopPropagation()}
          className={cn("flex min-w-0 items-center gap-1.5 hover:underline", className)}
        >
          <Avatar name={c.full_name} size="xs" />
          <span className="truncate">{c.full_name}</span>
        </Link>
      );
    }
    default:
      return <span className="truncate">{String(value)}</span>;
  }
}
