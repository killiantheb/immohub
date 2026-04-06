"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/auth";
import type { UserRole } from "@/lib/types";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Card {
  type: "urgent" | "success" | "info" | "mission";
  label: string;
  badge: string;
  badgeColor: "red" | "green" | "blue" | "amber";
  title: string;
  subtitle: string;
  primaryAction?: string;
  secondaryAction?: string;
  details?: { val: string; lbl: string }[];
}

interface RoleConfig {
  profileLabel: string;
  greeting: (name: string) => string;
  chatPlaceholder: string;
  cards: Card[];
  revenueBar?: { label: string; value: string; pct: number };
}

// ── Role Configurations ───────────────────────────────────────────────────────

const CONFIGS: Record<UserRole, RoleConfig> = {
  owner: {
    profileLabel: "Propriétaire",
    greeting: (n) => `bonjour ${n} — 3 choses ce matin`,
    chatPlaceholder: "Ex: quel locataire est en retard ?",
    revenueBar: { label: "Revenus ce mois", value: "6 200 / 7 400 CHF", pct: 84 },
    cards: [
      {
        type: "urgent", label: "Loyer en retard", badge: "3 jours", badgeColor: "red",
        title: "Jean Dupont — Studio Carouge",
        subtitle: "Loyer novembre 1 200 CHF non encaissé. Cathy a envoyé un rappel automatique hier.",
        primaryAction: "Relancer", secondaryAction: "Voir dossier",
      },
      {
        type: "success", label: "Encaissé aujourd'hui", badge: "+2 400 CHF", badgeColor: "green",
        title: "Loyer décembre — Apt. Lausanne",
        subtitle: "Sophie Martin a payé. Quittance générée et envoyée automatiquement.",
      },
      {
        type: "info", label: "Visite demain", badge: "10h00", badgeColor: "blue",
        title: "3 candidats — Rue du Rhône 14",
        subtitle: "Dossiers scorés: 82/100, 71/100, 58/100.",
        primaryAction: "Voir les dossiers", secondaryAction: "Contacter l'ouvreur",
      },
    ],
  },
  agency: {
    profileLabel: "Agence",
    greeting: (n) => `bonjour ${n} — 14 biens actifs`,
    chatPlaceholder: "Ex: quels biens sont disponibles en janvier ?",
    cards: [
      {
        type: "urgent", label: "Contrats à renouveler", badge: "2 ce mois", badgeColor: "red",
        title: "Villa Cologny + Studio Plainpalais",
        subtitle: "Baux qui expirent le 31 décembre. Cathy a préparé les avenants — tu valides ?",
        primaryAction: "Valider les 2", secondaryAction: "Voir détail",
      },
      {
        type: "info", label: "Nouvelles candidatures", badge: "3 dossiers", badgeColor: "blue",
        title: "Apt. 4P — Avenue de France, Lausanne",
        subtitle: "Cathy a scoré les dossiers: 89/100 (recommandé), 74/100, 61/100.",
        primaryAction: "Voir le 89/100", secondaryAction: "Comparer tous",
      },
      {
        type: "mission", label: "Intervention en cours", badge: "Plomberie", badgeColor: "amber",
        title: "Fuite détectée — Rue de Rive 8",
        subtitle: "Müller Plomberie accepté à 340 CHF. Intervention prévue aujourd'hui 14h.",
      },
    ],
  },
  super_admin: {
    profileLabel: "Admin",
    greeting: (n) => `bonjour ${n} — vue globale`,
    chatPlaceholder: "Ex: stats de la plateforme ?",
    cards: [
      {
        type: "info", label: "Plateforme", badge: "Actif", badgeColor: "green",
        title: "Tout fonctionne normalement",
        subtitle: "Aucune alerte système. Voir le back-office pour les détails.",
        primaryAction: "Back-office",
      },
    ],
  },
  opener: {
    profileLabel: "Ouvreur",
    greeting: (n) => `salut ${n} — 2 missions près de toi`,
    chatPlaceholder: "Ex: c'est quoi ma prochaine mission ?",
    cards: [
      {
        type: "mission", label: "Mission disponible", badge: "45 CHF", badgeColor: "amber",
        title: "Visite appartement — Carouge",
        subtitle: "3 visiteurs à accueillir. Photos + rapport requis. Paiement sous 24h.",
        primaryAction: "Accepter", secondaryAction: "Refuser",
        details: [{ val: "1.2km", lbl: "de toi" }, { val: "14h00", lbl: "demain" }, { val: "~45min", lbl: "durée" }],
      },
      {
        type: "mission", label: "Mission disponible", badge: "35 CHF", badgeColor: "amber",
        title: "Remise de clés — Plainpalais",
        subtitle: "Remise clés nouveau locataire. Vérification état des lieux à l'entrée.",
        primaryAction: "Accepter", secondaryAction: "Refuser",
        details: [{ val: "2.1km", lbl: "de toi" }, { val: "09h00", lbl: "vendredi" }, { val: "~20min", lbl: "durée" }],
      },
      {
        type: "success", label: "Paiement reçu", badge: "+80 CHF", badgeColor: "green",
        title: "Mission complétée lundi — Eaux-Vives",
        subtitle: "Virement sur ton compte. Total ce mois: 320 CHF sur 7 missions.",
      },
    ],
  },
  tenant: {
    profileLabel: "Locataire",
    greeting: (n) => `bonjour ${n} — tout va bien`,
    chatPlaceholder: "Ex: j'ai une fuite d'eau dans ma salle de bain",
    cards: [
      {
        type: "info", label: "Prochain loyer", badge: "dans 3 jours", badgeColor: "blue",
        title: "1 850 CHF — 1er décembre",
        subtitle: "Votre quittance de novembre est disponible.",
        primaryAction: "Télécharger quittance", secondaryAction: "Voir historique",
      },
      {
        type: "success", label: "Contrat actif", badge: "Jusqu'au 31.03.26", badgeColor: "green",
        title: "Studio 38m² — Rue de Carouge 22",
        subtitle: "Bail en cours. Prochain état des lieux: mars 2026.",
        primaryAction: "Voir mon contrat",
      },
    ],
  },
  company: {
    profileLabel: "Artisan",
    greeting: (n) => `bonjour ${n} — 1 appel d'offre`,
    chatPlaceholder: "Ex: je cherche des chantiers à Genève cette semaine",
    cards: [
      {
        type: "mission", label: "Appel d'offre correspondant", badge: "Électricité", badgeColor: "amber",
        title: "Installation tableau électrique — Lausanne",
        subtitle: "Appartement 4 pièces. Remplacement tableau + 6 prises. Budget ~2 400 CHF.",
        primaryAction: "Déposer un devis", secondaryAction: "Voir le détail",
        details: [{ val: "8km", lbl: "de vous" }, { val: "~2 400", lbl: "budget CHF" }, { val: "Jan.", lbl: "délai" }],
      },
      {
        type: "success", label: "Devis accepté", badge: "1 800 CHF", badgeColor: "green",
        title: "Remplacement prises — Rue de Rive 8",
        subtitle: "Validé par le propriétaire. Intervention planifiée mardi 10h.",
        primaryAction: "Confirmer l'intervention",
      },
    ],
  },
};

// ── Badge colors ──────────────────────────────────────────────────────────────

const BADGE_STYLES = {
  red:   { bg: "rgba(163,45,45,0.1)",   color: "#A32D2D" },
  green: { bg: "rgba(59,109,17,0.1)",   color: "#3B6D11" },
  blue:  { bg: "rgba(24,95,165,0.1)",   color: "#185FA5" },
  amber: { bg: "rgba(133,79,11,0.1)",   color: "#854F0B" },
};

const CARD_BORDER = {
  urgent:  "#D4601A",
  success: "#3B6D11",
  info:    "#185FA5",
  mission: "#854F0B",
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function CathyHome() {
  const router = useRouter();
  const { data: profile, isLoading } = useUser();
  const [isTalking, setIsTalking] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const role = profile?.role ?? "owner";
  const config = CONFIGS[role];
  const firstName = profile?.first_name ?? profile?.email?.split("@")[0] ?? "…";

  const phrases = [
    config.greeting(firstName),
    "je vous écoute…",
    "analyse en cours…",
    "voici ce que je recommande…",
  ];

  useEffect(() => {
    if (profile) setStatusText(config.greeting(firstName));
  }, [profile]);

  function toggleTalk() {
    if (isTalking) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsTalking(false);
      setStatusText(config.greeting(firstName));
    } else {
      setIsTalking(true);
      let i = 1;
      setStatusText(phrases[1]);
      intervalRef.current = setInterval(() => {
        i = (i % (phrases.length - 1)) + 1;
        setStatusText(phrases[i]);
      }, 2000);
    }
  }

  async function sendMessage() {
    const msg = chatInput.trim();
    if (!msg || isThinking) return;
    setChatInput("");
    setIsThinking(true);
    setStatusText("Cathy réfléchit…");
    try {
      const { data } = await api.post("/ai/chat", {
        message: msg,
        context: { role, page: "home" },
      });
      setStatusText((data.response as string).substring(0, 80) + "…");
    } catch {
      setStatusText("Désolé, une erreur est survenue.");
    } finally {
      setIsThinking(false);
    }
  }

  if (isLoading) {
    return (
      <div style={{ background: "#F5EDE0", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #F5A050 0%, #D4601A 45%, #8A3008 100%)", animation: "pulse 2s infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ background: "#F5EDE0", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "2.5rem 1.2rem 2rem", position: "relative", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Profile tag */}
      <div style={{ position: "absolute", top: 16, left: 16, padding: "5px 12px", borderRadius: 20, background: "rgba(255,255,255,0.7)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#A05C28", backdropFilter: "blur(4px)", border: "0.5px solid rgba(160,92,40,0.2)" }}>
        {config.profileLabel}
      </div>

      {/* Dashboard button */}
      <button
        onClick={() => router.push("/overview")}
        style={{ position: "absolute", top: 16, right: 16, padding: "6px 14px", borderRadius: 20, border: "0.5px solid rgba(160,92,40,0.2)", background: "rgba(255,255,255,0.7)", fontSize: 11, color: "#A05C28", cursor: "pointer", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", gap: 5 }}
      >
        <svg viewBox="0 0 16 16" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
        Tableau de bord
      </button>

      {/* Bubble */}
      <div style={{ position: "relative", width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.8rem" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid #D4601A", animation: "ripple 3s ease-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid #D4601A", animation: "ripple2 3s ease-out infinite 1.5s" }} />
        <div
          onClick={toggleTalk}
          style={{
            width: 120, height: 120, borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #F5A050 0%, #D4601A 45%, #8A3008 100%)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            animation: isTalking ? "speaking 0.4s ease-in-out infinite" : "breathe 3.5s ease-in-out infinite",
            cursor: "pointer", zIndex: 2,
            boxShadow: "0 8px 40px rgba(212,96,26,0.3)",
          }}
        >
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 300, color: "#fff", letterSpacing: 4, textTransform: "uppercase" }}>Cathy</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>parler</span>
        </div>
      </div>

      {/* Status */}
      <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#A05C28", marginBottom: "1.6rem", minHeight: 16, fontWeight: 300, opacity: 0.8, textAlign: "center", maxWidth: 340 }}>
        {statusText}
      </div>

      {/* Cards */}
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 10, marginBottom: "1.2rem" }}>
        {config.cards.map((card, idx) => (
          <div key={idx} style={{
            background: "#fff", borderRadius: 16, padding: "14px 16px",
            border: "0.5px solid rgba(160,92,40,0.12)",
            borderLeft: `3px solid ${CARD_BORDER[card.type]}`,
            paddingLeft: 14,
            animation: `fadeUp 0.4s ease ${idx * 0.1}s both`,
          }}>
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
                  <button style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "#D4601A", color: "#fff", fontFamily: "inherit", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                    {card.primaryAction}
                  </button>
                )}
                {card.secondaryAction && (
                  <button style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid rgba(160,92,40,0.25)", background: "transparent", color: "#A05C28", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
                    {card.secondaryAction}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Revenue bar (owner only) */}
      {config.revenueBar && (
        <div style={{ width: "100%", maxWidth: 420, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#A05C28", marginBottom: 5 }}>
            <span>{config.revenueBar.label}</span>
            <span style={{ fontWeight: 500, color: "#1a1a1a" }}>{config.revenueBar.value}</span>
          </div>
          <div style={{ height: 4, background: "#E8DDD0", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: 4, background: "#D4601A", borderRadius: 2, width: `${config.revenueBar.pct}%`, transition: "width 1s ease" }} />
          </div>
        </div>
      )}

      {/* Chat input */}
      <div style={{ width: "100%", maxWidth: 420, display: "flex", gap: 8, alignItems: "center", background: "#fff", borderRadius: 24, padding: "8px 8px 8px 16px", border: "0.5px solid rgba(160,92,40,0.2)" }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder={config.chatPlaceholder}
          disabled={isThinking}
          style={{ flex: 1, border: "none", outline: "none", fontFamily: "inherit", fontSize: 13, color: "#1a1a1a", background: "transparent" }}
        />
        <button
          onClick={sendMessage}
          disabled={isThinking}
          style={{ width: 34, height: 34, borderRadius: "50%", background: "#D4601A", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: isThinking ? 0.6 : 1 }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>

      {/* CSS animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes speaking { 0%,100%{transform:scale(1)} 25%{transform:scale(1.06)} 75%{transform:scale(0.97)} }
        @keyframes ripple { 0%{transform:scale(0.9);opacity:0.15} 100%{transform:scale(1.65);opacity:0} }
        @keyframes ripple2 { 0%{transform:scale(0.9);opacity:0.09} 100%{transform:scale(1.85);opacity:0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
