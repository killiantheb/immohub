"use client";

import { useState } from "react";
import Link from "next/link";
import { C } from "@/lib/design-tokens";

const API   = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const serif = "var(--font-serif)";
const sans  = "var(--font-sans)";

interface EstimResult { min: number; max: number; moyen: number }

const FIELD: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "11px 14px", borderRadius: 9,
  border: `1px solid ${C.border}`,
  fontSize: 14, fontFamily: sans, color: C.text,
  outline: "none", background: C.bg,
};

const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
  color: C.textMuted, textTransform: "uppercase", display: "block", marginBottom: 6,
};

export function LandingEstimation() {
  const [adresse,  setAdresse]  = useState("");
  const [pieces,   setPieces]   = useState("");
  const [surface,  setSurface]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<EstimResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/estimation/rapide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adresse, pieces: Number(pieces), surface: Number(surface) }),
      });
      if (!res.ok) throw new Error();
      setResult(await res.json());
    } catch {
      setError("Service indisponible. Essayez le rapport complet →");
    } finally {
      setLoading(false);
    }
  }

  function reset() { setResult(null); setAdresse(""); setPieces(""); setSurface(""); setError(null); }

  return (
    <section style={{ background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "72px 24px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: C.orange, textTransform: "uppercase", marginBottom: 10, margin: "0 0 10px" }}>
            Estimation IA
          </p>
          <h2 style={{ fontFamily: serif, fontSize: "clamp(24px,3vw,36px)", fontWeight: 300, color: C.text, margin: "8px 0 10px" }}>
            Combien vaut votre bien ?
          </h2>
          <p style={{ fontSize: 14, color: C.textMuted, margin: 0 }}>
            Obtenez une estimation en 30 secondes — sans inscription.
          </p>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "32px 36px", boxShadow: C.shadow }}>

          {!result ? (
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={LABEL}>Adresse ou ville</label>
                  <input type="text" value={adresse} onChange={e => setAdresse(e.target.value)}
                    placeholder="Rue du Rhône, Genève" required style={FIELD} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
                  <div>
                    <label style={LABEL}>Pièces</label>
                    <select value={pieces} onChange={e => setPieces(e.target.value)} required
                      style={{ ...FIELD, appearance: "none" as const }}>
                      <option value="">—</option>
                      {["1","2","3","4","5","6+"].map(v => (
                        <option key={v} value={v}>{v} pièce{v !== "1" ? "s" : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={LABEL}>Surface (m²)</label>
                    <input type="number" value={surface} onChange={e => setSurface(e.target.value)}
                      placeholder="65" min={10} max={5000} required style={FIELD} />
                  </div>
                </div>
              </div>

              {error && (
                <p style={{ fontSize: 13, color: C.red, marginBottom: 12 }}>
                  {error}{" "}
                  <Link href="/estimation" style={{ color: C.orange, fontWeight: 600 }}>
                    Rapport complet →
                  </Link>
                </p>
              )}

              <button type="submit" disabled={loading} style={{
                width: "100%", padding: "13px 0", borderRadius: 10,
                background: loading ? "rgba(232,96,44,0.5)" : C.orange,
                color: "#fff", border: "none", fontSize: 15, fontWeight: 600,
                fontFamily: sans, cursor: loading ? "default" : "pointer",
              }}>
                {loading ? "Analyse en cours…" : "Estimer gratuitement →"}
              </button>

              <p style={{ textAlign: "center", fontSize: 12, color: C.textMuted, marginTop: 12, marginBottom: 0 }}>
                📊 2 847 estimations réalisées
              </p>
            </form>
          ) : (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: C.orange, textTransform: "uppercase", marginBottom: 8 }}>
                Résultat estimation
              </p>
              <div style={{ fontFamily: serif, fontSize: "clamp(28px,4vw,44px)", fontWeight: 300, color: C.text, margin: "0 0 8px" }}>
                CHF {result.min.toLocaleString("fr-CH")} — {result.max.toLocaleString("fr-CH")}
                <span style={{ fontSize: 16, color: C.textMuted, marginLeft: 6 }}>/mois</span>
              </div>
              <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 28 }}>
                Estimation pour {surface} m² · {pieces} pièces · {adresse}
              </p>
              <Link href="/register?source=estimation" style={{
                display: "inline-block", padding: "12px 28px", borderRadius: 10,
                background: C.orange, color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none",
              }}>
                Recevez le rapport complet → Inscription
              </Link>
              <button onClick={reset} style={{
                display: "block", margin: "16px auto 0",
                background: "none", border: "none", fontSize: 13, color: C.textMuted,
                cursor: "pointer", fontFamily: sans,
              }}>
                Nouvelle estimation
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
