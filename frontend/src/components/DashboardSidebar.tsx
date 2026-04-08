"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/lib/hooks/useRole";
import { useAuth } from "@/lib/auth";
import { useAuthStore } from "@/lib/store/authStore";
import {
  LayoutGrid,
  Building2,
  LineChart,
  Wrench,
  Users2,
  Navigation2,
  HardHat,
  SendHorizonal,
  Sparkles,
  SlidersHorizontal,
  LogOut,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

// ── Nav items ─────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  section: string;
  children?: { label: string; href: string }[];
}

const ICON = { size: 15, strokeWidth: 1.5 };

const NAV: NavItem[] = [
  { label: "Tableau de bord", href: "/app",             icon: <LayoutGrid {...ICON} />,       section: "dashboard" },
  { label: "Biens",           href: "/app/biens",       icon: <Building2 {...ICON} />,        section: "biens",
    children: [{ label: "Tous les biens", href: "/app/biens" }] },
  { label: "Finances",        href: "/app/finances",    icon: <LineChart {...ICON} />,         section: "finances" },
  { label: "Interventions",   href: "/app/interventions",icon: <Wrench {...ICON} />,           section: "interventions" },
  { label: "CRM",             href: "/app/crm",         icon: <Users2 {...ICON} />,            section: "crm" },
  { label: "Ouvreurs",        href: "/app/ouvreurs",    icon: <Navigation2 {...ICON} />,       section: "ouvreurs",
    children: [
      { label: "Missions",   href: "/app/ouvreurs/missions" },
      { label: "Revenus",    href: "/app/ouvreurs/revenus" },
      { label: "Historique", href: "/app/ouvreurs/historique" },
    ]},
  { label: "Artisans",        href: "/app/artisans",    icon: <HardHat {...ICON} />,           section: "artisans",
    children: [
      { label: "Chantiers",  href: "/app/artisans/chantiers" },
      { label: "Devis",      href: "/app/artisans/devis" },
      { label: "Paiements",  href: "/app/artisans/paiements" },
      { label: "Historique", href: "/app/artisans/historique" },
    ]},
  { label: "Publications",    href: "/app/publications/new", icon: <SendHorizonal {...ICON} />, section: "publications" },
  { label: "Althy IA",        href: "/app/advisor",     icon: <Sparkles {...ICON} />,          section: "althy" },
  { label: "Paramètres",      href: "/app/settings",    icon: <SlidersHorizontal {...ICON} />, section: "settings",
    children: [
      { label: "Zone",           href: "/app/settings/zone" },
      { label: "Préférences",    href: "/app/settings/preferences" },
      { label: "Paiement",       href: "/app/settings/paiement" },
      { label: "Notifications",  href: "/app/settings/notifs" },
    ]},
];

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  sidebar: (w: number): React.CSSProperties => ({
    width: w, minWidth: w, maxWidth: w,
    height: "100vh", position: "sticky", top: 0,
    background: "var(--sidebar-bg)",
    borderRight: "1px solid var(--sidebar-border)",
    display: "flex", flexDirection: "column",
    transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
    overflow: "hidden",
    zIndex: 40,
    flexShrink: 0,
  }),

  brand: (collapsed: boolean): React.CSSProperties => ({
    padding: collapsed ? "18px 0" : "22px 20px 18px",
    display: "flex", alignItems: "center",
    justifyContent: collapsed ? "center" : "space-between",
    borderBottom: "1px solid var(--sidebar-border)",
    minHeight: 64,
    gap: 10,
  }),

  wordmark: {
    fontFamily: "var(--font-serif), 'Cormorant Garamond', serif",
    fontSize: 20,
    fontWeight: 300,
    color: "var(--sidebar-gold)",
    letterSpacing: "4px",
    textDecoration: "none",
    lineHeight: 1,
  } as React.CSSProperties,

  collapseBtn: {
    padding: 6, borderRadius: 6, border: "none",
    background: "transparent", cursor: "pointer",
    color: "rgba(224,212,196,0.30)",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    transition: "color 0.15s",
  } as React.CSSProperties,

  roleBadge: {
    fontSize: 9, letterSpacing: "1.8px", textTransform: "uppercase" as const,
    color: "var(--sidebar-gold)",
    padding: "3px 10px",
    border: "0.5px solid rgba(196,168,122,0.25)",
    borderRadius: 2,
    display: "inline-block",
  },

  navItem: (active: boolean, collapsed: boolean): React.CSSProperties => ({
    width: "100%", display: "flex", alignItems: "center",
    gap: 10, padding: collapsed ? "11px 0" : "9px 20px",
    justifyContent: collapsed ? "center" : "flex-start",
    background: active ? "var(--sidebar-active)" : "transparent",
    border: "none",
    borderLeft: active ? "2px solid var(--sidebar-gold)" : "2px solid transparent",
    cursor: "pointer", fontFamily: "var(--font-sans), inherit",
    transition: "background 0.15s, color 0.15s",
  }),

  navLabel: (active: boolean): React.CSSProperties => ({
    flex: 1, fontSize: 12.5, textAlign: "left",
    color: active ? "var(--sidebar-text-on)" : "var(--sidebar-text)",
    fontWeight: active ? 500 : 400,
    letterSpacing: "0.01em",
  }),

  navIcon: (active: boolean): React.CSSProperties => ({
    color: active ? "var(--sidebar-gold)" : "rgba(224,212,196,0.45)",
    flexShrink: 0,
    transition: "color 0.15s",
  }),

  chevron: (active: boolean): React.CSSProperties => ({
    color: active ? "rgba(196,168,122,0.6)" : "rgba(224,212,196,0.20)",
    flexShrink: 0,
  }),

  subItem: (active: boolean): React.CSSProperties => ({
    display: "block", padding: "6px 20px 6px 14px",
    fontSize: 12,
    color: active ? "var(--sidebar-gold)" : "rgba(224,212,196,0.45)",
    fontWeight: active ? 500 : 400,
    textDecoration: "none",
    letterSpacing: "0.01em",
    transition: "color 0.15s",
  }),

  footer: (collapsed: boolean): React.CSSProperties => ({
    padding: collapsed ? "14px 0" : "14px 20px",
    borderTop: "1px solid var(--sidebar-border)",
    display: "flex", flexDirection: "column", gap: 6,
  }),

  email: {
    fontSize: 10.5, color: "rgba(224,212,196,0.28)",
    wordBreak: "break-all" as const, lineHeight: 1.4,
    letterSpacing: "0.01em",
  } as React.CSSProperties,

  logoutBtn: (collapsed: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 8,
    justifyContent: collapsed ? "center" : "flex-start",
    background: "none", border: "none", cursor: "pointer",
    fontSize: 12, color: "rgba(224,212,196,0.28)",
    fontFamily: "var(--font-sans), inherit",
    padding: collapsed ? "4px 0" : 0,
    transition: "color 0.15s",
    letterSpacing: "0.01em",
  }),
};

// ── Logo mark (monogram) ──────────────────────────────────────────────────────

function AlthyMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="1" y="1" width="20" height="20" rx="4" stroke="#C4A87A" strokeWidth="1"/>
      <text
        x="11" y="15.5"
        textAnchor="middle"
        fontFamily="var(--font-serif),'Cormorant Garamond',serif"
        fontSize="13"
        fontWeight="300"
        fill="#C4A87A"
        letterSpacing="1"
      >
        A
      </text>
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardSidebar() {
  const pathname   = usePathname();
  const router     = useRouter();
  const { signOut } = useAuth();
  const { user }   = useAuthStore();
  const { label: roleLabel, can } = useRole();

  const [open, setOpen]         = useState<Record<string, boolean>>({});
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

  const w = collapsed ? 58 : 228;

  return (
    <aside style={S.sidebar(w)}>

      {/* ── Brand ── */}
      <div style={S.brand(collapsed)}>
        {!collapsed ? (
          <Link href="/app" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <AlthyMark />
            <span style={S.wordmark}>Althy</span>
          </Link>
        ) : (
          <AlthyMark />
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={S.collapseBtn}
          title={collapsed ? "Étendre" : "Réduire"}
        >
          {collapsed
            ? <PanelLeftOpen size={14} strokeWidth={1.5} />
            : <PanelLeftClose size={14} strokeWidth={1.5} />}
        </button>
      </div>

      {/* ── Role badge ── */}
      {!collapsed && roleLabel && (
        <div style={{ padding: "10px 20px" }}>
          <span style={S.roleBadge}>{roleLabel}</span>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav
        className="sidebar-scroll"
        style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}
      >
        {visibleItems.map(item => {
          const active      = isActive(item.href);
          const hasChildren = !!item.children?.length;
          const expanded    = open[item.href] ?? active;

          return (
            <div key={item.href}>
              <button
                onClick={() => {
                  if (hasChildren && !collapsed) toggle(item.href);
                  else router.push(item.href);
                }}
                style={S.navItem(active, collapsed)}
                title={collapsed ? item.label : undefined}
              >
                <span style={S.navIcon(active)}>{item.icon}</span>
                {!collapsed && (
                  <>
                    <span style={S.navLabel(active)}>{item.label}</span>
                    {hasChildren && (
                      <ChevronDown
                        size={11}
                        strokeWidth={1.5}
                        style={{
                          ...S.chevron(active),
                          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.18s",
                        }}
                      />
                    )}
                  </>
                )}
              </button>

              {/* Sub-items */}
              {!collapsed && hasChildren && expanded && (
                <div style={{
                  marginLeft: 32,
                  borderLeft: "1px solid rgba(196,168,122,0.12)",
                  marginBottom: 2,
                  paddingLeft: 0,
                }}>
                  {item.children!.map(child => {
                    const ca = pathname === child.href || pathname.startsWith(child.href + "/");
                    return (
                      <Link key={child.href} href={child.href} style={S.subItem(ca)}>
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

      {/* ── Séparateur Althy IA ── */}
      {!collapsed && (
        <div style={{
          margin: "0 20px 10px",
          height: "1px",
          background: "var(--sidebar-border)",
        }} />
      )}

      {/* ── Footer ── */}
      <div style={S.footer(collapsed)}>
        {!collapsed && user?.email && (
          <div style={S.email}>{user.email}</div>
        )}
        <button
          onClick={handleLogout}
          style={S.logoutBtn(collapsed)}
          title="Déconnexion"
        >
          <LogOut size={13} strokeWidth={1.5} style={{ color: "rgba(224,212,196,0.28)" }} />
          {!collapsed && "Déconnexion"}
        </button>
      </div>
    </aside>
  );
}
