/** Named colours (stage presets, select options) → Tailwind classes. Literal strings so Tailwind sees them. */
export type ColorName =
  | "slate"
  | "gray"
  | "blue"
  | "indigo"
  | "violet"
  | "amber"
  | "orange"
  | "green"
  | "teal"
  | "rose"
  | "red"
  | "pink";

type ColorClasses = { dot: string; soft: string; text: string; bar: string };

const COLORS: Record<ColorName, ColorClasses> = {
  slate: {
    dot: "bg-slate-400",
    soft: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
    text: "text-slate-600 dark:text-slate-300",
    bar: "bg-slate-400/80",
  },
  gray: {
    dot: "bg-zinc-400",
    soft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/15 dark:text-zinc-300",
    text: "text-zinc-600 dark:text-zinc-300",
    bar: "bg-zinc-400/80",
  },
  blue: {
    dot: "bg-sky-500",
    soft: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
    text: "text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500/80",
  },
  indigo: {
    dot: "bg-indigo-500",
    soft: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    text: "text-indigo-700 dark:text-indigo-300",
    bar: "bg-indigo-500/80",
  },
  violet: {
    dot: "bg-violet-500",
    soft: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    text: "text-violet-700 dark:text-violet-300",
    bar: "bg-violet-500/80",
  },
  amber: {
    dot: "bg-amber-500",
    soft: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    text: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500/80",
  },
  orange: {
    dot: "bg-orange-500",
    soft: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300",
    text: "text-orange-700 dark:text-orange-300",
    bar: "bg-orange-500/80",
  },
  green: {
    dot: "bg-emerald-500",
    soft: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    text: "text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500/80",
  },
  teal: {
    dot: "bg-teal-500",
    soft: "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300",
    text: "text-teal-700 dark:text-teal-300",
    bar: "bg-teal-500/80",
  },
  rose: {
    dot: "bg-rose-500",
    soft: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    text: "text-rose-700 dark:text-rose-300",
    bar: "bg-rose-500/80",
  },
  red: {
    dot: "bg-red-500",
    soft: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    text: "text-red-700 dark:text-red-300",
    bar: "bg-red-500/80",
  },
  pink: {
    dot: "bg-pink-500",
    soft: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
    text: "text-pink-700 dark:text-pink-300",
    bar: "bg-pink-500/80",
  },
};

export const STAGE_COLOR_PRESETS: ColorName[] = [
  "slate",
  "blue",
  "indigo",
  "violet",
  "amber",
  "green",
  "rose",
  "teal",
];

export function colorClasses(name: string | null | undefined): ColorClasses {
  return COLORS[(name ?? "slate") as ColorName] ?? COLORS.slate;
}

const AVATAR_PALETTE = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200",
];

export function avatarClasses(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]!;
}
