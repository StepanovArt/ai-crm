/**
 * Sequential ui_action executor. Each action resolves only after its animation completes,
 * so the agent's work is watchable step by step.
 */
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { applyMove, type Board } from "@/hooks/use-board";
import { useCursorStore, type Rect } from "@/stores/cursor-store";

import type { UIAction } from "./types";

type Router = { push: (href: string) => void; replace: (href: string) => void };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

async function waitFor<T>(
  fn: () => T | null | undefined,
  timeout = 3000,
  every = 50,
): Promise<T | null> {
  const end = Date.now() + timeout;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(every);
  }
}

function findTarget(target: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-agent-id="${CSS.escape(target)}"]`);
}

/** Element rect clipped to the visible app viewport (#main), so rings never spill under panels. */
function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  const main = el.closest("#main")?.getBoundingClientRect();
  if (!main) return { top: r.top, left: r.left, width: r.width, height: r.height };
  const left = Math.max(r.left, main.left + 4);
  const right = Math.min(r.right, main.right - 4);
  const top = Math.max(r.top, main.top + 4);
  const bottom = Math.min(r.bottom, main.bottom - 4);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function scrollParents(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  let node = el.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY + style.overflowX)) out.push(node);
    node = node.parentElement;
  }
  return out;
}

/** Bring an element into view: centre vertically; scroll sideways only if it fits and is hidden. */
function revealElement(el: HTMLElement) {
  const behavior: ScrollBehavior = reducedMotion() ? "auto" : "smooth";
  for (const parent of scrollParents(el)) {
    const p = parent.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    let top = parent.scrollTop;
    let left = parent.scrollLeft;
    if (
      parent.scrollHeight > parent.clientHeight &&
      (r.top < p.top + 8 || r.bottom > p.bottom - 8)
    ) {
      top += r.top - p.top - (p.height - Math.min(r.height, p.height)) / 2;
    }
    if (
      parent.scrollWidth > parent.clientWidth &&
      r.width < p.width &&
      (r.left < p.left || r.right > p.right)
    ) {
      left += r.left < p.left ? r.left - p.left - 24 : r.right - p.right + 24;
    }
    if (top !== parent.scrollTop || left !== parent.scrollLeft)
      parent.scrollTo({ top, left, behavior });
  }
}

const VIEW_PATHS: Record<string, string> = {
  contacts: "/contacts",
  deals: "/deals",
  companies: "/companies",
  tasks: "/tasks",
};

class UIExecutor {
  private router: Router | null = null;
  private qc: QueryClient | null = null;
  private chain: Promise<void> = Promise.resolve();
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  attach(router: Router, qc: QueryClient) {
    this.router = router;
    this.qc = qc;
  }

  /** Queue an action; resolves when it (and everything before it) has finished. */
  enqueue(action: UIAction): Promise<void> {
    this.chain = this.chain.then(() => this.run(action)).catch(() => undefined);
    return this.chain;
  }

  idle(): Promise<void> {
    return this.chain;
  }

  private async run(action: UIAction) {
    clearTimeout(this.hideTimer);
    switch (action.kind) {
      case "navigate":
        await this.navigate(action.href);
        break;
      case "open_record":
        await this.navigate(`/records/${action.record_type}/${action.record_id}`);
        break;
      case "apply_filter":
        await this.applyFilter(action.view, action.filter);
        break;
      case "highlight":
        await this.highlight(action.target, action.duration_ms ?? 900);
        break;
      case "pulse":
        await this.pulse(action.target);
        break;
      case "move_card":
        await this.moveCard(action.deal_id, action.to_stage_id);
        break;
      case "invalidate":
        for (const key of action.query_keys) await this.qc?.invalidateQueries({ queryKey: key });
        break;
      case "toast":
        toast(action.text, { className: "agent-toast" });
        break;
    }
    this.hideTimer = setTimeout(() => useCursorStore.getState().hide(), 1600);
  }

  private async navigate(href: string) {
    if (!this.router) return;
    const target = new URL(href, window.location.origin);
    const here = window.location.pathname + window.location.search;
    if (here === target.pathname + target.search) return;
    this.router.push(href);
    await waitFor(() => window.location.pathname === target.pathname || null, 4000);
    await sleep(reducedMotion() ? 50 : 350);
  }

  private async applyFilter(view: string, filter: Record<string, unknown>) {
    const path = VIEW_PATHS[view] ?? `/${view}`;
    const qs = new URLSearchParams({ view: "all", filter: JSON.stringify(filter) });
    if (window.location.pathname !== path) {
      await this.navigate(`${path}?${qs}`);
    } else {
      this.router?.replace(`${path}?${qs}`);
      await sleep(300);
    }
  }

  private async highlight(target: string, duration: number) {
    const el = await waitFor(() => findTarget(target), 4000);
    if (!el) return;
    revealElement(el);
    await sleep(reducedMotion() ? 0 : 280);
    const cursor = useCursorStore.getState();
    const r = rectOf(el);
    cursor.moveTo(
      r.left + Math.min(r.width * 0.75, r.width - 12),
      r.top + Math.min(r.height * 0.7, r.height - 8),
    );
    cursor.setRing(r);
    el.setAttribute("data-agent-active", "true");
    // Track the element while highlighted (it may move as data refreshes or the page scrolls).
    const end = Date.now() + duration;
    while (Date.now() < end) {
      await sleep(60);
      const live = findTarget(target);
      if (live) this.follow(live);
    }
    el.removeAttribute("data-agent-active");
    findTarget(target)?.removeAttribute("data-agent-active");
    useCursorStore.getState().setRing(null);
  }

  /** Keep the ring and cursor glued to an element that may still be scrolling or animating. */
  private follow(el: HTMLElement) {
    const r = rectOf(el);
    const cursor = useCursorStore.getState();
    cursor.setRing(r);
    cursor.moveTo(
      r.left + Math.min(r.width * 0.75, r.width - 12),
      r.top + Math.min(r.height * 0.7, r.height - 8),
    );
  }

  private async pulse(target: string) {
    const el = findTarget(target);
    if (!el) return;
    el.setAttribute("data-agent-pulse", "true");
    await sleep(650);
    el.removeAttribute("data-agent-pulse");
  }

  private async moveCard(dealId: string, toStageId: string) {
    if (!this.qc) return;
    const boards = this.qc.getQueriesData<Board>({ queryKey: ["pipelines", "board"] });
    let moved = false;
    for (const [key, board] of boards) {
      if (board?.deals.some((d) => d.id === dealId)) {
        this.qc.setQueryData<Board>(key, applyMove(board, dealId, toStageId, 0));
        moved = true;
      }
    }
    if (!moved) return;
    // Follow the card while it slides into its new column.
    const end = Date.now() + (reducedMotion() ? 50 : 800);
    let scrolled = false;
    while (Date.now() < end) {
      await sleep(50);
      const el = findTarget(`deal-card-${dealId}`);
      if (!el) continue;
      if (!scrolled) {
        revealElement(el);
        scrolled = true;
      }
      const r = rectOf(el);
      useCursorStore.getState().moveTo(r.left + r.width * 0.75, r.top + r.height * 0.7);
    }
  }
}

export const uiExecutor = new UIExecutor();
