import { avatarClasses } from "@/lib/colors";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
  xl: "size-12 text-base",
} as const;

type Size = keyof typeof SIZES;

export function Avatar({
  name,
  src,
  size = "sm",
  className,
  title,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: Size;
  className?: string;
  title?: string;
}) {
  const label = name ?? "Unknown";
  if (src) {
    return (
      <img
        src={src}
        alt={label}
        title={title ?? label}
        className={cn("shrink-0 rounded-full object-cover", SIZES[size], className)}
      />
    );
  }
  return (
    <span
      title={title ?? label}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight select-none",
        avatarClasses(label),
        SIZES[size],
        className,
      )}
    >
      {initials(label)}
    </span>
  );
}

/** Square logo for companies (initials, deterministic colour). */
export function CompanyLogo({
  name,
  src,
  size = "sm",
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: Size;
  className?: string;
}) {
  const label = name ?? "?";
  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={cn("shrink-0 rounded-md object-cover", SIZES[size], className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md font-semibold tracking-tight select-none",
        avatarClasses(`co:${label}`),
        SIZES[size],
        className,
      )}
    >
      {initials(label)}
    </span>
  );
}
