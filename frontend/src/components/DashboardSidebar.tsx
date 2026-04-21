"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/lib/hooks/useRole";
import { useAuth, useUser } from "@/lib/auth";
import { isSectionEnabled } from "@/lib/flags";
import { useAuthStore } from "@/lib/store/authStore";
import { api } from "@/lib/api";
import { AlthyLogo } from "@/components/AlthyLogo";
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
  Wrench,
  FileCheck,
  Users,
  Compass,
  Map,
} from "lucide-react";

// ── Nav items ─────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  section: string;
  badge?: "gold";
}

interface NavSet {
  main: NavItem[];
  bottom: NavItem[];
}

const ICON = { size: 15, strokeWidth: 1.5 };

function buildNavSet(role: string | null, planId: string | null): NavSet {
  const ic = (I: React.ElementType) => <I {...ICON} />;

  // Atomes partagés
  const althy:         NavItem = { label: "Althy IA",          href: "/app/sphere",         icon: ic(Sparkles),          section: "sphere" };
  const biens:         NavItem = { label: "Biens",              href: "/app/biens",           icon: ic(Building2),         section: "biens" };
  const carte:         NavItem = { label: "Carte",              href: "/app/carte",           icon: ic(Map),               section: "carte" };
  const finances:      NavItem = { label: "Finances",           href: "/app/finances",        icon: ic(LineChart),         section: "finances" };
  const documents:     NavItem = { label: "Documents",          href: "/app/documents",       icon: ic(FileText),          section: "documents" };
  const communication: NavItem = { label: "Communication",      href: "/app/communication",   icon: ic(Mail),              section: "communication" };
  const missions:      NavItem = { label: "Missions",           href: "/app/artisans",        icon: ic(HardHat),           section: "artisans" };
  const interventions: NavItem = { label: "Interventions",      href: "/app/interventions",   icon: ic(Wrench),            section: "interventions" };
  const candidatures:  NavItem = { label: "Candidatures",       href: "/app/candidatures",    icon: ic(Users),             section: "candidatures" };
  const mesCandid:     NavItem = { label: "Mes candidatures",   href: "/app/mes-candidatures",icon: ic(FileCheck),         section: "mes_candidatures" };
  const portail:       NavItem = { label: "Portail proprios",   href: "/app/portail",         icon: ic(Users2),            section: "portail" };
  const profile:       NavItem = { label: "Mon profil",         href: "/app/profil",          icon: ic(User),              section: "profile" };
  const settings:      NavItem = { label: "Paramètres",         href: "/app/settings",        icon: ic(SlidersHorizontal), section: "settings" };

  // Althy Autonomie — entrée dédiée selon le plan de l'utilisateur
  const autonomieActive: NavItem = {
    label: "Althy Autonomie",
    href: "/app/autonomie",
    icon: ic(Compass),
    section: "autonomie",
  };
  const autonomieInvite: NavItem = {
    label: "Passer en autonomie",
    href: "/app/autonomie",
    icon: ic(Compass),
    section: "autonomie",
    badge: "gold",
  };
  const autonomieItem: NavItem | null =
    planId === "autonomie" ? autonomieActive
    : planId === "invite"  ? autonomieInvite
    : null;

  switch (role) {
    case "proprio_solo":
      return {
        main: [
          althy,
          biens,
          carte,
          candidatures,
          interventions,
          finances,
          documents,
          communication,
          ...(autonomieItem ? [autonomieItem] : []),
        ],
        bottom: [profile, settings],
      };

    case "locataire":
      return {
        main:   [althy, { ...biens, label: "Mon logement" }, mesCandid, { ...documents, label: "Mes documents" }],
        bottom: [profile],
      };

    case "artisan":
      return {
        main:   [althy, missions, interventions, { ...finances, label: "Mes revenus" }, communication],
        bottom: [profile],
      };

    case "agence":
      return {
        main:   [althy, biens, carte, candidatures, interventions, finances, documents, communication, portail],
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
          althy, biens, carte, candidatures, interventions, finances, documents, communication, portail,
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
    background: "var(--althy-surface)",
    borderRight: "1px solid var(--border-subtle)",
    display: "flex", flexDirection: "column",
    padding: "0",
    transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
    overflow: "hidden",
    zIndex: 40,
    flexShrink: 0,
  }),

  brand: (collapsed: boolean): React.CSSProperties => ({
    padding: collapsed ? "40px 0 20px" : "40px 24px 20px",
    display: "flex", alignItems: "center",
    justifyContent: collapsed ? "center" : "space-between",
    gap: 12,
  }),

  collapseBtn: {
    padding: 6, borderRadius: 8, border: "none",
    background: "transparent", cursor: "pointer",
    color: "var(--text-tertiary)",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    transition: "color 0.15s",
  } as React.CSSProperties,

  navItem: (active: boolean, collapsed: boolean): React.CSSProperties => ({
    width: "100%", display: "flex", alignItems: "center",
    gap: 12, padding: collapsed ? "8px 0" : "10px 16px",
    justifyContent: collapsed ? "center" : "flex-start",
    background: active ? "var(--terracotta-ghost)" : "transparent",
    border: "none",
    cursor: "pointer", fontFamily: "var(--font-sans), inherit",
    borderRadius: 16,
    transition: "background 0.15s",
  }),

  navLabel: (active: boolean): React.CSSProperties => ({
    flex: 1, fontSize: 14, textAlign: "left",
    color: active ? "var(--terracotta-primary)" : "var(--text-secondary)",
    fontWeight: 500,
  }),

  navIconWrap: (active: boolean): React.CSSProperties => ({
    width: 40, height: 40, borderRadius: 12,
    background: active ? "var(--althy-surface)" : "transparent",
    boxShadow: active ? "0 1px 3px rgba(43,43,43,0.08)" : "none",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    color: active ? "var(--terracotta-primary)" : "var(--text-tertiary)",
    transition: "background 0.15s, color 0.15s",
  }),

  footer: (collapsed: boolean): React.CSSProperties => ({
    padding: collapsed ? "16px 0" : "16px 24px",
    borderTop: "1px solid var(--border-subtle)",
    display: "flex", flexDirection: "column", gap: 8,
  }),

  email: {
    fontSize: 12, color: "var(--text-tertiary)",
    wordBreak: "break-all" as const, lineHeight: 1.4,
  } as React.CSSProperties,

  logoutBtn: (collapsed: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 8,
    justifyContent: collapsed ? "center" : "flex-start",
    background: "none", border: "none", cursor: "pointer",
    fontSize: 13, color: "var(--text-tertiary)",
    fontFamily: "var(--font-sans), inherit",
    padding: collapsed ? "4px 0" : 0,
    transition: "color 0.15s",
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
  const { data: profile } = useUser();
  const planId = profile?.plan_id ?? null;

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

  const { main: rawMain, bottom: rawBottom } = buildNavSet(role, planId);
  const navMain   = rawMain.filter(item => isSectionEnabled(item.section));
  const navBottom = rawBottom.filter(item => isSectionEnabled(item.section));

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

  const w = collapsed ? 72 : 288;

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
                background: "var(--althy-orange)", color: "#fff",
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
                background: "var(--althy-orange)",
                flexShrink: 0,
                boxShadow: "0 0 0 2px rgba(15,46,76,0.25), 0 0 0 4px rgba(15,46,76,0.10)",
                animation: "sidebar-pulse 2s ease-in-out infinite",
              }} />
            )}

            {/* Badge or "NEW" pour CTA Autonomie côté compte invité */}
            {item.badge === "gold" && (
              <span style={{
                marginLeft: "auto", padding: "2px 8px",
                borderRadius: 999,
                background: "var(--althy-gold)",
                color: "var(--althy-prussian)",
                fontSize: 9, fontWeight: 800, letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}>
                Nouveau
              </span>
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
          <Link href="/app" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <AlthyLogo variant="full" size={32} />
          </Link>
        ) : (
          <AlthyLogo variant="mark" size={40} />
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

      {/* ── Navigation principale (scrollable) ── */}
      <nav
        className="sidebar-scroll"
        style={{ flex: 1, overflowY: "auto", padding: collapsed ? "8px 0" : "8px 16px", display: "flex", flexDirection: "column", gap: 4 }}
      >
        {navMain.map(item => renderNavItem(item))}
      </nav>

      {/* ── Navigation bas (profil, paramètres) ── */}
      {navBottom.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: collapsed ? "8px 0" : "8px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
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
