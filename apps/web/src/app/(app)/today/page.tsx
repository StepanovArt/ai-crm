"use client";

import * as React from "react";
import Link from "next/link";
import { ListChecks } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { TaskRow } from "@/components/tasks/task-row";
import { BriefingSlot } from "@/components/today/briefing-slot";
import { ContactQueue } from "@/components/today/contact-queue";
import { StageBars } from "@/components/today/stage-bars";
import { StaleDeals } from "@/components/today/stale-deals";
import { StatTiles } from "@/components/today/stat-tiles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToday } from "@/hooks/use-today";
import { useTerms } from "@/hooks/use-workspace";

function greeting(date: Date) {
  const h = date.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function TodaySkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <Skeleton className="col-span-2 h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}

export default function TodayPage() {
  const t = useTerms();
  const { data, isLoading } = useToday();
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => setNow(new Date()), []);
  const tasks = [...(data?.tasks_overdue ?? []), ...(data?.tasks_today ?? [])];

  return (
    <div className="mx-auto max-w-6xl px-6 py-7">
      <header className="mb-6">
        <p className="text-[13px] text-muted-foreground">
          {now?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) ??
            " "}
        </p>
        <h1 className="mt-0.5 text-[26px] font-semibold tracking-tight">
          {now ? greeting(now) : "Hello"}, {data?.first_name ?? "there"}
        </h1>
      </header>
      {isLoading || !data ? (
        <TodaySkeleton />
      ) : (
        <div className="space-y-6">
          <BriefingSlot />
          <StatTiles stats={data.stats} dealsLabel={t.deals} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="overflow-hidden" data-agent-id="today-queue">
              <CardHeader className="border-b pb-3">
                <div>
                  <CardTitle>Who to contact next</CardTitle>
                  <CardDescription>
                    Ranked by lead score — replies, meetings and open {t.deals.toLowerCase()}
                  </CardDescription>
                </div>
                <Link
                  href="/contacts?view=hot"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  View hot leads
                </Link>
              </CardHeader>
              <ContactQueue items={data.contact_queue} />
            </Card>
            <Card className="overflow-hidden" data-agent-id="today-tasks">
              <CardHeader className="border-b pb-3">
                <div>
                  <CardTitle>Due today</CardTitle>
                  <CardDescription>
                    {data.tasks_overdue.length > 0 ? `${data.tasks_overdue.length} overdue · ` : ""}
                    {data.tasks_today.length} due today
                  </CardDescription>
                </div>
                <Link href="/tasks" className="text-xs text-muted-foreground hover:text-foreground">
                  All tasks
                </Link>
              </CardHeader>
              <CardContent className="px-2 pt-2 pb-2">
                {tasks.length ? (
                  tasks.map((task) => <TaskRow key={task.id} task={task} compact />)
                ) : (
                  <EmptyState
                    compact
                    icon={ListChecks}
                    title="All clear"
                    hint="Nothing due today."
                  />
                )}
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card data-agent-id="today-pipeline">
              <CardHeader>
                <div>
                  <CardTitle>{t.pipeline} by stage</CardTitle>
                  <CardDescription>Open value per stage</CardDescription>
                </div>
                {data.stats.pipeline_id && (
                  <Link
                    href={`/pipeline/${data.stats.pipeline_id}`}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Open board
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                <StageBars stages={data.stages} currency={data.stats.currency} />
              </CardContent>
            </Card>
            <Card className="overflow-hidden" data-agent-id="today-stale">
              <CardHeader className="border-b pb-3">
                <div>
                  <CardTitle>Going stale</CardTitle>
                  <CardDescription>
                    Open {t.deals.toLowerCase()} with no activity for a week
                  </CardDescription>
                </div>
                <Link
                  href="/deals?view=stale"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  View all
                </Link>
              </CardHeader>
              <StaleDeals deals={data.stale_deals} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
