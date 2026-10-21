import { LogoMark } from "./logo";

export function FullScreenLoader({ label = "Loading your workspace…" }: { label?: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background">
      <LogoMark className="size-8 animate-pulse rounded-[9px]" />
      <p className="text-[13px] text-muted-foreground">{label}</p>
    </div>
  );
}
