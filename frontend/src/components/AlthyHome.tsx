"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/auth";
import { useAuthStore } from "@/lib/store/authStore";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CardAction {
  label: string;
  type: "navigate" | "mark_paid" | "accept_mission";
  path?: string;
  id?: string;
}

interface Card {
  id: string;
  type: "urgent" | "success" | "info" | "mission";
  label: string;
  badge: string;
  badgeColor: "red" | "green" | "blue" | "amber";
  title: string;
  subtitle: string;
  primaryAction?: CardAction;
  secondaryAction?: CardAction;
  details?: { val: string; lbl: string }[];
}

interface Briefing {
  status: string;
  cards: Card[];
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const BADGE_STYLES = {
  red:   { bg: "rgba(163,45,45,0.1)",  color: "#A32D2D" },
  green: { bg: "rgba(59,109,17,0.1)",  color: "#3B6D11" },
  blue:  { bg: "rgba(24,95,165,0.1)",  color: "#185FA5" },
  amber: { bg: "rgba(133,79,11,0.1)",  color: "#854F0B" },
};

const CARD_BORDER = {
  urgent:  "#D4601A",
  success: "#3B6D11",
  info:    "#185FA5",
  mission: "#854F0B",
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function AlthyHome() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useUser();

  const { user: supabaseUser } = useAuthStore();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [statusText, setStatusText] = useState("chargement…");
  const [chatInput, setChatInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch briefing from backend
  const fetchBriefing = useCallback(async () => {
    setLoadingBriefing(true);
    try {
      const { data } = await api.get<Briefing>("/sphere/briefing");
      setBriefing(data);
      setStatusText(data.status);
    } catch {
      setStatusText("bonjour — prêt à vous aider");
      setBriefing({ status: "bonjour — prêt à vous aider", cards: [] });
    } finally {
      setLoadingBriefing(false);
    }
  }, []);

  useEffect(() => {
    if (!profileLoading && !!supabaseUser) {
      fetchBriefing();
    }
  }, [profileLoading, supabaseUser, fetchBriefing]);

  // Talking animation
  const talkPhrases = [
    briefing?.status ?? "à votre écoute",
    "j'analyse votre situation…",
    "consultation en cours…",
    "voici ce que je recommande…",
  ];

  function toggleTalk() {
    if (isTalking) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsTalking(false);
      setStatusText(briefing?.status ?? "");
    } else {
      setIsTalking(true);
      let i = 1;
      setStatusText(talkPhrases[1]);
      intervalRef.current = setInterval(() => {
        i = (i % (talkPhrases.length - 1)) + 1;
        setStatusText(talkPhrases[i]);
      }, 2000);
    }
  }

  // Handle card actions
  async function handleAction(action: CardAction) {
    if (action.type === "navigate" && action.path) {
      router.push(action.path);
      return;
    }
    if (!action.id) return;
    setActionLoading(action.id);
    try {
      if (action.type === "mark_paid") {
        await api.post(`/transactions/${action.id}/mark-paid`, {});
        setStatusText("Transaction marquée comme payée ✓");
        setTimeout(() => fetchBriefing(), 1000);
      } else if (action.type === "accept_mission") {
        await api.put(`/missions/${action.id}/accept`, {});
        setStatusText("Mission acceptée ✓");
        setTimeout(() => fetchBriefing(), 1000);
      }
    } catch {
      setStatusText("Une erreur est survenue, réessayez.");
    } finally {
      setActionLoading(null);
    }
  }

  // Chat with AI
  async function sendMessage() {
    const msg = chatInput.trim();
    if (!msg || isThinking) return;
    setChatInput("");
    setIsThinking(true);
    setStatusText("Althy réfléchit…");
    try {
      const { data } = await api.post<{ response: string }>("/sphere/chat", {
        message: msg,
        context: {
          role: profile?.role,
          page: "home",
          briefing_status: briefing?.status,
        },
      });
      const reply = (data.response ?? "").substring(0, 90);
      setStatusText(reply + (reply.length >= 90 ? "…" : ""));
    } catch {
      setStatusText("Désolé, une erreur est survenue.");
    } finally {
      setIsThinking(false);
    }
  }

  const isLoading = profileLoading || loadingBriefing;

  if (isLoading) {
    return (
      <div style={{ background: "#F5EDE0", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #F5A050 0%, #D4601A 45%, #8A3008 100%)", margin: "0 auto 1rem", animation: "breathe 2s ease-in-out infinite", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "serif", fontSize: 18, color: "#fff", letterSpacing: 4 }}>Althy</span>
          </div>
          <p style={{ fontSize: 11, letterSpacing: 2, color: "#A05C28", textTransform: "uppercase" }}>analyse en cours…</p>
        </div>
        <style>{`@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`}</style>
      </div>
    );
  }

  const roleName: Record<string, string> = {
    owner: "Propriétaire", agency: "Agence", super_admin: "Admin",
    opener: "Ouvreur", tenant: "Locataire", company: "Artisan", insurance: "Assureur",
  };

  const homeByRole: Record<string, string> = {
    owner: "/app", agency: "/app", super_admin: "/app",
    opener: "/app/ouvreurs", tenant: "/app/locataire",
    company: "/app/artisans/devis", insurance: "/app/insurance",
  };
  const homePath = homeByRole[profile?.role ?? ""] ?? "/app";

  return (
    <div style={{ background: "#F5EDE0", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "2.5rem 1.2rem 2rem", position: "relative", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Profile tag */}
      <div style={{ position: "absolute", top: 16, left: 16, padding: "5px 12px", borderRadius: 20, background: "rgba(255,255,255,0.7)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#A05C28", backdropFilter: "blur(4px)", border: "0.5px solid rgba(160,92,40,0.2)" }}>
        {roleName[profile?.role ?? ""] ?? profile?.role}
      </div>

      {/* Dashboard button */}
      <button onClick={() => router.push(homePath)} style={{ position: "absolute", top: 16, right: 16, padding: "6px 14px", borderRadius: 20, border: "0.5px solid rgba(160,92,40,0.2)", background: "rgba(255,255,255,0.7)", fontSize: 11, color: "#A05C28", cursor: "pointer", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", gap: 5 }}>
        <svg viewBox="0 0 16 16" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
        Mon espace
      </button>

      {/* Refresh button */}
      <button onClick={fetchBriefing} style={{ position: "absolute", top: 16, right: 118, padding: "6px 12px", borderRadius: 20, border: "0.5px solid rgba(160,92,40,0.2)", background: "rgba(255,255,255,0.7)", fontSize: 11, color: "#A05C28", cursor: "pointer", backdropFilter: "blur(4px)" }}>
        ↻
      </button>

      {/* Bubble */}
      <div style={{ position: "relative", width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.8rem" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid #D4601A", animation: "ripple 3s ease-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid #D4601A", animation: "ripple2 3s ease-out infinite 1.5s" }} />
        <div onClick={toggleTalk} style={{ width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #F5A050 0%, #D4601A 45%, #8A3008 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: isTalking ? "speaking 0.4s ease-in-out infinite" : "breathe 3.5s ease-in-out infinite", cursor: "pointer", zIndex: 2, boxShadow: "0 8px 40px rgba(212,96,26,0.3)" }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 300, color: "#fff", letterSpacing: 4, textTransform: "uppercase" }}>Althy</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>parler</span>
        </div>
      </div>

      {/* Status */}
      <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#A05C28", marginBottom: "1.6rem", minHeight: 16, fontWeight: 300, opacity: 0.8, textAlign: "center", maxWidth: 360 }}>
        {statusText}
      </div>

      {/* Cards */}
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 10, marginBottom: "1.2rem" }}>
        {briefing?.cards.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem 0", color: "#A05C28", fontSize: 13, opacity: 0.6 }}>
            Tout est en ordre — posez une question à Althy ci-dessous
          </div>
        )}
        {briefing?.cards.map((card, idx) => (
          <div key={card.id ?? idx} style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", border: "0.5px solid rgba(160,92,40,0.12)", borderLeft: `3px solid ${CARD_BORDER[card.type]}`, paddingLeft: 14, animation: `fadeUp 0.4s ease ${idx * 0.1}s both` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#A05C28", fontWeight: 500 }}>{card.label}</span>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 500, background: BADGE_STYLES[card.badgeColor].bg, color: BADGE_STYLES[card.badgeColor].color }}>{card.badge}</span>
            </div>
            {card.details && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, margin: "8px 0" }}>
                {card.details.map((d, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 500, color: "#1a1a1a" }}>{d.val}</div>
                    <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>{d.lbl}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a", marginBottom: 4, lineHeight: 1.3 }}>{card.title}</div>
            <div style={{ fontSize: 12, color: "#888", lineHeight: 1.4 }}>{card.subtitle}</div>
            {(card.primaryAction || card.secondaryAction) && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {card.primaryAction && (
                  <button
                    onClick={() => handleAction(card.primaryAction!)}
                    disabled={actionLoading === card.primaryAction.id}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "#D4601A", color: "#fff", fontFamily: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer", opacity: actionLoading === card.primaryAction.id ? 0.6 : 1 }}
                  >
                    {actionLoading === card.primaryAction.id ? "…" : card.primaryAction.label}
                  </button>
                )}
                {card.secondaryAction && (
                  <button
                    onClick={() => handleAction(card.secondaryAction!)}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid rgba(160,92,40,0.25)", background: "transparent", color: "#A05C28", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
                  >
                    {card.secondaryAction.label}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chat input */}
      <div style={{ width: "100%", maxWidth: 420, display: "flex", gap: 8, alignItems: "center", background: "#fff", borderRadius: 24, padding: "8px 8px 8px 16px", border: "0.5px solid rgba(160,92,40,0.2)" }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder={isThinking ? "Althy réfléchit…" : "Demandez quelque chose à Althy…"}
          disabled={isThinking}
          style={{ flex: 1, border: "none", outline: "none", fontFamily: "inherit", fontSize: 13, color: "#1a1a1a", background: "transparent" }}
        />
        <button onClick={sendMessage} disabled={isThinking} style={{ width: 34, height: 34, borderRadius: "50%", background: "#D4601A", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: isThinking ? 0.6 : 1 }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>

      <p style={{ marginTop: 12, fontSize: 10, color: "#C9A882", letterSpacing: 1, textAlign: "center" }}>
        Althy analyse vos données en temps réel
      </p>

      {/* Animations */}
      <style>{`
        @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        @keyframes speaking{0%,100%{transform:scale(1)}25%{transform:scale(1.06)}75%{transform:scale(0.97)}}
        @keyframes ripple{0%{transform:scale(0.9);opacity:0.15}100%{transform:scale(1.65);opacity:0}}
        @keyframes ripple2{0%{transform:scale(0.9);opacity:0.09}100%{transform:scale(1.85);opacity:0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}
