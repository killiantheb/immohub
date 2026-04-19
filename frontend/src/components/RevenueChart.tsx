"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyRevenue } from "@/lib/types";
import { C } from "@/lib/design-tokens";


const MONTH_FR = [
  "", "Jan", "Fév", "Mar", "Avr", "Mai", "Jui",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

function formatMonth(month: string): string {
  const [year, mo] = month.split("-");
  return `${MONTH_FR[parseInt(mo)] ?? mo} ${year.slice(2)}`;
}

function formatEuro(value: number): string {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

interface Props {
  data: MonthlyRevenue[];
  height?: number;
}

export function RevenueChart({ data, height = 220 }: Props) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center py-12"
        style={{ fontSize: 14, color: C.text3 }}
      >
        Aucune donnée disponible
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--althy-orange)" stopOpacity={0.18} />
            <stop offset="95%" stopColor="var(--althy-orange)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--althy-border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--althy-text-3)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
          tick={{ fontSize: 11, fill: "var(--althy-text-3)" }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip
          formatter={(value) => [formatEuro(Number(value)), "Revenus"]}
          labelStyle={{ fontWeight: 600, color: "var(--althy-text)" }}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid var(--althy-border)",
            backgroundColor: "var(--althy-surface)",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="var(--althy-orange)"
          strokeWidth={2}
          fill="url(#revenueGradient)"
          dot={false}
          activeDot={{ r: 4, fill: "var(--althy-orange)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
