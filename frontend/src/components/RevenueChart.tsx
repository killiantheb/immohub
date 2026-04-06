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
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
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
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={42}
        />
        <Tooltip
          formatter={(value) => [formatEuro(Number(value)), "Revenus"]}
          labelStyle={{ fontWeight: 600, color: "#374151" }}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#4f46e5"
          strokeWidth={2}
          fill="url(#revenueGradient)"
          dot={false}
          activeDot={{ r: 4, fill: "#4f46e5" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
