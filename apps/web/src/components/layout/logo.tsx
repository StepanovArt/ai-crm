import { cn } from "@/lib/utils";

/** Halo brand mark: an indigo tile with a ring. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]",
        className,
      )}
      aria-hidden
    >
      <span className="size-3 rounded-full border-[2.5px] border-white/95" />
    </span>
  );
}
