"use client";

import * as React from "react";

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable ||
    target.closest("[cmdk-root]") !== null
  );
}

/** ⌘/Ctrl + key handler. Works even while typing (like most apps' ⌘K). */
export function useModKey(key: string, handler: (e: KeyboardEvent) => void) {
  const ref = React.useRef(handler);
  React.useEffect(() => {
    ref.current = handler;
  }, [handler]);
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === key) {
        e.preventDefault();
        ref.current(e);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key]);
}

/**
 * Single-key and "G then X" sequences, ignored while typing.
 * `bindings` maps "c", "?", "g p" … to handlers.
 */
export function useKeySequences(bindings: Record<string, () => void>) {
  const ref = React.useRef(bindings);
  React.useEffect(() => {
    ref.current = bindings;
  }, [bindings]);
  React.useEffect(() => {
    let prefix: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector("[role=dialog]")) return;
      const key = e.key.toLowerCase();
      const map = ref.current;
      if (prefix) {
        const combo = `${prefix} ${key}`;
        prefix = null;
        clearTimeout(timer);
        if (map[combo]) {
          e.preventDefault();
          map[combo]();
        }
        return;
      }
      if (Object.keys(map).some((k) => k.startsWith(`${key} `))) {
        prefix = key;
        timer = setTimeout(() => (prefix = null), 900);
        return;
      }
      const single = map[e.key] ?? map[key];
      if (single) {
        e.preventDefault();
        single();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
  }, []);
}
