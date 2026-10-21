"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { ChartCardData } from "@/lib/agent/types";
import { formatMoney } from "@/lib/format";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular">{value}</p>
    </div>
  );
}

type Row = { name: string; value: number; weighted: number; count: number };

function ChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: { payload: Row }[];
  currency: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-pop">
      <p className="font-medium">{row.name}</p>
      <p className="text-muted-foreground tabular">
        {formatMoney(row.value, currency)} · {row.count} {row.count === 1 ? "deal" : "deals"}
      </p>
      <p className="text-muted-foreground tabular">
        {formatMoney(row.weighted, currency)} weighted
      </p>
    </div>
  );
}

/** Single series: open value per stage (one hue, no legend — the title names it). */
export function ChartCard({ data }: { data: ChartCardData }) {
  const cur = data.currency;
  const rows: Row[] = data.series
    .filter((s) => s.kind === "open")
    .map((s) => ({
      name: s.name,
      value: Number(s.value),
      weighted: Number(s.weighted),
      count: s.count,
    }));
  return (
    <div className="rounded-xl border bg-surface p-3" data-card="chart">
      <p className="text-[13px] font-semibold">{data.title}</p>
      <p className="text-xs text-muted-foreground">Open value per stage</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Open" value={formatMoney(data.totals.open_value, cur, { compact: true })} />
        <Stat
          label="Weighted"
          value={formatMoney(data.totals.weighted_value, cur, { compact: true })}
        />
        <Stat
          label="Won this month"
          value={formatMoney(data.totals.won_this_month_value, cur, { compact: true })}
        />
      </div>
      <div className="mt-3 h-44 w-full text-muted-foreground">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
            barCategoryGap={6}
          >
            <CartesianGrid horizontal={false} stroke="var(--border)" strokeWidth={1} />
            <XAxis
              type="number"
              tickFormatter={(v: number) => formatMoney(v, cur, { compact: true })}
              tick={{ fontSize: 11, fill: "currentColor" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={84}
              tick={{ fontSize: 11, fill: "currentColor" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--accent)", opacity: 0.6 }}
              content={<ChartTooltip currency={cur} />}
            />
            <Bar
              dataKey="value"
              fill="var(--chart-1)"
              radius={[0, 4, 4, 0]}
              maxBarSize={16}
              isAnimationActive
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
