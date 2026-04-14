"use client";

/**
 * /app/mes-candidatures — Candidatures envoyées par le locataire/acheteur connecté.
 * Permet de suivre l'état de ses dossiers et de payer les frais si accepté.
 */

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Bien {
  id: string;
  titre: string;
  ville: string;
  prix: number;
  cover: string | null;
}

interface Candidature {
  id: string;
  listing_id: string;
  statut: "en_attente" | "acceptee" | "refusee" | "retiree";
  score_ia: number | null;
  score_details: {
    recommendation: "approve" | "review" | "reject";
    risk_flags: string[];
    summary: string;
  } | null;
  frais_payes: boolean;
  visite_proposee_at: string | null;
  created_at: string;
  bien?: Bien;
}

const STATUT_CONFIG = {
  en_attente: { label: "En attente de réponse", icon: "⏳", color: "#d97706", bg: "#fef9f0" },
  acceptee:   { label: "Candidature acceptée",   icon: "✅", color: "#16a34a", bg: "#f0fdf4" },
  refusee:    { label: "Candidature refusée",    icon: "❌", color: "#dc2626", bg: "#fef2f2" },
  retiree:    { label: "Retirée",                icon: "↩",  color: "#6b7280", bg: "#f9fafb" },
};

const SCORE_COLOR = (s: number | null) => {
  if (s === null) return "#9ca3af";
  if (s >= 70) return "#16a34a";
  if (s >= 50) return "#d97706";
  return "#dc2626";
};

export default function MesCandidaturesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [candidatures, setCandidatures] = useState<Candidature[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setToken(data.session.access_token);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/marketplace/mes-candidatures`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setCandidatures(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handlePayerFrais = async (candidatureId: string) => {
    if (!token) return;
    setPayingId(candidatureId);
    try {
      const res = await fetch(`${API}/paiements/frais-dossier`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ candidature_id: candidatureId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Erreur lors du paiement");
        return;
      }
      const { client_secret } = await res.json();
      // Rediriger vers Stripe Checkout — en production on utiliserait Stripe.js
      // Ici on signale simplement que le PaymentIntent est prêt
      alert(`Paiement initié. client_secret: ${client_secret.slice(0, 20)}…\n(Intégration Stripe.js à brancher ici)`);
    } catch {
      alert("Erreur réseau");
    } finally {
      setPayingId(null);
    }
  };

  const S = {
    orange: "var(--terracotta-primary)",
    surface: "var(--background-card)",
    border: "var(--border-subtle)",
    text: "var(--charcoal)",
    text2: "var(--text-secondary)",
    text3: "var(--text-tertiary)",
    bg: "var(--cream)",
    radius: "var(--radius-card)",
  };

  return (
    <div style={{ padding: "24px 20px 60px", maxWidth: 760, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ font: "300 26px/1.2 var(--font-serif)", color: S.text, margin: 0 }}>
          Mes candidatures
        </h1>
        <p style={{ fontSize: 14, color: S.text2, margin: "6px 0 0" }}>
          Suivez l'état de vos dossiers envoyés aux propriétaires.
        </p>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${S.border}`, borderTopColor: S.orange, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : candidatures.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: S.text2 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Aucune candidature</div>
          <div style={{ fontSize: 14, marginBottom: 24 }}>
            Vous n'avez encore postulé à aucun bien.
          </div>
          <Link
            href="/biens"
            style={{
              display: "inline-block", background: S.orange, color: "#fff",
              padding: "12px 24px", borderRadius: 8, textDecoration: "none",
              fontSize: 14, fontWeight: 600,
            }}
          >
            Voir les biens disponibles →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {candidatures.map((c) => {
            const cfg = STATUT_CONFIG[c.statut] ?? STATUT_CONFIG.en_attente;
            return (
              <div
                key={c.id}
                style={{
                  background: S.surface, border: `1px solid ${S.border}`,
                  borderRadius: S.radius, overflow: "hidden",
                }}
              >
                {/* Top bar */}
                <div style={{
                  background: cfg.bg, borderBottom: `1px solid ${S.border}`,
                  padding: "8px 16px", display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>{cfg.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: S.text3 }}>
                    Postulé le {new Date(c.created_at).toLocaleDateString("fr-CH")}
                  </span>
                </div>

                {/* Content */}
                <div style={{ padding: 16, display: "flex", gap: 14, alignItems: "flex-start" }}>
                  {/* Bien cover */}
                  {c.bien?.cover ? (
                    <img
                      src={c.bien.cover}
                      alt={c.bien?.titre}
                      style={{ width: 80, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 80, height: 64, borderRadius: 8, flexShrink: 0,
                      background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 24,
                    }}>🏠</div>
                  )}

                  {/* Info bien */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: S.text, marginBottom: 2 }}>
                      {c.bien?.titre ?? "Bien"}
                    </div>
                    <div style={{ fontSize: 13, color: S.text2, marginBottom: 6 }}>
                      {c.bien?.ville} · CHF {c.bien?.prix?.toLocaleString("fr-CH")} / mois
                    </div>
                    {/* Score IA */}
                    {c.score_ia !== null && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 700, color: SCORE_COLOR(c.score_ia),
                        }}>
                          Score IA : {c.score_ia}/100
                        </div>
                        {c.score_details?.summary && (
                          <span style={{ fontSize: 12, color: S.text3 }}>— {c.score_details.summary.slice(0, 60)}…</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Link to bien */}
                  <Link
                    href={`/biens/${c.listing_id}`}
                    style={{
                      fontSize: 12, color: S.text3, textDecoration: "none",
                      flexShrink: 0, paddingTop: 2,
                    }}
                  >
                    Voir l'annonce →
                  </Link>
                </div>

                {/* Frais dossier CTA si accepté et non payés */}
                {c.statut === "acceptee" && !c.frais_payes && (
                  <div style={{
                    borderTop: `1px solid ${S.border}`, padding: "12px 16px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 12, background: "#f0fdf4",
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#15803d" }}>
                        Félicitations ! Votre candidature a été acceptée 🎉
                      </div>
                      <div style={{ fontSize: 13, color: "#16a34a" }}>
                        Réglez les frais de dossier pour finaliser votre candidature.
                      </div>
                    </div>
                    <button
                      onClick={() => handlePayerFrais(c.id)}
                      disabled={payingId === c.id}
                      style={{
                        background: "#16a34a", color: "#fff", border: "none",
                        borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600,
                        cursor: payingId === c.id ? "not-allowed" : "pointer",
                        opacity: payingId === c.id ? 0.7 : 1, flexShrink: 0,
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      {payingId === c.id ? (
                        <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      ) : null}
                      Payer CHF 90
                    </button>
                  </div>
                )}

                {/* Frais payés */}
                {c.statut === "acceptee" && c.frais_payes && (
                  <div style={{
                    borderTop: `1px solid ${S.border}`, padding: "12px 16px",
                    background: "#f0fdf4", fontSize: 13, color: "#15803d", fontWeight: 600,
                  }}>
                    ✓ Frais de dossier réglés — le propriétaire va vous contacter pour la suite.
                  </div>
                )}

                {/* Visite proposée */}
                {c.visite_proposee_at && (
                  <div style={{
                    borderTop: `1px solid ${S.border}`, padding: "10px 16px",
                    fontSize: 13, color: S.text2,
                  }}>
                    📅 Visite proposée le {new Date(c.visite_proposee_at).toLocaleDateString("fr-CH")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
