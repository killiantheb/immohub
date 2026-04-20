"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { C } from "@/lib/design-tokens";

const sans  = "var(--font-sans)";
const serif = "var(--font-serif)";
const API   = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type ComparisonResponse = {
  economie_annuelle: number;
  economie_pct: number;
  cout_regie_annuel: number;
  cout_autonomie_annuel: number;
};

export function AutonomieCalc() {
  const [nbBiens, setNbBiens] = useState(2);
  const [loyer, setLoyer] = useState(2200);
  const [result, setResult] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(() => {
      fetch(`${API}/autonomie/comparison`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nb_biens: nbBiens, loyer_moyen_mensuel: loyer }),
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: ComparisonResponse | null) => {
          if (alive && data) setResult(data);
        })
        .catch(() => { /* ignore */ })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 250);

    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [nbBiens, loyer]);

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <Sparkles size={14} style={{ color: C.gold }} />
        <span>Simulez vos économies Althy Autonomie</span>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <Field label="Nb de biens">
          <input
            type="number"
            min={1}
            max={50}
            value={nbBiens}
            onChange={(e) => setNbBiens(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))}
            style={inputStyle}
          />
        </Field>
        <Field label="Loyer moyen / mois (CHF)">
          <input
            type="number"
            min={500}
            max={20000}
            step={100}
            value={loyer}
            onChange={(e) => setLoyer(Math.max(500, Math.min(20000, parseInt(e.target.value, 10) || 500)))}
            style={inputStyle}
          />
        </Field>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: "12px 14px",
          borderRadius: 10,
          background: C.goldBg,
          border: `1px solid ${C.goldBorder}`,
          opacity: loading ? 0.6 : 1,
          transition: "opacity 0.15s",
        }}
      >
        <div style={{ fontSize: 11, color: C.text2, fontFamily: sans, letterSpacing: "0.03em" }}>
          Économie vs régie classique
        </div>
        <div
          style={{
            fontFamily: serif,
            fontSize: 26,
            fontWeight: 300,
            color: C.prussian,
            marginTop: 2,
            letterSpacing: "-0.01em",
          }}
        >
          {result ? (
            <>
              CHF {Math.round(result.economie_annuelle).toLocaleString("fr-CH")}
              <span style={{ fontSize: 14, color: C.text2, fontWeight: 400, marginLeft: 6 }}>
                / an
              </span>
            </>
          ) : "—"}
        </div>
        {result && (
          <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
            Soit {Math.round(result.economie_pct)} % de frais en moins ·
            Autonomie : CHF {Math.round(result.cout_autonomie_annuel).toLocaleString("fr-CH")}/an
          </div>
        )}
      </div>

      <Link href="/autonomie?source=landing_chat" style={ctaLink}>
        Découvrir Althy Autonomie (CHF 39/mois) <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: C.text2, fontFamily: sans, letterSpacing: "0.02em" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const panelStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 14,
  borderRadius: 14,
  background: "#fff",
  border: `1px solid ${C.border}`,
  boxShadow: "0 1px 2px rgba(15,46,76,0.06)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontFamily: sans,
  fontSize: 12,
  fontWeight: 600,
  color: C.text2,
  letterSpacing: "0.02em",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  fontFamily: sans,
  fontSize: 13,
  color: C.text,
  outline: "none",
  width: "100%",
  background: "#fff",
};

const ctaLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  marginTop: 12,
  fontFamily: sans,
  fontSize: 12,
  fontWeight: 600,
  color: C.prussian,
  textDecoration: "none",
};
