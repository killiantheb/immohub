// src/app/app/(dashboard)/communication/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { api } from "@/lib/api";
import { DTopNav } from "@/components/dashboards/DashBoardShared";
import { MessagerieContent } from "@/components/communication/MessagerieContent";
// Phase 1 : WhatsApp + Agenda masqués (WhatsApp Business API + OAuth Google/Microsoft non opérationnels).
// Code conservé pour réactivation future.
// import { WhatsAppContent } from "@/components/communication/WhatsAppContent";
// import { AgendaContent }   from "@/components/communication/AgendaContent";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = "messages";

interface TabDef {
  key:   TabKey;
  label: string;
  icon:  React.ElementType;
}

const TABS: TabDef[] = [
  { key: "messages", label: "Messages",  icon: Mail },
];

// ── Inner component (uses useSearchParams — must be inside Suspense) ───────────

function CommunicationInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const rawTab   = searchParams.get("tab") ?? "messages";
  // Phase 1 : seul l'onglet "messages" est actif. Toute autre valeur retombe dessus.
  const activeTab: TabKey = "messages";
  void rawTab;

  // Badge counts
  const [msgCount, setMsgCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const msg = await api
        .get<{ count: number }>("/messagerie/non-lus")
        .catch(() => ({ data: { count: 0 } }));
      setMsgCount(msg.data.count ?? 0);
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  function navigate(tab: TabKey) {
    router.push(`/app/communication?tab=${tab}`, { scroll: false });
  }

  const badgeCounts: Record<TabKey, number> = {
    messages: msgCount,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
      <DTopNav />

      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 300, color: "var(--charcoal)", margin: "0 0 4px" }}>
          Communication
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
          Vos échanges avec locataires et candidats, en un seul espace
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4,
        borderBottom: "1px solid var(--border-subtle)",
        marginBottom: 28,
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          const count  = badgeCounts[tab.key];
          const Icon   = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.key)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 18px",
                background:  active ? "var(--althy-orange-bg, rgba(15,46,76,0.08))" : "transparent",
                color:       active ? "var(--terracotta-primary)" : "var(--text-tertiary)",
                border:      "none",
                borderBottom: active ? "2px solid var(--terracotta-primary)" : "2px solid transparent",
                borderRadius: "6px 6px 0 0",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                transition: "color 0.15s, background 0.15s",
                marginBottom: -1, // overlap the border-bottom
              }}
            >
              <Icon size={15} />
              {tab.label}
              {count > 0 && (
                <span style={{
                  minWidth: 17, height: 17, borderRadius: 9,
                  background: "var(--terracotta-primary)",
                  color: "#fff",
                  fontSize: 9, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 4px",
                }}>
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "messages" && <MessagerieContent />}
    </div>
  );
}

// ── Page export (wraps inner in Suspense for useSearchParams) ─────────────────

export default function CommunicationPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Chargement…</div>
      </div>
    }>
      <CommunicationInner />
    </Suspense>
  );
}
