import { CheckCircle2, MousePointer2, Sparkles, Undo2 } from "lucide-react";

import { LogoMark } from "@/components/layout/logo";
import { APP_NAME } from "@/lib/utils";

const POINTS = [
  {
    icon: Sparkles,
    title: "Set up in one sentence",
    text: "Describe your business — Halo builds the pipeline, fields and vocabulary.",
  },
  {
    icon: MousePointer2,
    title: "An agent that works in the UI",
    text: "It plans, asks first, then visibly moves cards and creates tasks.",
  },
  {
    icon: Undo2,
    title: "Every action is undoable",
    text: "One click reverts anything the agent did. You stay in control.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <LogoMark />
          {APP_NAME}
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[360px]">{children}</div>
        </div>
        <p className="text-xs text-muted-foreground">AI-native CRM · MVP preview</p>
      </div>
      <div className="relative hidden overflow-hidden border-l bg-zinc-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_20%,rgb(139_92_246/0.35),transparent_70%),radial-gradient(50%_45%_at_20%_85%,rgb(6_182_212/0.25),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.04)_1px,transparent_1px)] [mask-image:radial-gradient(70%_60%_at_50%_40%,black,transparent)] bg-[size:48px_48px]" />
        <div className="relative flex h-full flex-col justify-center px-14 text-zinc-100">
          <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300">
            <CheckCircle2 className="size-3.5 text-emerald-400" /> Plans → asks → acts → undo
          </span>
          <h2 className="max-w-md text-3xl leading-tight font-semibold tracking-tight">
            The CRM where AI works{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">
              alongside you
            </span>
            .
          </h2>
          <ul className="mt-10 max-w-md space-y-6">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                  <Icon className="size-4 text-violet-300" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-zinc-400">
                    {text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
