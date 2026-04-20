"use client";

/**
 * /app/mes-candidatures — Candidatures envoyées par le locataire/acheteur connecté.
 * Permet de suivre l'état de ses dossiers. Le locataire ne paie JAMAIS rien à Althy.
 */

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { C } from "@/lib/design-tokens";

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
  visite_proposee_at: string | null;
  created_at: string;
  bien?: Bien;
}

const STATUT_CONFIG = {
  en_attente: { label: "En attente de réponse", icon: "⏳", color: "var(--althy-amber)", bg: "var(--althy-amber-bg)" },
  acceptee:   { label: "Candidature acceptée",   icon: "✅", color: "var(--althy-green)", bg: "var(--althy-green-bg)" },
  refusee:    { label: "Candidature refusée",    icon: "❌", color: "var(--althy-red)",   bg: "var(--althy-red-bg)" },
  retiree:    { label: "Retirée",                icon: "↩",  color: "var(--althy-text-3)", bg: "var(--althy-surface-2)" },
};

const SCORE_COLOR = (s: number | null) => {
  if (s === null) return "var(--althy-text-3)";
  if (s >= 70) return "var(--althy-green)";
  if (s >= 50) return "var(--althy-amber)";
  return "var(--althy-red)";
};

export default function MesCandidaturesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [candidatures, setCandidatures] = useState<Candidature[]>([]);
  const [loading, setLoading] = useState(true);

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


  return (
    <div style={{ padding: "24px 20px 60px", maxWidth: 760, margin: "0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ font: "300 26px/1.2 var(--font-serif)", color: C.text, margin: 0 }}>
          Mes candidatures
        </h1>
        <p style={{ fontSize: 14, color: C.text2, margin: "6px 0 0" }}>
          Suivez l'état de vos dossiers envoyés aux propriétaires.
        </p>
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--althy-green-bg)",
            border: "1px solid var(--althy-green)",
            color: "var(--althy-green)",
            fontSize: 13,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ✓ Votre dossier est gratuit et illimité — Althy ne vous facture rien.
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${C.border}`, borderTopColor: C.orange, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : candidatures.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.text2 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Aucune candidature</div>
          <div style={{ fontSize: 14, marginBottom: 24 }}>
            Vous n'avez encore postulé à aucun bien.
          </div>
          <Link
            href="/biens"
            style={{
              display: "inline-block", background: C.orange, color: "#fff",
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
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: C.radiusCard, overflow: "hidden",
                }}
              >
                {/* Top bar */}
                <div style={{
                  background: cfg.bg, borderBottom: `1px solid ${C.border}`,
                  padding: "8px 16px", display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>{cfg.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: C.text3 }}>
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
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                      {c.bien?.titre ?? "Bien"}
                    </div>
                    <div style={{ fontSize: 13, color: C.text2, marginBottom: 6 }}>
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
                          <span style={{ fontSize: 12, color: C.text3 }}>— {c.score_details.summary.slice(0, 60)}…</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Link to bien */}
                  <Link
                    href={`/app/biens/${c.listing_id}`}
                    style={{
                      fontSize: 12, color: C.text3, textDecoration: "none",
                      flexShrink: 0, paddingTop: 2,
                    }}
                  >
                    Voir l'annonce →
                  </Link>
                </div>

                {/* Candidature acceptée — aucun paiement requis côté locataire */}
                {c.statut === "acceptee" && (
                  <div style={{
                    borderTop: `1px solid ${C.border}`, padding: "12px 16px",
                    background: "var(--althy-green-bg)",
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--althy-green)" }}>
                      Félicitations ! Votre candidature a été acceptée 🎉
                    </div>
                    <div style={{ fontSize: 13, color: "var(--althy-green)", marginTop: 4 }}>
                      Aucun frais pour vous. Le propriétaire va vous contacter pour la suite.
                    </div>
                  </div>
                )}

                {/* Visite proposée */}
                {c.visite_proposee_at && (
                  <div style={{
                    borderTop: `1px solid ${C.border}`, padding: "10px 16px",
                    fontSize: 13, color: C.text2,
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
