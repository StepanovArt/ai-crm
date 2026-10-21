import { ThemeToggle } from "@/components/layout/theme-toggle";
import { APP_NAME } from "@/lib/utils";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3">
        <div className="flex h-9 items-center gap-2 px-2 font-semibold">
          <span className="size-5 rounded-md bg-primary" />
          {APP_NAME}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-end gap-2 border-b bg-surface px-4">
          <ThemeToggle />
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
