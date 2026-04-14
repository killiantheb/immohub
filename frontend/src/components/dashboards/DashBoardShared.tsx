// src/components/dashboards/DashBoardShared.tsx
"use client";

import Link from "next/link";
import type { ReactNode, CSSProperties } from "react";

// ── Design constants ──────────────────────────────────────────────────────────
export const DC = {
  bg:      "var(--cream)",
  surface: "#FFFFFF",
  orange:  "var(--terracotta-primary)",
  text:    "var(--charcoal)",
  muted:   "var(--text-tertiary)",
  border:  "var(--border-subtle)",
  shadow:  "none",
  serif:   "var(--font-display, 'Playfair Display', Georgia, serif)",
} as const;

// ── Role colors ───────────────────────────────────────────────────────────────
export const ROLE_COLORS: Record<string, { badge: string; bg: string }> = {
  proprio_solo:     { badge: "#E8602C", bg: "rgba(232,96,44,0.10)" },
  agence:           { badge: "#2563EB", bg: "rgba(37,99,235,0.10)" },
  opener:           { badge: "#0891B2", bg: "rgba(8,145,178,0.10)" },
  artisan:          { badge: "#16A34A", bg: "rgba(22,163,74,0.10)" },
  expert:           { badge: "#7C3AED", bg: "rgba(124,58,237,0.10)" },
  hunter:           { badge: "#D97706", bg: "rgba(217,119,6,0.10)" },
  locataire:        { badge: "#64748B", bg: "rgba(100,116,139,0.10)" },
  acheteur_premium: { badge: "#0E7490", bg: "rgba(14,116,144,0.10)" },
};

export const ROLE_LABEL: Record<string, string> = {
  proprio_solo:     "Propriétaire",
  agence:           "Agence",
  opener:           "Ouvreur",
  artisan:          "Artisan",
  expert:           "Expert",
  hunter:           "Hunter",
  locataire:        "Locataire",
  acheteur_premium: "Acheteur",
};

// ── DTopNav ───────────────────────────────────────────────────────────────────
const NAV_PILL: React.CSSProperties = {
  fontSize: 12, color: "var(--text-secondary)",
  padding: "6px 14px", borderRadius: 20,
  border: "0.5px solid var(--border-subtle)",
  display: "flex", alignItems: "center", gap: 5,
  textDecoration: "none", background: "transparent",
};
export function DTopNav() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
      <Link href="/app/sphere" style={NAV_PILL}>← Sphère IA</Link>
      <Link href="/app/carte"  style={NAV_PILL}>Carte</Link>
    </div>
  );
}

// ── DCard ─────────────────────────────────────────────────────────────────────
interface DCardProps {
  children: ReactNode;
  style?: CSSProperties;
}
export function DCard({ children, style }: DCardProps) {
  return (
    <div
      style={{
        background: DC.surface,
        borderRadius: 24,
        border: `1px solid ${DC.border}`,
        padding: "1.5rem",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── DKpi ──────────────────────────────────────────────────────────────────────
interface DKpiProps {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  value: string;
  label: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
}
export function DKpi({ icon: Icon, iconColor, iconBg, value, label, sub, trend }: DKpiProps) {
  return (
    <DCard>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "0.75rem",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={20} strokeWidth={1.5} style={{ color: iconColor }} />
        </div>
        {trend && trend !== "neutral" && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: trend === "up" ? "var(--althy-green)" : "var(--althy-red)",
            }}
          >
            {trend === "up" ? "▲" : "▼"}
          </span>
        )}
      </div>
      <p
        style={{
          fontSize: 36,
          fontWeight: 600,
          color: DC.text,
          marginBottom: 4,
          lineHeight: 1,
          fontFamily: DC.serif,
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: 13, color: DC.muted, fontWeight: 500 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: DC.muted, marginTop: 2, opacity: 0.8 }}>{sub}</p>}
    </DCard>
  );
}

// ── DRoleHeader ───────────────────────────────────────────────────────────────
interface DRoleHeaderProps {
  role: string;
  badge?: string;
  badgeBg?: string;
  initials?: string;
}
export function DRoleHeader({ role, badge, badgeBg, initials }: DRoleHeaderProps) {
  const colors = ROLE_COLORS[role] ?? { badge: DC.orange, bg: "rgba(232,96,44,0.10)" };
  const badgeColor = badge ?? colors.badge;
  const badgeBgColor = badgeBg ?? colors.bg;
  const roleLabel = ROLE_LABEL[role] ?? role;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "2rem",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      {/* Left: Logo */}
      <Link
        href="/"
        style={{
          fontFamily: DC.serif,
          fontSize: 22,
          fontWeight: 700,
          color: DC.text,
          textDecoration: "none",
          letterSpacing: "0.04em",
        }}
      >
        ALTHY
      </Link>

      {/* Center: role badge */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          padding: "4px 14px",
          borderRadius: 20,
          color: badgeColor,
          background: badgeBgColor,
          letterSpacing: "0.04em",
        }}
      >
        {roleLabel}
      </span>

      {/* Right: Sphère link + avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link
          href="/app/sphere"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 14px",
            borderRadius: 20,
            background: "transparent",
            border: "0.5px solid var(--border-subtle)",
            color: "var(--text-secondary)",
            fontSize: 12,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          ← Sphère IA
        </Link>
        {initials && (
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(26,22,18,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: DC.muted,
            }}
          >
            {initials.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DSectionTitle ─────────────────────────────────────────────────────────────
interface DSectionTitleProps {
  children: ReactNode;
  style?: CSSProperties;
}
export function DSectionTitle({ children, style }: DSectionTitleProps) {
  return (
    <h2
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 15,
        fontWeight: 600,
        color: DC.text,
        marginBottom: "1rem",
        ...style,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 3,
          height: 18,
          borderRadius: 2,
          background: DC.orange,
          flexShrink: 0,
        }}
      />
      {children}
    </h2>
  );
}

// ── DEmptyState ───────────────────────────────────────────────────────────────
interface DEmptyStateProps {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
}
export function DEmptyState({ icon: Icon, title, subtitle, ctaLabel, ctaHref }: DEmptyStateProps) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "2.5rem 1rem",
        color: DC.muted,
      }}
    >
      <Icon size={32} style={{ margin: "0 auto 0.75rem", opacity: 0.35, color: DC.muted }} />
      <p style={{ fontWeight: 600, color: DC.text, marginBottom: 4, fontSize: 15 }}>{title}</p>
      {subtitle && (
        <p style={{ fontSize: 13, color: DC.muted, marginBottom: ctaLabel ? "1rem" : 0 }}>
          {subtitle}
        </p>
      )}
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "8px 20px",
            borderRadius: 10,
            background: DC.orange,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
