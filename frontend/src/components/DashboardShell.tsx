"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { SphereWidget } from "@/components/SphereWidget";
import { AlthySphere } from "@/components/AlthySphere";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="althy-layout">

      {/* ── Mobile top bar ─────────────────────────────────────── */}
      <header className="althy-topbar">
        <Link href="/app" className="althy-topbar-brand">
          <AlthySphere size={26} />
          <span>Althy</span>
        </Link>
        <button
          className="althy-topbar-menu"
          onClick={() => setMobileOpen(v => !v)}
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* ── Backdrop mobile ────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="althy-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <DashboardSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* ── Main ───────────────────────────────────────────────── */}
      <main className="althy-main">
        {children}
      </main>

      <SphereWidget />
    </div>
  );
}
