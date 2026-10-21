import { create } from "zustand";

export type Rect = { top: number; left: number; width: number; height: number };

type CursorState = {
  visible: boolean;
  x: number;
  y: number;
  ring: Rect | null;
  label: string | null;
  moveTo: (x: number, y: number, label?: string | null) => void;
  setRing: (ring: Rect | null) => void;
  hide: () => void;
};

export const useCursorStore = create<CursorState>((set) => ({
  visible: false,
  x: typeof window === "undefined" ? 0 : window.innerWidth - 120,
  y: 80,
  ring: null,
  label: null,
  moveTo: (x, y, label = null) => set({ visible: true, x, y, label }),
  setRing: (ring) => set({ ring }),
  hide: () => set({ visible: false, ring: null, label: null }),
}));
