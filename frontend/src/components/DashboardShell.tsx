"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Menu, X } from "lucide-react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { AlthyLogo } from "@/components/AlthyLogo";
import { UserMenu } from "@/components/header/UserMenu";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="althy-layout">

      {/* ── Mobile top bar ─────────────────────────────────────── */}
      <header className="althy-topbar">
        <Link href="/app" className="althy-topbar-brand">
          <AlthyLogo variant="full" size={24} />
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

      {/* ── Right column : global header + main content ────────── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Global desktop header — bell + UserMenu dropdown (Sprint 9 Lot C) */}
        <header className="althy-desktop-header">
          <div style={{ flex: 1 }} />
          <button
            type="button"
            aria-label="Notifications"
            style={{
              position: "relative",
              padding: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Bell size={18} strokeWidth={1.5} style={{ color: "var(--text-secondary, var(--althy-text-2))" }} />
            <span
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--althy-prussian)",
                border: "2px solid #fff",
              }}
            />
          </button>
          <div
            style={{
              width: 1,
              height: 24,
              background: "var(--border-subtle, var(--althy-border))",
              margin: "0 8px",
            }}
          />
          <UserMenu />
        </header>

        <main className="althy-main">
          {children}
        </main>
      </div>
    </div>
  );
}
