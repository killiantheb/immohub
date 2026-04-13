// src/app/app/(dashboard)/communication/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, MessageCircle, CalendarDays } from "lucide-react";
import { api } from "@/lib/api";
import { DTopNav } from "@/components/dashboards/DashBoardShared";
import { MessagerieContent } from "@/components/communication/MessagerieContent";
import { WhatsAppContent }   from "@/components/communication/WhatsAppContent";
import { AgendaContent }     from "@/components/communication/AgendaContent";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = "messages" | "whatsapp" | "agenda";

interface TabDef {
  key:   TabKey;
  label: string;
  icon:  React.ElementType;
}

const TABS: TabDef[] = [
  { key: "messages", label: "Messages",  icon: Mail },
  { key: "whatsapp", label: "WhatsApp",  icon: MessageCircle },
  { key: "agenda",   label: "Agenda",    icon: CalendarDays },
];

// ── Inner component (uses useSearchParams — must be inside Suspense) ───────────

function CommunicationInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const rawTab   = searchParams.get("tab") ?? "messages";
  const activeTab: TabKey = (["messages", "whatsapp", "agenda"] as TabKey[]).includes(rawTab as TabKey)
    ? (rawTab as TabKey)
    : "messages";

  // Badge counts
  const [msgCount, setMsgCount] = useState(0);
  const [waCount,  setWaCount]  = useState(0);

  useEffect(() => {
    const load = async () => {
      const [msg, wa] = await Promise.all([
        api.get<{ count: number }>("/messagerie/non-lus").catch(() => ({ data: { count: 0 } })),
        api.get<{ count: number }>("/whatsapp/non-lus").catch(() =>   ({ data: { count: 0 } })),
      ]);
      setMsgCount(msg.data.count ?? 0);
      setWaCount(wa.data.count  ?? 0);
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
    whatsapp: waCount,
    agenda:   0,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--althy-bg)" }}>
      <DTopNav />

      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "Cormorant Garamond, var(--font-serif), serif", fontSize: 28, fontWeight: 300, color: "var(--althy-text)", margin: "0 0 4px" }}>
          Communication
        </h1>
        <p style={{ fontSize: 13, color: "var(--althy-text-3)", margin: 0 }}>
          Messages, WhatsApp et agenda réunis en un seul espace
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", gap: 4,
        borderBottom: "1px solid var(--althy-border)",
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
                background:  active ? "var(--althy-orange-bg, rgba(232,96,44,0.08))" : "transparent",
                color:       active ? "var(--althy-orange)" : "var(--althy-text-3)",
                border:      "none",
                borderBottom: active ? "2px solid var(--althy-orange)" : "2px solid transparent",
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
                  background: "var(--althy-orange)",
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
      {activeTab === "whatsapp" && <WhatsAppContent />}
      {activeTab === "agenda"   && <AgendaContent />}
    </div>
  );
}

// ── Page export (wraps inner in Suspense for useSearchParams) ─────────────────

export default function CommunicationPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
        <div style={{ fontSize: 13, color: "var(--althy-text-3)" }}>Chargement…</div>
      </div>
    }>
      <CommunicationInner />
    </Suspense>
  );
}
