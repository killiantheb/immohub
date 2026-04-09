"use client";

import { useState } from "react";
import { Download, FileText, TrendingUp, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RevenueChart } from "@/components/RevenueChart";

const S = {
  bg:       "var(--althy-bg)",
  surface:  "var(--althy-surface)",
  surface2: "var(--althy-surface-2)",
  border:   "var(--althy-border)",
  text:     "var(--althy-text)",
  text2:    "var(--althy-text-2)",
  text3:    "var(--althy-text-3)",
  orange:   "var(--althy-orange)",
  orangeBg: "var(--althy-orange-bg)",
  green:    "var(--althy-green)",
  greenBg:  "var(--althy-green-bg)",
  red:      "var(--althy-red)",
  redBg:    "var(--althy-red-bg)",
  amber:    "var(--althy-amber)",
  amberBg:  "var(--althy-amber-bg)",
  shadow:   "var(--althy-shadow)",
  shadowMd: "var(--althy-shadow-md)",
} as const;

const MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const YEAR = new Date().getFullYear();

function fmt(n: number | null | undefined, currency = true) {
  if (n == null) return "—";
  return currency
    ? new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n)
    : n.toLocaleString("fr-CH");
}

interface RevenueStats {
  total_received: number;
  total_expected: number;
  total_late: number;
  net_revenue: number;
  properties_count: number;
  occupancy_rate: number;
}

export default function ComptabilitePage() {
  const [year, setYear]     = useState(YEAR);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["revenue-stats", year],
    queryFn: () => api.get<RevenueStats>("/transactions/stats", { params: { year } }).then(r => r.data),
  });

  const { data: txData } = useQuery({
    queryKey: ["transactions", year],
    queryFn: () => api.get("/transactions", { params: { year, size: 200 } }).then(r => r.data),
  });

  const avgMonthly = stats ? Math.round(stats.total_received / 12) : 0;
  const regieEquivalent = avgMonthly * 0.10 * 12; // 10% frais régie
  const savings = regieEquivalent - 29 * 12;

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: S.text, letterSpacing: "-0.02em" }}>Comptabilité</h1>
          <p style={{ margin: 0, color: S.text3, fontSize: 13.5 }}>États locatifs · Rapport annuel · Export fiduciaire</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            style={{ padding: "8px 12px", border: `1px solid ${S.border}`, borderRadius: 9, fontSize: 13, backgroundColor: S.surface, color: S.text, outline: "none" }}>
            {[YEAR, YEAR - 1, YEAR - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: `1px solid ${S.border}`, borderRadius: 9, backgroundColor: S.surface, color: S.text2, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Download size={14} /> Export PDF
          </button>
          <button style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: `1px solid ${S.orange}`, borderRadius: 9, backgroundColor: S.orangeBg, color: S.orange, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <FileText size={14} /> Export Excel fiduciaire
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Loyers encaissés",   value: fmt(stats?.total_received),   color: S.green,  bg: S.greenBg  },
          { label: "Loyers attendus",     value: fmt(stats?.total_expected),   color: S.text,   bg: S.surface2 },
          { label: "Impayés",             value: fmt(stats?.total_late),       color: stats?.total_late ? S.red : S.text3, bg: stats?.total_late ? S.redBg : S.surface2 },
          { label: "Taux d'occupation",   value: stats?.occupancy_rate ? `${stats.occupancy_rate}%` : "—", color: S.orange, bg: S.orangeBg },
          { label: "Économies vs régie",  value: savings > 0 ? fmt(savings) : "—", color: S.green, bg: S.greenBg },
        ].map(k => (
          <div key={k.label} style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: S.text3, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Savings box */}
      {savings > 0 && (
        <div style={{
          padding: "14px 18px", borderRadius: 12, marginBottom: 24,
          background: "linear-gradient(135deg, rgba(46,94,34,0.07), rgba(46,94,34,0.12))",
          border: "1px solid rgba(46,94,34,0.2)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <TrendingUp size={18} color={S.green} />
          <p style={{ margin: 0, fontSize: 13, color: S.text }}>
            <strong>Althy vous économise {fmt(savings)}/an</strong> par rapport à une régie qui facturerait 10% de gérance ({fmt(regieEquivalent)}/an vs CHF {29*12}/an pour Althy).
          </p>
        </div>
      )}

      {/* Revenue chart */}
      <div style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: S.text }}>Évolution des loyers {year}</h3>
        <RevenueChart year={year} />
      </div>

      {/* Monthly breakdown table */}
      <div style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${S.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: S.text }}>État locatif mensuel {year}</h3>
          <span style={{ fontSize: 12, color: S.text3 }}>Tous les biens</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: S.surface2 }}>
                {["Mois","Encaissé","Attendu","Écart","Impayés","Statut"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: h === "Mois" ? "left" : "right", fontSize: 11, fontWeight: 600, color: S.text3, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MONTHS_FR.map((month, i) => {
                // Mock data from stats
                const expected = Math.round(((stats?.total_expected ?? 0) / 12));
                const received = i < new Date().getMonth() ? Math.round(expected * (0.9 + Math.random() * 0.15)) : 0;
                const late     = expected - received > 200 && i < new Date().getMonth() ? Math.round((expected - received) * 0.5) : 0;
                const ok       = i < new Date().getMonth();
                return (
                  <tr key={month} style={{ borderTop: `1px solid ${S.border}`, backgroundColor: i % 2 === 0 ? "transparent" : S.surface2 }}>
                    <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: S.text }}>{month} {year}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, color: ok ? S.green : S.text3, fontWeight: ok ? 600 : 400 }}>{ok ? fmt(received) : "—"}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, color: S.text2 }}>{fmt(expected)}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, color: ok && received >= expected ? S.green : ok ? S.amber : S.text3 }}>
                      {ok ? (received >= expected ? `+${fmt(received - expected)}` : fmt(received - expected)) : "—"}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, color: late > 0 ? S.red : S.text3 }}>{late > 0 ? fmt(late) : "—"}</td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 600,
                        backgroundColor: !ok ? S.surface2 : received >= expected ? S.greenBg : S.amberBg,
                        color: !ok ? S.text3 : received >= expected ? S.green : S.amber,
                      }}>
                        {!ok ? "À venir" : received >= expected ? "Complet" : "Partiel"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${S.border}`, backgroundColor: S.surface2 }}>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: S.text }}>TOTAL {year}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: S.green }}>{fmt(stats?.total_received)}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: S.text }}>{fmt(stats?.total_expected)}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: S.green }}>{stats ? fmt(stats.total_received - stats.total_expected) : "—"}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: stats?.total_late ? S.red : S.text3 }}>{fmt(stats?.total_late ?? 0)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Export section */}
      <div style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: S.text }}>Exports disponibles</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {[
            { icon: "📄", title: "État locatif annuel",     sub: "Récapitulatif loyers par bien · PDF",    btn: "Générer PDF" },
            { icon: "📊", title: "Export Excel fiduciaire", sub: "Format compatible ERP suisse · XLSX",    btn: "Générer Excel" },
            { icon: "🧾", title: "Déclaration fiscale IA",  sub: "Revenus locatifs préremplis · PDF",      btn: "Préparer" },
            { icon: "📈", title: "Rapport de gestion",      sub: "Performances & rendements · PDF",        btn: "Générer" },
          ].map(e => (
            <div key={e.title} style={{ padding: "16px 18px", border: `1px solid ${S.border}`, borderRadius: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{e.icon}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: S.text, marginBottom: 3 }}>{e.title}</div>
              <div style={{ fontSize: 11.5, color: S.text3, marginBottom: 12 }}>{e.sub}</div>
              <button style={{ padding: "7px 14px", border: `1px solid ${S.border}`, borderRadius: 8, backgroundColor: S.surface2, color: S.text2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {e.btn}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
