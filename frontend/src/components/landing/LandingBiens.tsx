"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API   = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const ORANGE = "#E8602C";
const DARK   = "#1A1612";
const MUTED  = "#6B5E52";
const serif  = "var(--font-serif, 'Fraunces', Georgia, serif)";
const sans   = "var(--font-sans, 'DM Sans', system-ui, sans-serif)";

const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg,#E8D8C4,#C8A880)",
  "linear-gradient(135deg,#C4D8C4,#90B890)",
  "linear-gradient(135deg,#E0D8C4,#C0A880)",
  "linear-gradient(135deg,#C8C4E0,#9890B8)",
  "linear-gradient(135deg,#C4D8C0,#90B080)",
  "linear-gradient(135deg,#D4C8B8,#A89880)",
];

const TYPE_LABEL: Record<string, string> = {
  apartment: "Appartement", villa: "Villa", studio: "Studio",
  commercial: "Commercial", office: "Bureau", house: "Maison",
  parking: "Parking", garage: "Garage",
};

interface BienPublic {
  id: string;
  ville: string;
  canton: string | null;
  type: string;
  pieces: number | null;
  surface: number | null;
  prix: number | null;
  periode: string;
  statut: string;
  cover: string | null;
}

export function LandingBiens() {
  const [biens,   setBiens]   = useState<BienPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/marketplace/biens?limit=6`)
      .then(r => r.json())
      .then(d => setBiens(d.items ?? []))
      .catch(() => setBiens([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="liste" style={{ maxWidth: 1100, margin: "0 auto", padding: "88px 24px 64px" }}>
      <style>{`
        .lp-grid-biens { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
        @media (max-width:1024px) { .lp-grid-biens { grid-template-columns:repeat(2,1fr); } }
        @media (max-width:640px)  { .lp-grid-biens { grid-template-columns:1fr; } }
      `}</style>

      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: ORANGE, textTransform: "uppercase" as const, marginBottom: 10, margin: "0 0 10px" }}>
          Suisse romande · Genève · Vaud · Valais
        </p>
        <h2 style={{ fontFamily: serif, fontSize: "clamp(26px,3.5vw,40px)", fontWeight: 300, color: DARK, margin: "8px 0 0" }}>
          Biens disponibles maintenant
        </h2>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "48px 0", color: MUTED, fontSize: 14, fontFamily: sans }}>
          Chargement des biens…
        </div>
      )}

      {!loading && biens.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 24px", background: "#fff", borderRadius: 16, border: "1px dashed rgba(26,22,18,0.12)" }}>
          <p style={{ fontFamily: serif, fontSize: 24, fontWeight: 300, color: DARK, margin: "0 0 10px" }}>Biens à venir</p>
          <p style={{ fontSize: 14, color: MUTED, marginBottom: 24 }}>
            Les premiers biens arrivent bientôt. Inscrivez-vous pour être notifié en priorité.
          </p>
          <Link href="/register" style={{
            display: "inline-block", padding: "11px 26px", borderRadius: 9,
            background: ORANGE, color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none",
          }}>
            M&apos;inscrire →
          </Link>
        </div>
      )}

      {!loading && biens.length > 0 && (
        <>
          <div className="lp-grid-biens">
            {biens.map((b, i) => {
              const statut     = b.statut ?? "À louer";
              const badgeColor = statut === "À louer" ? "#3A7A5A" : statut === "À vendre" ? "#2563EB" : MUTED;
              const photoStyle = b.cover
                ? { backgroundImage: `url(${b.cover})`, backgroundSize: "cover", backgroundPosition: "center" }
                : { background: FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length] };

              return (
                <Link key={b.id} href={`/biens/${b.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <div
                    style={{
                      background: "#fff", borderRadius: 14, overflow: "hidden",
                      border: "0.5px solid rgba(26,22,18,0.07)",
                      boxShadow: "0 2px 16px rgba(26,22,18,0.05)",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(26,22,18,0.13)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 16px rgba(26,22,18,0.05)";
                    }}
                  >
                    {/* Photo / Gradient */}
                    <div style={{ height: 180, position: "relative", ...photoStyle }}>
                      <div style={{
                        position: "absolute", top: 10, left: 10,
                        background: badgeColor, color: "#fff",
                        fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6,
                      }}>
                        {statut}
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ padding: "14px 16px 18px" }}>
                      {b.prix != null && (
                        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                          <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 400, color: DARK }}>
                            CHF {b.prix.toLocaleString("fr-CH")}
                          </span>
                          {b.periode && <span style={{ fontSize: 13, color: MUTED }}>{b.periode}</span>}
                        </div>
                      )}
                      <p style={{ margin: "0 0 10px", fontSize: 12, color: MUTED }}>
                        {b.ville}{b.canton ? ` · ${b.canton}` : ""}
                      </p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                        {b.pieces != null && (
                          <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 5, background: "rgba(26,22,18,0.05)", color: MUTED }}>
                            {b.pieces}p
                          </span>
                        )}
                        {b.surface != null && (
                          <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 5, background: "rgba(26,22,18,0.05)", color: MUTED }}>
                            {b.surface} m²
                          </span>
                        )}
                        <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 5, background: "rgba(26,22,18,0.05)", color: MUTED }}>
                          {TYPE_LABEL[b.type] ?? b.type}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div style={{ textAlign: "center", marginTop: 40 }}>
            <Link href="/biens" style={{
              display: "inline-block", padding: "12px 30px", borderRadius: 10,
              border: "1.5px solid rgba(26,22,18,0.14)",
              fontSize: 14, fontWeight: 600, color: DARK, textDecoration: "none",
            }}>
              Voir tous les biens →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
