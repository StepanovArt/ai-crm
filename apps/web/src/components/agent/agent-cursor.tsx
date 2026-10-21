"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { useCursorStore } from "@/stores/cursor-store";

const SPRING = { type: "spring" as const, stiffness: 260, damping: 28, mass: 0.8 };

/** Global overlay: the agent's branded cursor and a glow ring around what it's working on. */
export function AgentCursor() {
  const { visible, x, y, ring, label } = useCursorStore();
  const reduced = useReducedMotion();
  const transition = reduced ? { duration: 0 } : SPRING;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden>
      <AnimatePresence>
        {ring && (
          <motion.div
            key="ring"
            className="absolute rounded-[12px]"
            style={{
              boxShadow:
                "0 0 0 2px rgb(139 92 246 / 0.95), 0 0 0 6px rgb(139 92 246 / 0.16), 0 0 28px 4px rgb(6 182 212 / 0.28)",
            }}
            initial={{
              opacity: 0,
              top: ring.top - 4,
              left: ring.left - 4,
              width: ring.width + 8,
              height: ring.height + 8,
              scale: 1.04,
            }}
            animate={{
              opacity: 1,
              top: ring.top - 4,
              left: ring.left - 4,
              width: ring.width + 8,
              height: ring.height + 8,
              scale: 1,
            }}
            exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.2 } }}
            transition={transition}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="cursor"
            className="absolute top-0 left-0"
            initial={{ opacity: 0, x, y, scale: 0.6 }}
            animate={{ opacity: 1, x, y, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.25 } }}
            transition={transition}
          >
            <svg
              width="22"
              height="24"
              viewBox="0 0 22 24"
              className="drop-shadow-[0_4px_10px_rgb(139_92_246/0.45)]"
            >
              <defs>
                <linearGradient id="agent-cursor" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#8B5CF6" />
                  <stop offset="1" stopColor="#06B6D4" />
                </linearGradient>
              </defs>
              <path
                d="M2 2 L19 10.5 L11 12.5 L7.5 21 Z"
                fill="url(#agent-cursor)"
                stroke="white"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            <span className="mt-0.5 ml-4 inline-flex items-center rounded-full bg-agent px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-white shadow-md">
              {label ?? "Halo AI"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
