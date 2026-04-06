"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AICopilot } from "@/components/AICopilot";
import { CathyLogo } from "@/components/CathyLogo";
import {
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Users,
  Handshake,
  ArrowLeftRight,
  UserCircle,
  ClipboardList,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "Principal",
    items: [
      { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/properties", label: "Biens", icon: Building2 },
      { href: "/contracts", label: "Contrats", icon: FileText },
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { href: "/rfqs", label: "Appels d'offres", icon: ClipboardList },
      { href: "/openers", label: "Missions ouvreur", icon: Handshake },
      { href: "/companies", label: "Sociétés", icon: Users },
    ],
  },
  {
    label: "Profil",
    items: [
      { href: "/openers/profile", label: "Mon profil ouvreur", icon: UserCircle },
    ],
  },
];

const ADMIN_SECTION = {
  label: "Administration",
  items: [
    { href: "/admin", label: "Back-office", icon: ShieldCheck },
    { href: "/admin/users", label: "Utilisateurs", icon: Users },
    { href: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight },
  ],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isSuperAdmin = (user as { user_metadata?: { role?: string } } | null)
    ?.user_metadata?.role === "super_admin";

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      // ignore
    }
    window.location.href = "/login";
  }

  const initials = user?.email?.charAt(0).toUpperCase() ?? "?";
  const displayName = user?.user_metadata?.first_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name ?? ""}`.trim()
    : user?.email ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F3EE]">

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="flex w-60 shrink-0 flex-col bg-[#1C1917] text-white">

        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-5">
          <CathyLogo size={28} />
          <span className="text-lg font-bold tracking-tight text-white">CATHY</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {[...NAV_SECTIONS, ...(isSuperAdmin ? [ADMIN_SECTION] : [])].map((section) => (
            <div key={section.label} className="mb-5">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                          isActive
                            ? "bg-[#E8601C] text-white shadow-sm"
                            : "text-white/60 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-white" : "text-white/40 group-hover:text-white/70"}`} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {isActive && <ChevronRight className="h-3 w-3 opacity-60" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8601C] text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{displayName}</p>
              <p className="truncate text-[10px] text-white/40">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/50 hover:bg-white/8 hover:text-white transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/5 bg-white/60 px-8 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {[...NAV_SECTIONS, ADMIN_SECTION].flatMap(s => s.items).find(i =>
              i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)
            )?.label ?? ""}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
            Connecté
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>

      {/* AI Copilot */}
      <AICopilot />
    </div>
  );
}
