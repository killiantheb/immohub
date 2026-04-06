"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  FileText,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  AlertTriangle,
  Activity,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAdminRevenue, usePlatformStats } from "@/lib/hooks/useAdmin";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k€`;
  return fmt(n);
}

const MONTH_FR = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function formatMonth(m: string) {
  const [y, mo] = m.split("-");
  return `${MONTH_FR[parseInt(mo)] ?? mo} ${y.slice(2)}`;
}

const ROLE_COLORS: Record<string, string> = {
  owner: "#E8601C",
  agency: "#4f46e5",
  tenant: "#10b981",
  company: "#f59e0b",
  opener: "#8b5cf6",
  super_admin: "#ef4444",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaires",
  agency: "Agences",
  tenant: "Locataires",
  company: "Entreprises",
  opener: "Ouvreurs",
  super_admin: "Admins",
};

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  href?: string;
}) {
  const card = (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <div className={`rounded-xl p-2.5 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
      {href && (
        <ArrowUpRight className="absolute bottom-4 right-4 h-4 w-4 text-gray-300" />
      )}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="h-3 w-24 rounded bg-gray-100" />
      <div className="mt-4 h-7 w-32 rounded bg-gray-100" />
      <div className="mt-2 h-3 w-20 rounded bg-gray-100" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { data: stats, isLoading } = usePlatformStats();
  const { data: revenue } = useAdminRevenue(12);

  const revenueChartData = (revenue ?? []).map((r) => ({
    label: formatMonth(r.month),
    Revenus: r.revenue,
    Commissions: r.commissions,
  }));

  const rolesData = stats
    ? Object.entries(stats.users_by_role).map(([role, count]) => ({
        name: ROLE_LABELS[role] ?? role,
        value: count,
        color: ROLE_COLORS[role] ?? "#6b7280",
      }))
    : [];

  const kpis = stats
    ? [
        {
          label: "Utilisateurs actifs",
          value: stats.total_users.toLocaleString("fr-FR"),
          sub: `+${stats.new_users_this_month} ce mois`,
          icon: Users,
          color: "bg-indigo-50 text-indigo-600",
          href: "/admin/users",
        },
        {
          label: "Revenus du mois",
          value: fmtShort(stats.revenue_this_month),
          sub: `Total : ${fmtShort(stats.revenue_total)}`,
          icon: Wallet,
          color: "bg-orange-50 text-orange-600",
        },
        {
          label: "Commissions du mois",
          value: fmtShort(stats.commissions_this_month),
          sub: `Total : ${fmtShort(stats.commissions_total)}`,
          icon: TrendingUp,
          color: "bg-emerald-50 text-emerald-600",
        },
        {
          label: "Biens gérés",
          value: stats.active_properties.toLocaleString("fr-FR"),
          sub: `${stats.total_properties} au total`,
          icon: Building2,
          color: "bg-blue-50 text-blue-600",
        },
        {
          label: "Contrats actifs",
          value: stats.active_contracts.toLocaleString("fr-FR"),
          icon: FileText,
          color: "bg-purple-50 text-purple-600",
        },
        {
          label: "Transactions en attente",
          value: stats.pending_transactions.toLocaleString("fr-FR"),
          sub: stats.late_transactions > 0 ? `${stats.late_transactions} en retard` : undefined,
          icon: stats.late_transactions > 0 ? AlertTriangle : Activity,
          color:
            stats.late_transactions > 0
              ? "bg-red-50 text-red-500"
              : "bg-gray-50 text-gray-500",
          href: "/admin/transactions",
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1C1917] to-[#2d1f3d] px-8 py-7 text-white shadow-lg">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">Super Admin</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold">Back-office plateforme</h1>
            <p className="mt-1 text-sm text-white/50">Vue globale de CATHY</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/users"
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 transition-colors"
            >
              Gérer les users
            </Link>
            <Link
              href="/admin/transactions"
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 transition-colors"
            >
              Transactions
            </Link>
          </div>
        </div>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-purple-500/10" />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue + commissions chart */}
        <div className="col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-base font-semibold text-gray-900">
            Revenus & commissions (12 mois)
          </h2>
          {revenueChartData.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-400">
              Aucune donnée
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                  formatter={(v, name) => [
                    Number(v).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
                    name,
                  ]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Revenus" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Commissions" fill="#E8601C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Users by role pie */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-base font-semibold text-gray-900">Répartition des rôles</h2>
          {rolesData.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-gray-400">
              Aucune donnée
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={rolesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {rolesData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, name) => [v, name]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-3 space-y-1.5">
                {rolesData.map((r) => (
                  <li key={r.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-gray-600">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: r.color }}
                      />
                      {r.name}
                    </span>
                    <span className="font-semibold text-gray-800">{r.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/admin/users", label: "Gérer les utilisateurs", icon: Users, color: "text-indigo-600", bg: "bg-indigo-50 hover:bg-indigo-100" },
          { href: "/admin/transactions", label: "Toutes les transactions", icon: Wallet, color: "text-orange-600", bg: "bg-orange-50 hover:bg-orange-100" },
          { href: "/admin/users?is_verified=false", label: "Comptes à vérifier", icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50 hover:bg-emerald-100" },
          { href: "/api/docs", label: "API Swagger", icon: Activity, color: "text-purple-600", bg: "bg-purple-50 hover:bg-purple-100" },
        ].map(({ href, label, icon: Icon, color, bg }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-xl border border-transparent ${bg} px-4 py-3.5 transition-all hover:shadow-sm`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${color}`} />
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
