"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { AgentCursor } from "@/components/agent/agent-cursor";
import { CommandBar } from "@/components/agent/command-bar";
import { AgentPanel } from "@/components/agent/agent-panel";
import { AgentRuntime } from "@/components/agent/agent-runtime";
import { useMe } from "@/hooks/use-auth";
import { useKeySequences, useModKey } from "@/hooks/use-hotkeys";
import { ApiError } from "@/lib/api/client";
import { useUIStore } from "@/stores/ui-store";

import { FullScreenLoader } from "./full-screen-loader";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

function useGlobalShortcuts() {
  const router = useRouter();
  const toggleAgent = useUIStore((s) => s.toggleAgentPanel);
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);
  useModKey("k", () => setCommandOpen(!useUIStore.getState().commandOpen));
  useModKey("j", () => toggleAgent());
  const bindings = React.useMemo(
    () => ({
      "g t": () => router.push("/today"),
      "g p": () => router.push("/pipeline"),
      "g d": () => router.push("/deals"),
      "g o": () => router.push("/companies"),
      "g c": () => router.push("/contacts"),
      "g k": () => router.push("/tasks"),
      "g s": () => router.push("/settings"),
      "?": () => setShortcutsOpen(true),
    }),
    [router, setShortcutsOpen],
  );
  useKeySequences(bindings);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, error, isLoading } = useMe();
  useGlobalShortcuts();

  const unauthorized = error instanceof ApiError && error.status === 401;
  const needsOnboarding = me && !me.workspace.onboarding_completed;

  React.useEffect(() => {
    if (unauthorized) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (needsOnboarding) router.replace("/onboarding");
  }, [unauthorized, needsOnboarding, router, pathname]);

  if (isLoading || unauthorized || needsOnboarding || !me) {
    return <FullScreenLoader />;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" className="relative min-h-0 flex-1 overflow-auto">
          {children}
        </main>
      </div>
      <React.Suspense>
        <AgentPanel />
      </React.Suspense>
      <AgentCursor />
      <React.Suspense>
        <AgentRuntime />
        <CommandBar />
        <ShortcutsDialog />
      </React.Suspense>
    </div>
  );
}
