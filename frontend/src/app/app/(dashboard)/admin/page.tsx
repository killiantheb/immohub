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
import { useAuthStore } from "@/lib/store/authStore";

// ── Design tokens ─────────────────────────────────────────────────────────────

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
  owner: "var(--althy-orange)",
  agency: "var(--althy-orange)",
  tenant: "#10b981",
  company: "#f59e0b",
  opener: "var(--althy-orange)",
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
  iconBg,
  iconColor,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  href?: string;
}) {
  const card = (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 20,
        border: `1px solid ${S.border}`,
        background: S.surface,
        padding: "20px",
        boxShadow: S.shadow,
        transition: "box-shadow 0.2s",
      }}
    >
      <div className="flex items-start justify-between">
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: S.text3 }}>{label}</p>
        <div style={{ borderRadius: 12, padding: "10px", background: iconBg }}>
          <Icon style={{ width: 16, height: 16, color: iconColor }} />
        </div>
      </div>
      <p style={{ marginTop: 12, fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: S.text }}>{value}</p>
      {sub && <p style={{ marginTop: 4, fontSize: 12, color: S.text3 }}>{sub}</p>}
      {href && (
        <ArrowUpRight style={{ position: "absolute", bottom: 16, right: 16, width: 16, height: 16, color: S.text3 }} />
      )}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function SkeletonCard() {
  return (
    <div
      className="animate-pulse"
      style={{
        borderRadius: 20,
        border: `1px solid ${S.border}`,
        background: S.surface,
        padding: "20px",
        boxShadow: S.shadow,
      }}
    >
      <div style={{ height: 12, width: 96, borderRadius: 6, background: S.surface2 }} />
      <div style={{ marginTop: 16, height: 28, width: 128, borderRadius: 6, background: S.surface2 }} />
      <div style={{ marginTop: 8, height: 12, width: 80, borderRadius: 6, background: S.surface2 }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuthStore();
  const { data: stats, isLoading } = usePlatformStats();
  const { data: revenue } = useAdminRevenue(12);

  if (user && user.user_metadata?.role !== "super_admin") {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: S.bg }}>
        <div
          style={{
            borderRadius: 20,
            border: `1px solid ${S.border}`,
            background: S.surface,
            padding: "32px",
            textAlign: "center",
            boxShadow: S.shadow,
            maxWidth: 384,
          }}
        >
          <ShieldCheck style={{ margin: "0 auto 16px", width: 40, height: 40, color: S.red }} />
          <h2
            style={{
              fontFamily: "var(--font-serif),'Cormorant Garamond',serif",
              fontWeight: 400,
              fontSize: 20,
              color: S.text,
            }}
          >
            Accès réservé
          </h2>
          <p style={{ marginTop: 8, fontSize: 14, color: S.text2 }}>
            Cette page est réservée aux administrateurs Althy.<br />
            Rôle requis :{" "}
            <code style={{ fontSize: 11, background: S.surface2, padding: "2px 4px", borderRadius: 4 }}>
              super_admin
            </code>
          </p>
        </div>
      </div>
    );
  }

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
          iconBg: S.orangeBg,
          iconColor: S.orange,
          href: "/app/admin/users",
        },
        {
          label: "Revenus du mois",
          value: fmtShort(stats.revenue_this_month),
          sub: `Total : ${fmtShort(stats.revenue_total)}`,
          icon: Wallet,
          iconBg: S.orangeBg,
          iconColor: S.orange,
        },
        {
          label: "Commissions du mois",
          value: fmtShort(stats.commissions_this_month),
          sub: `Total : ${fmtShort(stats.commissions_total)}`,
          icon: TrendingUp,
          iconBg: S.greenBg,
          iconColor: S.green,
        },
        {
          label: "Biens gérés",
          value: stats.active_properties.toLocaleString("fr-FR"),
          sub: `${stats.total_properties} au total`,
          icon: Building2,
          iconBg: S.blueBg,
          iconColor: S.blue,
        },
        {
          label: "Contrats actifs",
          value: stats.active_contracts.toLocaleString("fr-FR"),
          icon: FileText,
          iconBg: S.orangeBg,
          iconColor: S.orange,
        },
        {
          label: "Transactions en attente",
          value: stats.pending_transactions.toLocaleString("fr-FR"),
          sub: stats.late_transactions > 0 ? `${stats.late_transactions} en retard` : undefined,
          icon: stats.late_transactions > 0 ? AlertTriangle : Activity,
          iconBg: stats.late_transactions > 0 ? S.redBg : S.surface2,
          iconColor: stats.late_transactions > 0 ? S.red : S.text3,
          href: "/app/admin/transactions",
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 20,
          background: "linear-gradient(135deg, #1C1917 0%, #2d1f1a 100%)",
          padding: "28px 32px",
          color: "#fff",
          boxShadow: S.shadowMd,
        }}
      >
        <div style={{ position: "relative", zIndex: 10 }} className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck style={{ width: 20, height: 20, color: S.orange }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: S.orange }}>Super Admin</span>
            </div>
            <h1
              style={{
                marginTop: 4,
                fontFamily: "var(--font-serif),'Cormorant Garamond',serif",
                fontWeight: 400,
                fontSize: 26,
                color: "#fff",
              }}
            >
              Back-office plateforme
            </h1>
            <p style={{ marginTop: 4, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Vue globale de CATHY</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/app/admin/users"
              style={{
                borderRadius: 12,
                background: "rgba(255,255,255,0.1)",
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 500,
                color: "#fff",
                transition: "background 0.2s",
              }}
            >
              Gérer les users
            </Link>
            <Link
              href="/app/admin/transactions"
              style={{
                borderRadius: 12,
                background: "rgba(255,255,255,0.1)",
                padding: "8px 16px",
                fontSize: 14,
                fontWeight: 500,
                color: "#fff",
                transition: "background 0.2s",
              }}
            >
              Transactions
            </Link>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: -40,
            top: -40,
            width: 160,
            height: 160,
            borderRadius: "50%",
            background: "rgba(232,96,44,0.08)",
          }}
        />
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
        <div
          className="col-span-2"
          style={{
            borderRadius: 20,
            border: `1px solid ${S.border}`,
            background: S.surface,
            padding: "24px",
            boxShadow: S.shadow,
          }}
        >
          <h2
            style={{
              marginBottom: 20,
              fontFamily: "var(--font-serif),'Cormorant Garamond',serif",
              fontWeight: 400,
              fontSize: 18,
              color: S.text,
            }}
          >
            Revenus &amp; commissions (12 mois)
          </h2>
          {revenueChartData.length === 0 ? (
            <div className="flex items-center justify-center py-16" style={{ fontSize: 14, color: S.text3 }}>
              Aucune donnée
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenueChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={S.border} vertical={false} />
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
                  formatter={(v, name) => [
                    Number(v).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
                    name,
                  ]}
                  contentStyle={{ borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 12, background: S.surface, color: S.text }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Revenus" fill={S.orange} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Commissions" fill={S.green} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Users by role pie */}
        <div
          style={{
            borderRadius: 20,
            border: `1px solid ${S.border}`,
            background: S.surface,
            padding: "24px",
            boxShadow: S.shadow,
          }}
        >
          <h2
            style={{
              marginBottom: 20,
              fontFamily: "var(--font-serif),'Cormorant Garamond',serif",
              fontWeight: 400,
              fontSize: 18,
              color: S.text,
            }}
          >
            Répartition des rôles
          </h2>
          {rolesData.length === 0 ? (
            <div className="flex items-center justify-center py-16" style={{ fontSize: 14, color: S.text3 }}>
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
                    contentStyle={{ borderRadius: 8, border: `1px solid ${S.border}`, fontSize: 12, background: S.surface, color: S.text }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul style={{ marginTop: 12 }} className="space-y-1.5">
                {rolesData.map((r) => (
                  <li key={r.name} className="flex items-center justify-between" style={{ fontSize: 12 }}>
                    <span className="flex items-center gap-2" style={{ color: S.text2 }}>
                      <span
                        style={{ width: 10, height: 10, borderRadius: "50%", background: r.color, display: "inline-block" }}
                      />
                      {r.name}
                    </span>
                    <span style={{ fontWeight: 600, color: S.text }}>{r.value}</span>
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
          { href: "/app/admin/users", label: "Gérer les utilisateurs", icon: Users, iconColor: S.orange, bg: S.orangeBg },
          { href: "/app/admin/transactions", label: "Toutes les transactions", icon: Wallet, iconColor: S.orange, bg: S.orangeBg },
          { href: "/app/admin/users?is_verified=false", label: "Comptes à vérifier", icon: ShieldCheck, iconColor: S.green, bg: S.greenBg },
          { href: "/api/docs", label: "API Swagger", icon: Activity, iconColor: S.orange, bg: S.orangeBg },
        ].map(({ href, label, icon: Icon, iconColor, bg }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderRadius: 12,
              border: `1px solid ${S.border}`,
              background: bg,
              padding: "14px 16px",
              transition: "box-shadow 0.2s, opacity 0.2s",
              textDecoration: "none",
            }}
          >
            <Icon style={{ width: 16, height: 16, flexShrink: 0, color: iconColor }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: S.text }}>{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
