"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/lib/hooks/useRole";
import { useAuth } from "@/lib/auth";
import { useAuthStore } from "@/lib/store/authStore";
import { api } from "@/lib/api";
import {
  LayoutGrid,
  Building2,
  LineChart,
  Wrench,
  Users2,
  Navigation2,
  HardHat,
  Sparkles,
  SlidersHorizontal,
  LogOut,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Megaphone,
  Calculator,
  Target,
  TrendingUp,
  Mail,
  CalendarDays,
  MessageCircle,
  UserPlus,
  User,
  Map,
  FileText,
  CreditCard,
} from "lucide-react";
import { AlthySphere } from "@/components/AlthySphere";

// ── Nav items ─────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  section: string;
  children?: { label: string; href: string }[];
}

const ICON = { size: 15, strokeWidth: 1.5 };

// ── Navigation groupée (scrollable, filtrée par can()) ────────────────────────

const NAV_GROUPS: NavItem[][] = [
  // Groupe 1 — Hub
  [
    { label: "Tableau de bord", href: "/app",        icon: <LayoutGrid {...ICON} />, section: "dashboard" },
    { label: "Carte",           href: "/app/carte",  icon: <Map {...ICON} />,        section: "carte" },
  ],
  // Groupe 2 — Gestion
  [
    { label: "Biens",         href: "/app/biens",         icon: <Building2 {...ICON} />, section: "biens",
      children: [{ label: "Tous les biens", href: "/app/biens" }] },
    { label: "Finances",      href: "/app/finances",      icon: <LineChart {...ICON} />, section: "finances" },
    { label: "Interventions", href: "/app/interventions", icon: <Wrench {...ICON} />,    section: "interventions" },
    { label: "CRM",           href: "/app/crm",           icon: <Users2 {...ICON} />,    section: "crm" },
    { label: "Documents",     href: "/app/documents",     icon: <FileText {...ICON} />,  section: "documents" },
  ],
  // Groupe 3 — Marketplace
  [
    { label: "Artisans", href: "/app/artisans", icon: <HardHat {...ICON} />, section: "artisans",
      children: [
        { label: "Chantiers",  href: "/app/artisans/chantiers" },
        { label: "Devis",      href: "/app/artisans/devis" },
        { label: "Paiements",  href: "/app/artisans/paiements" },
        { label: "Historique", href: "/app/artisans/historique" },
      ]},
    { label: "Ouvreurs", href: "/app/ouvreurs", icon: <Navigation2 {...ICON} />, section: "ouvreurs",
      children: [
        { label: "Missions",   href: "/app/ouvreurs/missions" },
        { label: "Revenus",    href: "/app/ouvreurs/revenus" },
        { label: "Historique", href: "/app/ouvreurs/historique" },
      ]},
    { label: "Hunters",  href: "/app/hunters",  icon: <Target {...ICON} />,    section: "hunters" },
    { label: "Vente",    href: "/app/vente",    icon: <TrendingUp {...ICON} />, section: "vente" },
    { label: "Annonces", href: "/app/listings", icon: <Megaphone {...ICON} />, section: "listings" },
  ],
  // Groupe 4 — Communication
  [
    { label: "Messagerie", href: "/app/messagerie", icon: <Mail {...ICON} />,         section: "messages" },
    { label: "Agenda",     href: "/app/agenda",     icon: <CalendarDays {...ICON} />, section: "agenda" },
    { label: "WhatsApp",   href: "/app/whatsapp",   icon: <MessageCircle {...ICON} />,section: "whatsapp" },
  ],
  // Groupe 5 — Comptabilité & Admin
  [
    { label: "Comptabilité",          href: "/app/comptabilite",       icon: <Calculator {...ICON} />,  section: "comptabilite" },
    { label: "Abonnement",            href: "/app/abonnement",         icon: <CreditCard {...ICON} />,  section: "abonnement" },
    { label: "Accès Propriétaires",   href: "/app/portail",            icon: <Users2 {...ICON} />,      section: "portail" },
    { label: "Intégration clients",   href: "/app/admin/integration",  icon: <UserPlus {...ICON} />,    section: "onboarding" },
  ],
];

// ── Section bas — toujours visible pour tous les rôles ────────────────────────

const NAV_BOTTOM: NavItem[] = [
  { label: "Althy IA",   href: "/app/sphere",   icon: <Sparkles {...ICON} />,         section: "sphere" },
  { label: "Mon profil", href: "/app/profile",  icon: <User {...ICON} />,             section: "profile" },
  { label: "Paramètres", href: "/app/settings", icon: <SlidersHorizontal {...ICON} />, section: "settings" },
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
    gap: 12, padding: collapsed ? "12px 0" : "10px 22px",
    justifyContent: collapsed ? "center" : "flex-start",
    background: active ? "var(--sidebar-active)" : "transparent",
    border: "none",
    borderLeft: active ? "2.5px solid var(--sidebar-gold)" : "2.5px solid transparent",
    cursor: "pointer", fontFamily: "var(--font-sans), inherit",
    transition: "background 0.15s, color 0.15s",
  }),

  navLabel: (active: boolean): React.CSSProperties => ({
    flex: 1, fontSize: 14, textAlign: "left",
    color: active ? "var(--sidebar-text-on)" : "var(--sidebar-text)",
    fontWeight: active ? 500 : 400,
    letterSpacing: "0.01em",
  }),

  navIcon: (active: boolean): React.CSSProperties => ({
    color: active ? "var(--sidebar-gold)" : "#7A6450",
    flexShrink: 0,
    transition: "color 0.15s",
  }),

  chevron: (active: boolean): React.CSSProperties => ({
    color: active ? "var(--sidebar-gold)" : "#A8907C",
    flexShrink: 0,
  }),

  subItem: (active: boolean): React.CSSProperties => ({
    display: "block", padding: "7px 22px 7px 16px",
    fontSize: 13,
    color: active ? "var(--sidebar-gold)" : "#5A4838",
    fontWeight: active ? 500 : 400,
    textDecoration: "none",
    letterSpacing: "0.01em",
    transition: "color 0.15s",
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
  const pathname   = usePathname();
  const router     = useRouter();
  const { signOut } = useAuth();
  const { user }   = useAuthStore();
  const { label: roleLabel, can } = useRole();

  const [open, setOpen]         = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [unreadMsg, setUnreadMsg] = useState(0);
  const [unreadWa,  setUnreadWa]  = useState(0);

  // Poll unread counts every 60s
  useEffect(() => {
    const load = async () => {
      try {
        const [msg, wa] = await Promise.all([
          api.get<{ count: number }>("/messagerie/non-lus").catch(() => ({ data: { count: 0 } })),
          api.get<{ count: number }>("/whatsapp/non-lus").catch(() => ({ data: { count: 0 } })),
        ]);
        setUnreadMsg(msg.data.count ?? 0);
        setUnreadWa(wa.data.count ?? 0);
      } catch { /* ignore */ }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const visibleGroups = NAV_GROUPS.map(g => g.filter(item => can(item.section))).filter(g => g.length > 0);
  const visibleBottom = NAV_BOTTOM.filter(item => can(item.section));

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  const toggle = (href: string) =>
    setOpen(prev => ({ ...prev, [href]: !prev[href] }));

  async function handleLogout() {
    try { await signOut(); } catch { /* ignore */ }
    router.push("/login");
  }

  const w = collapsed ? 62 : 252;

  // Close mobile sidebar on navigation
  function handleNav(href: string) {
    router.push(href);
    onMobileClose?.();
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
            <AlthySphere size={30} />
            <span style={S.wordmark}>Althy</span>
          </Link>
        ) : (
          <AlthySphere size={30} />
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

      {/* ── Navigation groupée (scrollable) ── */}
      <nav
        className="sidebar-scroll"
        style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}
      >
        {visibleGroups.map((group, gi) => (
          <div key={gi}>
            {/* Séparateur entre groupes */}
            {gi > 0 && (
              <div style={{ height: 1, background: "var(--sidebar-border)", margin: "4px 0" }} />
            )}
            {group.map(item => {
              const active      = isActive(item.href);
              const hasChildren = !!item.children?.length;
              const expanded    = open[item.href] ?? active;

              return (
                <div key={item.href}>
                  <button
                    onClick={() => {
                      if (hasChildren && !collapsed) toggle(item.href);
                      else handleNav(item.href);
                    }}
                    style={S.navItem(active, collapsed)}
                    title={collapsed ? item.label : undefined}
                  >
                    <span style={S.navIcon(active)}>{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span style={S.navLabel(active)}>{item.label}</span>
                        {item.section === "messages" && unreadMsg > 0 && (
                          <span style={{ marginLeft: "auto", minWidth: 17, height: 17, borderRadius: 9, background: "var(--althy-orange)", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                            {unreadMsg > 99 ? "99+" : unreadMsg}
                          </span>
                        )}
                        {item.section === "whatsapp" && unreadWa > 0 && (
                          <span style={{ marginLeft: "auto", minWidth: 17, height: 17, borderRadius: 9, background: "#25D366", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                            {unreadWa > 99 ? "99+" : unreadWa}
                          </span>
                        )}
                        {hasChildren && (
                          <ChevronDown
                            size={11}
                            strokeWidth={1.5}
                            style={{
                              ...S.chevron(active),
                              marginLeft: item.section === "messages" || item.section === "whatsapp" ? 0 : "auto",
                              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.18s",
                            }}
                          />
                        )}
                      </>
                    )}
                  </button>

                  {!collapsed && hasChildren && expanded && (
                    <div style={{ marginLeft: 32, borderLeft: "1px solid rgba(196,168,122,0.12)", marginBottom: 2 }}>
                      {item.children!.map(child => {
                        const ca = pathname === child.href || pathname.startsWith(child.href + "/");
                        return (
                          <Link key={child.href} href={child.href} style={S.subItem(ca)} onClick={() => onMobileClose?.()}>
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Section bas — Althy IA / Mon profil / Paramètres ── */}
      <div style={{ borderTop: "1px solid var(--sidebar-border)", padding: "4px 0" }}>
        {visibleBottom.map(item => {
          const active = isActive(item.href);
          return (
            <button
              key={item.href}
              onClick={() => handleNav(item.href)}
              style={S.navItem(active, collapsed)}
              title={collapsed ? item.label : undefined}
            >
              <span style={S.navIcon(active)}>{item.icon}</span>
              {!collapsed && (
                <>
                  <span style={S.navLabel(active)}>{item.label}</span>
                  {/* Point animé orange sur Althy IA */}
                  {item.section === "sphere" && (
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: "var(--althy-orange)",
                      flexShrink: 0,
                      animation: "sidebar-pulse 2s ease-in-out infinite",
                    }} />
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

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
