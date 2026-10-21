import { create } from "zustand";
import { persist } from "zustand/middleware";

type UIState = {
  sidebarCollapsed: boolean;
  agentPanelOpen: boolean;
  agentPanelWidth: number;
  commandOpen: boolean;
  shortcutsOpen: boolean;
  toggleSidebar: () => void;
  setAgentPanelOpen: (open: boolean) => void;
  toggleAgentPanel: () => void;
  setAgentPanelWidth: (width: number) => void;
  setCommandOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
};

export const AGENT_PANEL_MIN = 360;
export const AGENT_PANEL_MAX = 520;

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      agentPanelOpen: false,
      agentPanelWidth: 400,
      commandOpen: false,
      shortcutsOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setAgentPanelOpen: (open) => set({ agentPanelOpen: open }),
      toggleAgentPanel: () => set((s) => ({ agentPanelOpen: !s.agentPanelOpen })),
      setAgentPanelWidth: (width) =>
        set({ agentPanelWidth: Math.min(AGENT_PANEL_MAX, Math.max(AGENT_PANEL_MIN, width)) }),
      setCommandOpen: (open) => set({ commandOpen: open }),
      setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
    }),
    {
      name: "halo-ui",
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        agentPanelOpen: s.agentPanelOpen,
        agentPanelWidth: s.agentPanelWidth,
      }),
    },
  ),
);
