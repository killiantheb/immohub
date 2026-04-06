"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Clock,
  FileText,
  TrendingUp,
  Plus,
  Wallet,
  Home,
} from "lucide-react";
import { useOwnerDashboard } from "@/lib/hooks/useDashboard";
import { useRevenueStats } from "@/lib/hooks/useTransactions";
import { useUser } from "@/lib/auth";
import { RevenueChart } from "@/components/RevenueChart";
import { RentStatusBadge } from "@/components/RentStatusBadge";

function fmt(amount: number) {
  return amount.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  if (!prev) return null;
  const pct = ((current - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%{" "}
      <span className="font-normal text-gray-400">vs mois dernier</span>
    </span>
  );
}

const KPI_CARDS = (kpis: NonNullable<ReturnType<typeof useOwnerDashboard>["data"]>) => [
  {
    label: "Revenus du mois",
    value: fmt(kpis.revenue_current_month),
    sub: <DeltaBadge current={kpis.revenue_current_month} prev={kpis.revenue_prev_month} />,
    icon: Wallet,
    color: "from-orange-400 to-orange-600",
    bg: "bg-orange-50",
    iconColor: "text-orange-600",
  },
  {
    label: "Taux d'occupation",
    value: `${kpis.occupancy_rate}%`,
    sub: <span className="text-xs text-gray-400">{kpis.active_contracts} contrat{kpis.active_contracts !== 1 ? "s" : ""} actif{kpis.active_contracts !== 1 ? "s" : ""}</span>,
    icon: Home,
    color: "from-emerald-400 to-emerald-600",
    bg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    label: "Loyers en attente",
    value: String(kpis.pending_rents),
    sub: <span className="text-xs text-gray-400">{kpis.total_properties} bien{kpis.total_properties !== 1 ? "s" : ""} au total</span>,
    icon: Clock,
    color: "from-amber-400 to-amber-600",
    bg: kpis.pending_rents > 0 ? "bg-amber-50" : "bg-gray-50",
    iconColor: kpis.pending_rents > 0 ? "text-amber-600" : "text-gray-400",
    alert: kpis.pending_rents > 0,
  },
  {
    label: "Impayés",
    value: String(kpis.late_rents),
    sub: kpis.late_rents > 0
      ? <span className="text-xs font-medium text-red-500">Action requise</span>
      : <span className="text-xs text-gray-400">Aucun impayé</span>,
    icon: AlertTriangle,
    color: "from-red-400 to-red-600",
    bg: kpis.late_rents > 0 ? "bg-red-50" : "bg-gray-50",
    iconColor: kpis.late_rents > 0 ? "text-red-500" : "text-gray-400",
    alert: kpis.late_rents > 0,
  },
];

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 rounded bg-gray-100" />
        <div className="h-9 w-9 rounded-xl bg-gray-100" />
      </div>
      <div className="mt-4 h-7 w-32 rounded bg-gray-100" />
      <div className="mt-2 h-3 w-20 rounded bg-gray-100" />
    </div>
  );
}

export default function DashboardPage() {
  const { data: profile } = useUser();
  const { data: kpis, isLoading, isError } = useOwnerDashboard();
  const { data: stats } = useRevenueStats(12);

  const firstName = profile?.first_name ?? profile?.full_name?.split(" ")[0] ?? null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="space-y-8">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1C1917] to-[#3a2a1e] px-8 py-7 text-white shadow-lg">
        <div className="relative z-10">
          <p className="text-sm font-medium text-orange-300">
            {greeting}{firstName ? `, ${firstName}` : ""} 👋
          </p>
          <h1 className="mt-1 text-2xl font-bold">Votre activité en un coup d'œil</h1>
          <p className="mt-1 text-sm text-white/50">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-orange-500/10" />
        <div className="absolute -bottom-6 right-20 h-24 w-24 rounded-full bg-orange-500/10" />
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : isError
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-xs text-gray-400">Données indisponibles</p>
                <p className="mt-2 text-2xl font-bold text-gray-300">—</p>
              </div>
            ))
          : kpis
          ? KPI_CARDS(kpis).map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
                    card.alert ? "border-current/20" : "border-gray-100"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {card.label}
                    </p>
                    <div className={`rounded-xl ${card.bg} p-2.5`}>
                      <Icon className={`h-4 w-4 ${card.iconColor}`} />
                    </div>
                  </div>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
                    {card.value}
                  </p>
                  <div className="mt-1.5">{card.sub}</div>
                  {/* Bottom accent bar */}
                  <div className={`absolute bottom-0 left-0 h-0.5 w-full bg-gradient-to-r ${card.color} opacity-60`} />
                </div>
              );
            })
          : null}
      </div>

      {/* ── Alert banner ── */}
      {kpis && kpis.late_rents > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="flex-1 text-sm text-red-700">
            <strong>{kpis.late_rents} loyer{kpis.late_rents > 1 ? "s" : ""} impayé{kpis.late_rents > 1 ? "s" : ""}</strong> — prenez action rapidement pour éviter les pénalités.
          </p>
          <Link href="/transactions?status=late" className="shrink-0 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors">
            Voir les impayés →
          </Link>
        </div>
      )}

      {/* ── Chart + Transactions ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue chart */}
        <div className="col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Revenus sur 12 mois</h2>
              {stats && (
                <p className="text-xs text-gray-400">Total : {fmt(stats.total)}</p>
              )}
            </div>
            <Link
              href="/transactions"
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Détails <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <RevenueChart data={stats?.by_month ?? []} />
        </div>

        {/* Recent transactions */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Activité récente</h2>
            <Link href="/transactions" className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline">
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {!kpis?.recent_transactions?.length ? (
            <div className="flex flex-col items-center justify-center py-10">
              <TrendingUp className="mb-2 h-8 w-8 text-gray-200" />
              <p className="text-sm text-gray-400">Aucune transaction</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {kpis.recent_transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{tx.reference}</p>
                    <p className="text-xs text-gray-400">
                      {tx.due_date ? new Date(tx.due_date).toLocaleDateString("fr-FR") : "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-bold text-gray-900">
                      {tx.amount.toLocaleString("fr-FR")} €
                    </span>
                    <RentStatusBadge status={tx.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">Actions rapides</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: "/properties/new", icon: Building2, label: "Ajouter un bien", color: "text-orange-600", bg: "bg-orange-50 hover:bg-orange-100" },
            { href: "/contracts", icon: FileText, label: "Voir les contrats", color: "text-blue-600", bg: "bg-blue-50 hover:bg-blue-100" },
            { href: "/rfqs/new", icon: Plus, label: "Appel d'offre", color: "text-purple-600", bg: "bg-purple-50 hover:bg-purple-100" },
            { href: "/transactions?status=late", icon: AlertTriangle, label: "Gérer les impayés", color: "text-red-600", bg: "bg-red-50 hover:bg-red-100" },
          ].map(({ href, icon: Icon, label, color, bg }) => (
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

    </div>
  );
}
