"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/lib/hooks/useRole";
import { useAuth } from "@/lib/auth";
import { useAuthStore } from "@/lib/store/authStore";
import { api } from "@/lib/api";
import {
  Building2,
  LineChart,
  Users2,
  HardHat,
  Sparkles,
  SlidersHorizontal,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Mail,
  User,
  FileText,
  LayoutGrid,
} from "lucide-react";

// ── Nav items ─────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  section: string;
}

interface NavSet {
  main: NavItem[];
  bottom: NavItem[];
}

const ICON = { size: 15, strokeWidth: 1.5 };

function buildNavSet(role: string | null): NavSet {
  const ic = (I: React.ElementType) => <I {...ICON} />;

  // Atomes partagés
  const althy:         NavItem = { label: "Althy IA",          href: "/app/sphere",         icon: ic(Sparkles),          section: "sphere" };
  const biens:         NavItem = { label: "Biens",              href: "/app/biens",           icon: ic(Building2),         section: "biens" };
  const finances:      NavItem = { label: "Finances",           href: "/app/finances",        icon: ic(LineChart),         section: "finances" };
  const documents:     NavItem = { label: "Documents",          href: "/app/documents",       icon: ic(FileText),          section: "documents" };
  const communication: NavItem = { label: "Communication",      href: "/app/communication",   icon: ic(Mail),              section: "communication" };
  const missions:      NavItem = { label: "Missions",           href: "/app/artisans",        icon: ic(HardHat),           section: "artisans" };
  const portail:       NavItem = { label: "Portail proprios",   href: "/app/portail",         icon: ic(Users2),            section: "portail" };
  const profile:       NavItem = { label: "Mon profil",         href: "/app/profile",         icon: ic(User),              section: "profile" };
  const settings:      NavItem = { label: "Paramètres",         href: "/app/settings",        icon: ic(SlidersHorizontal), section: "settings" };

  switch (role) {
    case "proprio_solo":
      return {
        main:   [althy, biens, finances, documents, communication],
        bottom: [profile, settings],
      };

    case "locataire":
      return {
        main:   [althy, { ...biens, label: "Mon logement" }, { ...documents, label: "Mes documents" }],
        bottom: [profile],
      };

    case "artisan":
      return {
        main:   [althy, missions, { ...finances, label: "Mes revenus" }, communication],
        bottom: [profile],
      };

    case "agence":
      return {
        main:   [althy, biens, finances, documents, communication, portail],
        bottom: [profile, settings],
      };

    case "portail_proprio":
      return {
        main:   [
          { ...biens,         label: "Mes biens" },
          { ...documents,     label: "Mes documents" },
          { ...communication, label: "Messagerie agence" },
        ],
        bottom: [profile],
      };

    case "super_admin":
      return {
        main:   [
          althy, biens, finances, documents, communication, portail,
          { label: "Administration", href: "/app/admin", icon: ic(LayoutGrid), section: "admin" },
        ],
        bottom: [profile, settings],
      };

    default:
      // opener, expert, hunter, acheteur_premium
      return {
        main:   [althy, biens, finances, documents, communication],
        bottom: [profile, settings],
      };
  }
}

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
    padding: collapsed ? "20px 0" : "24px 22px 20px",
    display: "flex", alignItems: "center",
    justifyContent: collapsed ? "center" : "space-between",
    borderBottom: "1px solid var(--sidebar-border)",
    minHeight: 72,
    gap: 12,
  }),

  wordmark: {
    fontFamily: "var(--font-serif), 'Cormorant Garamond', serif",
    fontSize: 24,
    fontWeight: 300,
    color: "var(--sidebar-gold)",
    letterSpacing: "5px",
    textDecoration: "none",
    lineHeight: 1,
  } as React.CSSProperties,

  collapseBtn: {
    padding: 6, borderRadius: 6, border: "none",
    background: "transparent", cursor: "pointer",
    color: "#A8907C",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    transition: "color 0.15s",
  } as React.CSSProperties,

  roleBadge: {
    fontSize: 10, letterSpacing: "2px", textTransform: "uppercase" as const,
    color: "var(--sidebar-gold)",
    padding: "4px 12px",
    border: "0.5px solid rgba(232,96,44,0.28)",
    borderRadius: 2,
    display: "inline-block",
  },

  navItem: (active: boolean, collapsed: boolean): React.CSSProperties => ({
    width: "100%", display: "flex", alignItems: "center",
    gap: 10, padding: collapsed ? "8px 0" : "5px 12px",
    justifyContent: collapsed ? "center" : "flex-start",
    background: "transparent",
    border: "none", borderLeft: "none",
    cursor: "pointer", fontFamily: "var(--font-sans), inherit",
    transition: "opacity 0.15s",
    borderRadius: 10,
  }),

  navLabel: (active: boolean): React.CSSProperties => ({
    flex: 1, fontSize: 13, textAlign: "left",
    color: active ? "#E8602C" : "#6E6A65",
    fontWeight: active ? 600 : 400,
  }),

  navIconWrap: (active: boolean): React.CSSProperties => ({
    width: 36, height: 36, borderRadius: 10,
    background: active ? "#FEF0EA" : "transparent",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    color: active ? "#E8602C" : "#A8A29E",
    transition: "background 0.15s, color 0.15s",
  }),

  footer: (collapsed: boolean): React.CSSProperties => ({
    padding: collapsed ? "16px 0" : "16px 22px",
    borderTop: "1px solid var(--sidebar-border)",
    display: "flex", flexDirection: "column", gap: 8,
  }),

  email: {
    fontSize: 11.5, color: "#7A6450",
    wordBreak: "break-all" as const, lineHeight: 1.4,
    letterSpacing: "0.01em",
  } as React.CSSProperties,

  logoutBtn: (collapsed: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 8,
    justifyContent: collapsed ? "center" : "flex-start",
    background: "none", border: "none", cursor: "pointer",
    fontSize: 13, color: "#7A6450",
    fontFamily: "var(--font-sans), inherit",
    padding: collapsed ? "4px 0" : 0,
    transition: "color 0.15s",
    letterSpacing: "0.01em",
  }),
};

// ── Component ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function DashboardSidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname    = usePathname();
  const router      = useRouter();
  const { signOut } = useAuth();
  const { user }    = useAuthStore();
  const { role, label: roleLabel } = useRole();

  const [collapsed, setCollapsed] = useState(false);
  const [unreadMsg, setUnreadMsg] = useState(0);

  // Poll unread count every 60s
  useEffect(() => {
    const load = async () => {
      try {
        const msg = await api.get<{ count: number }>("/messagerie/non-lus").catch(() => ({ data: { count: 0 } }));
        setUnreadMsg(msg.data.count ?? 0);
      } catch { /* ignore */ }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const { main: navMain, bottom: navBottom } = buildNavSet(role);

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  async function handleLogout() {
    try { await signOut(); } catch { /* ignore */ }
    router.push("/login");
  }

  function handleNav(href: string) {
    router.push(href);
    onMobileClose?.();
  }

  const w = collapsed ? 62 : 252;

  function renderNavItem(item: NavItem) {
    const active = isActive(item.href);
    return (
      <button
        key={item.href}
        onClick={() => handleNav(item.href)}
        style={S.navItem(active, collapsed)}
        title={collapsed ? item.label : undefined}
      >
        {/* Icon in square */}
        <span style={S.navIconWrap(active)}>{item.icon}</span>

        {!collapsed && (
          <>
            <span style={S.navLabel(active)}>{item.label}</span>

            {/* Badge non-lus communication */}
            {item.section === "communication" && unreadMsg > 0 && (
              <span style={{
                marginLeft: "auto", minWidth: 17, height: 17, borderRadius: 9,
                background: "#E8602C", color: "#fff",
                fontSize: 9, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px",
              }}>
                {unreadMsg > 99 ? "99+" : unreadMsg}
              </span>
            )}

            {/* Point pulsant sur Althy IA — 7px + glow */}
            {item.section === "sphere" && (
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: "#E8602C",
                flexShrink: 0,
                boxShadow: "0 0 0 2px rgba(232,96,44,0.25), 0 0 0 4px rgba(232,96,44,0.10)",
                animation: "sidebar-pulse 2s ease-in-out infinite",
              }} />
            )}
          </>
        )}
      </button>
    );
  }

  return (
    <aside
      style={S.sidebar(w)}
      className={`althy-sidebar${mobileOpen ? " althy-sidebar--open" : ""}`}
    >
      {/* ── Brand ── */}
      <div style={S.brand(collapsed)}>
        {!collapsed ? (
          <Link href="/app" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#E8602C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: "#fff", fontSize: 17, fontWeight: 800, lineHeight: 1 }}>A</span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#1A1816", letterSpacing: "-0.01em", lineHeight: 1 }}>Althy</span>
          </Link>
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#E8602C", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 17, fontWeight: 800, lineHeight: 1 }}>A</span>
          </div>
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

      {/* ── Navigation principale (scrollable) ── */}
      <nav
        className="sidebar-scroll"
        style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}
      >
        {navMain.map(item => renderNavItem(item))}
      </nav>

      {/* ── Navigation bas (profil, paramètres) ── */}
      {navBottom.length > 0 && (
        <div style={{ borderTop: "1px solid var(--sidebar-border)", padding: "4px 0" }}>
          {navBottom.map(item => renderNavItem(item))}
        </div>
      )}

      {/* ── Footer — email + déconnexion ── */}
      <div style={S.footer(collapsed)}>
        {!collapsed && user?.email && (
          <div style={S.email}>{user.email}</div>
        )}
        <button
          onClick={handleLogout}
          style={S.logoutBtn(collapsed)}
          title="Déconnexion"
        >
          <LogOut size={14} strokeWidth={1.5} style={{ color: "#7A6450" }} />
          {!collapsed && "Déconnexion"}
        </button>
      </div>

      <style>{`
        @keyframes sidebar-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>
    </aside>
  );
}
