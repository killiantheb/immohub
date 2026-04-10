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

const S = {
  bg: "var(--althy-bg)",
  surface: "var(--althy-surface)",
  surface2: "var(--althy-surface-2)",
  border: "var(--althy-border)",
  text: "var(--althy-text)",
  text2: "var(--althy-text-2)",
  text3: "var(--althy-text-3)",
  orange: "var(--althy-orange)",
  orangeBg: "var(--althy-orange-bg)",
  green: "var(--althy-green)",
  greenBg: "var(--althy-green-bg)",
  red: "var(--althy-red)",
  redBg: "var(--althy-red-bg)",
  amber: "var(--althy-amber)",
  amberBg: "var(--althy-amber-bg)",
  blue: "var(--althy-blue)",
  blueBg: "var(--althy-blue-bg)",
  shadow: "var(--althy-shadow)",
  shadowMd: "var(--althy-shadow-md)",
} as const;

function fmt(amount: number) {
  return `CHF ${amount.toLocaleString("fr-CH", { maximumFractionDigits: 0 })}`;
}

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  if (!prev) return null;
  const pct = ((current - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span
      className="flex items-center gap-0.5 text-xs font-medium"
      style={{ color: up ? S.green : S.red }}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%{" "}
      <span className="font-normal" style={{ color: S.text3 }}>vs mois dernier</span>
    </span>
  );
}

const KPI_CARDS = (kpis: NonNullable<ReturnType<typeof useOwnerDashboard>["data"]>) => [
  {
    label: "Revenus du mois",
    value: fmt(kpis.revenue_current_month),
    sub: <DeltaBadge current={kpis.revenue_current_month} prev={kpis.revenue_prev_month} />,
    icon: Wallet,
    iconBg: S.orangeBg,
    iconColor: S.orange,
    accentColor: S.orange,
    alert: false,
  },
  {
    label: "Taux d'occupation",
    value: `${kpis.occupancy_rate}%`,
    sub: <span className="text-xs" style={{ color: S.text3 }}>{kpis.active_contracts} contrat{kpis.active_contracts !== 1 ? "s" : ""} actif{kpis.active_contracts !== 1 ? "s" : ""}</span>,
    icon: Home,
    iconBg: S.greenBg,
    iconColor: S.green,
    accentColor: S.green,
    alert: false,
  },
  {
    label: "Loyers en attente",
    value: String(kpis.pending_rents),
    sub: <span className="text-xs" style={{ color: S.text3 }}>{kpis.total_properties} bien{kpis.total_properties !== 1 ? "s" : ""} au total</span>,
    icon: Clock,
    iconBg: kpis.pending_rents > 0 ? S.amberBg : S.surface2,
    iconColor: kpis.pending_rents > 0 ? S.amber : S.text3,
    accentColor: kpis.pending_rents > 0 ? S.amber : S.text3,
    alert: kpis.pending_rents > 0,
  },
  {
    label: "Impayés",
    value: String(kpis.late_rents),
    sub: kpis.late_rents > 0
      ? <span className="text-xs font-medium" style={{ color: S.red }}>Action requise</span>
      : <span className="text-xs" style={{ color: S.text3 }}>Aucun impayé</span>,
    icon: AlertTriangle,
    iconBg: kpis.late_rents > 0 ? S.redBg : S.surface2,
    iconColor: kpis.late_rents > 0 ? S.red : S.text3,
    accentColor: kpis.late_rents > 0 ? S.red : S.text3,
    alert: kpis.late_rents > 0,
  },
];

function SkeletonCard() {
  return (
    <div
      className="rounded-2xl p-5 animate-pulse"
      style={{ border: `1px solid ${S.border}`, background: S.surface, boxShadow: S.shadow }}
    >
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 rounded" style={{ background: S.surface2 }} />
        <div className="h-9 w-9 rounded-xl" style={{ background: S.surface2 }} />
      </div>
      <div className="mt-4 h-7 w-32 rounded" style={{ background: S.surface2 }} />
      <div className="mt-2 h-3 w-20 rounded" style={{ background: S.surface2 }} />
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

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl px-8 py-7 text-white shadow-lg" style={{ background: "linear-gradient(135deg, #1C1917 0%, #3a2a1e 100%)" }}>
        <div className="relative z-10">
          <p className="text-sm font-medium" style={{ color: S.orange }}>
            {greeting}{firstName ? `, ${firstName}` : ""}
          </p>
          <h1 style={{ marginTop: 4, fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontWeight: 400, fontSize: 28, color: "#fff" }}>
            Votre activité en un coup d'oeil
          </h1>
          <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full" style={{ background: "rgba(232,96,44,0.10)" }} />
        <div className="absolute -bottom-6 right-20 h-24 w-24 rounded-full" style={{ background: "rgba(232,96,44,0.10)" }} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : isError
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-5"
                style={{ border: `1px solid ${S.border}`, background: S.surface, boxShadow: S.shadow }}
              >
                <p className="text-xs" style={{ color: S.text3 }}>Données indisponibles</p>
                <p className="mt-2 text-2xl font-bold" style={{ color: S.border }}>—</p>
              </div>
            ))
          : kpis
          ? KPI_CARDS(kpis).map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="relative overflow-hidden rounded-2xl p-5 transition-shadow hover:shadow-md"
                  style={{ border: `1px solid ${S.border}`, background: S.surface, boxShadow: S.shadow }}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: S.text3 }}>
                      {card.label}
                    </p>
                    <div className="rounded-xl p-2.5" style={{ background: card.iconBg }}>
                      <Icon className="h-4 w-4" style={{ color: card.iconColor }} />
                    </div>
                  </div>
                  <p className="mt-3 text-3xl font-bold tracking-tight" style={{ color: S.text }}>
                    {card.value}
                  </p>
                  <div className="mt-1.5">{card.sub}</div>
                  {/* Bottom accent bar */}
                  <div
                    className="absolute bottom-0 left-0 h-0.5 w-full opacity-60"
                    style={{ background: card.accentColor }}
                  />
                </div>
              );
            })
          : null}
      </div>

      {/* Alert banner */}
      {kpis && kpis.late_rents > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl px-5 py-3.5"
          style={{ border: `1px solid ${S.red}`, background: S.redBg }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: S.red }} />
          <p className="flex-1 text-sm" style={{ color: S.red }}>
            <strong>{kpis.late_rents} loyer{kpis.late_rents > 1 ? "s" : ""} impayé{kpis.late_rents > 1 ? "s" : ""}</strong> — prenez action rapidement pour éviter les pénalités.
          </p>
          <Link
            href="/app/transactions?status=late"
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{ background: S.red, color: "#fff" }}
          >
            Voir les impayés →
          </Link>
        </div>
      )}

      {/* Chart + Transactions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Revenue chart */}
        <div
          className="col-span-2 rounded-2xl p-6"
          style={{ border: `1px solid ${S.border}`, background: S.surface, boxShadow: S.shadow }}
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold" style={{ color: S.text }}>Revenus sur 12 mois</h2>
              {stats && (
                <p className="text-xs" style={{ color: S.text3 }}>Total : {fmt(stats.total)}</p>
              )}
            </div>
            <Link
              href="/app/transactions"
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ border: `1px solid ${S.border}`, color: S.text2 }}
            >
              Détails <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <RevenueChart data={stats?.by_month ?? []} />
        </div>

        {/* Recent transactions */}
        <div
          className="rounded-2xl p-6"
          style={{ border: `1px solid ${S.border}`, background: S.surface, boxShadow: S.shadow }}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: S.text }}>Activité récente</h2>
            <Link
              href="/app/transactions"
              className="flex items-center gap-1 text-xs font-medium hover:underline"
              style={{ color: S.orange }}
            >
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {!kpis?.recent_transactions?.length ? (
            <div className="flex flex-col items-center justify-center py-10">
              <TrendingUp className="mb-2 h-8 w-8" style={{ color: S.border }} />
              <p className="text-sm" style={{ color: S.text3 }}>Aucune transaction</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {kpis.recent_transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold" style={{ color: S.text }}>{tx.reference}</p>
                    <p className="text-xs" style={{ color: S.text3 }}>
                      {tx.due_date ? new Date(tx.due_date).toLocaleDateString("fr-FR") : "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-bold" style={{ color: S.text }}>
                      CHF {tx.amount.toLocaleString("fr-CH")}
                    </span>
                    <RentStatusBadge status={tx.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: S.text3 }}>Actions rapides</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: "/app/biens/nouveau", icon: Building2, label: "Ajouter un bien", iconColor: S.orange, bg: S.orangeBg },
            { href: "/app/contracts",      icon: FileText,   label: "Voir les contrats", iconColor: S.blue,   bg: S.blueBg },
            { href: "/app/rfqs/new",       icon: Plus,       label: "Appel d'offre",  iconColor: S.orange, bg: S.orangeBg },
            { href: "/app/transactions?status=late", icon: AlertTriangle, label: "Gérer les impayés", iconColor: S.red, bg: S.redBg },
          ].map(({ href, icon: Icon, label, iconColor, bg }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-xl px-4 py-3.5 transition-all hover:shadow-sm"
              style={{ background: bg, border: `1px solid transparent` }}
            >
              <Icon className="h-4 w-4 shrink-0" style={{ color: iconColor }} />
              <span className="text-sm font-medium" style={{ color: S.text2 }}>{label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
