"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRole, ROLE_LABELS } from "@/lib/hooks/useRole";
import { useAuth } from "@/lib/auth";
import { useAuthStore } from "@/lib/store/authStore";
import { CathyLogo } from "@/components/CathyLogo";

// ── Nav items definition ───────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: string;
  section: string;
  children?: { label: string; href: string }[];
}

const NAV: NavItem[] = [
  {
    label: "Tableau de bord",
    href: "/app",
    icon: "⊞",
    section: "dashboard",
  },
  {
    label: "Biens",
    href: "/app/biens",
    icon: "🏠",
    section: "biens",
    children: [
      { label: "Tous les biens", href: "/app/biens" },
    ],
  },
  {
    label: "Finances",
    href: "/app/finances",
    icon: "💶",
    section: "finances",
  },
  {
    label: "Interventions",
    href: "/app/interventions",
    icon: "🔧",
    section: "interventions",
  },
  {
    label: "CRM",
    href: "/app/crm",
    icon: "👥",
    section: "crm",
  },
  {
    label: "Ouvreurs",
    href: "/app/ouvreurs",
    icon: "📍",
    section: "ouvreurs",
    children: [
      { label: "Missions",    href: "/app/ouvreurs/missions" },
      { label: "Revenus",     href: "/app/ouvreurs/revenus" },
      { label: "Historique",  href: "/app/ouvreurs/historique" },
    ],
  },
  {
    label: "Artisans",
    href: "/app/artisans",
    icon: "🏗️",
    section: "artisans",
    children: [
      { label: "Chantiers",   href: "/app/artisans/chantiers" },
      { label: "Devis",       href: "/app/artisans/devis" },
      { label: "Paiements",   href: "/app/artisans/paiements" },
      { label: "Historique",  href: "/app/artisans/historique" },
    ],
  },
  {
    label: "Publications",
    href: "/app/publications/new",
    icon: "📢",
    section: "publications",
  },
  {
    label: "Althy IA",
    href: "/app/advisor",
    icon: "✦",
    section: "althy",
  },
  {
    label: "Paramètres",
    href: "/app/settings",
    icon: "⚙️",
    section: "settings",
    children: [
      { label: "Zone",          href: "/app/settings/zone" },
      { label: "Préférences",   href: "/app/settings/preferences" },
      { label: "Paiement",      href: "/app/settings/paiement" },
      { label: "Notifications", href: "/app/settings/notifs" },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardSidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { signOut } = useAuth();
  const { user }    = useAuthStore();
  const { role, label: roleLabel, can } = useRole();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = NAV.filter(item => can(item.section));

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  const toggle = (href: string) =>
    setOpen(prev => ({ ...prev, [href]: !prev[href] }));

  async function handleLogout() {
    try { await signOut(); } catch { /* ignore */ }
    router.push("/login");
  }

  const w = collapsed ? 64 : 240;

  return (
    <aside
      style={{
        width: w, minWidth: w, maxWidth: w,
        height: "100vh", position: "sticky", top: 0,
        background: "#FFFCF7",
        borderRight: "0.5px solid rgba(212,96,26,0.15)",
        display: "flex", flexDirection: "column",
        transition: "width 0.2s ease",
        overflow: "hidden",
        zIndex: 40,
        flexShrink: 0,
      }}
    >
      {/* ── Brand ── */}
      <div style={{
        padding: collapsed ? "16px 12px" : "20px 20px 16px",
        display: "flex", alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        borderBottom: "0.5px solid rgba(212,96,26,0.10)",
        minHeight: 60,
      }}>
        {!collapsed && (
          <Link href="/app" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <CathyLogo size={26} />
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 300, color: "#D4601A", letterSpacing: "3px" }}>
              Althy
            </span>
          </Link>
        )}
        {collapsed && <CathyLogo size={26} />}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            padding: "4px", borderRadius: 6, border: "none",
            background: "transparent", cursor: "pointer",
            color: "rgba(80,35,8,0.35)", fontSize: 12,
            marginLeft: collapsed ? 0 : 4,
          }}
          title={collapsed ? "Étendre" : "Réduire"}
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      {/* ── Role badge ── */}
      {!collapsed && roleLabel && (
        <div style={{ padding: "8px 20px" }}>
          <span style={{
            fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase",
            color: "#D4601A", background: "rgba(212,96,26,0.08)",
            padding: "3px 10px", borderRadius: 20,
            border: "0.5px solid rgba(212,96,26,0.2)",
          }}>
            {roleLabel}
          </span>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {visibleItems.map(item => {
          const active = isActive(item.href);
          const hasChildren = item.children && item.children.length > 0;
          const expanded = open[item.href] ?? active;

          return (
            <div key={item.href}>
              <button
                onClick={() => {
                  if (hasChildren && !collapsed) {
                    toggle(item.href);
                  } else {
                    router.push(item.href);
                  }
                }}
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  gap: 10, padding: collapsed ? "10px 0" : "9px 20px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  background: active
                    ? "rgba(212,96,26,0.08)"
                    : "transparent",
                  border: "none", borderLeft: active ? "2.5px solid #D4601A" : "2.5px solid transparent",
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "background 0.15s",
                }}
                title={collapsed ? item.label : undefined}
              >
                <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
                {!collapsed && (
                  <>
                    <span style={{
                      flex: 1, fontSize: 13, textAlign: "left",
                      color: active ? "#D4601A" : "rgba(80,35,8,0.65)",
                      fontWeight: active ? 500 : 400,
                    }}>
                      {item.label}
                    </span>
                    {hasChildren && (
                      <span style={{ fontSize: 9, color: "rgba(80,35,8,0.3)" }}>
                        {expanded ? "▲" : "▼"}
                      </span>
                    )}
                  </>
                )}
              </button>

              {/* Sub-items */}
              {!collapsed && hasChildren && expanded && (
                <div style={{ marginLeft: 20, borderLeft: "0.5px solid rgba(212,96,26,0.15)", marginBottom: 4 }}>
                  {item.children!.map(child => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        style={{
                          display: "block", padding: "7px 16px",
                          fontSize: 12,
                          color: childActive ? "#D4601A" : "rgba(80,35,8,0.5)",
                          fontWeight: childActive ? 500 : 400,
                          textDecoration: "none",
                          background: childActive ? "rgba(212,96,26,0.05)" : "transparent",
                        }}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── User footer ── */}
      <div style={{
        padding: collapsed ? "12px 0" : "14px 20px",
        borderTop: "0.5px solid rgba(212,96,26,0.10)",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {!collapsed && user && (
          <div style={{ fontSize: 11, color: "rgba(80,35,8,0.45)", wordBreak: "break-all", lineHeight: 1.4 }}>
            {user.email}
          </div>
        )}
        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? "6px 0" : "0",
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, color: "rgba(80,35,8,0.4)", fontFamily: "inherit",
          }}
          title="Déconnexion"
        >
          <span style={{ fontSize: 14 }}>⇤</span>
          {!collapsed && "Déconnexion"}
        </button>
      </div>
    </aside>
  );
}
