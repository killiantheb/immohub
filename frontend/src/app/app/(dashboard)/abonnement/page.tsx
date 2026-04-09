"use client";

import { useState } from "react";
import { Check, Sparkles, Zap, Building2, Crown, ArrowRight, Shield } from "lucide-react";
import { useUser } from "@/lib/auth";

const S = {
  bg:        "var(--althy-bg)",
  surface:   "var(--althy-surface)",
  surface2:  "var(--althy-surface-2)",
  border:    "var(--althy-border)",
  text:      "var(--althy-text)",
  text2:     "var(--althy-text-2)",
  text3:     "var(--althy-text-3)",
  orange:    "var(--althy-orange)",
  orangeBg:  "var(--althy-orange-bg)",
  green:     "var(--althy-green)",
  greenBg:   "var(--althy-green-bg)",
  shadow:    "var(--althy-shadow)",
  shadowMd:  "var(--althy-shadow-md)",
} as const;

const PLANS = [
  {
    id:    "starter",
    name:  "Starter",
    price: 0,
    period: "Gratuit 14 jours",
    icon:  <Sparkles size={20} />,
    color: S.text2,
    features: [
      "Jusqu'à 2 biens",
      "Documents IA illimités",
      "Bail, EDL, quittances",
      "1 utilisateur",
      "Support email",
    ],
    cta:   "Commencer gratuitement",
    note:  "Sans carte de crédit",
    highlight: false,
  },
  {
    id:    "proprio",
    name:  "Proprio",
    price: 29,
    period: "/mois · CHF 23 si annuel",
    icon:  <Zap size={20} />,
    color: "var(--althy-orange)",
    features: [
      "Jusqu'à 15 biens",
      "Documents IA illimités",
      "Sphère IA : 30 interactions/jour",
      "Marketplace ouvreurs & artisans",
      "Gestion locataires complète",
      "Paiements via Stripe (4% commission)",
      "Annonces Homegate / Immoscout",
      "Rapport financier mensuel",
      "Support prioritaire",
    ],
    cta:   "Choisir Proprio",
    note:  "Économisez CHF 72/an avec l'annuel",
    highlight: true,
  },
  {
    id:    "agence",
    name:  "Agence",
    price: 29,
    period: "/agent/mois",
    icon:  <Building2 size={20} />,
    color: S.text,
    features: [
      "Biens illimités",
      "Multi-agents (2–50)",
      "Documents IA illimités",
      "Sphère IA : 100 interactions/jour",
      "Dashboard agence centralisé",
      "Comptabilité avancée (PPE inclus)",
      "API accès données marché",
      "Intégration CRM agence",
      "Account manager dédié",
    ],
    cta:   "Démo agence",
    note:  "Tarif dégressif dès 5 agents",
    highlight: false,
  },
  {
    id:    "expert",
    name:  "Pro Expert",
    price: 19,
    period: "/mois",
    icon:  <Crown size={20} />,
    color: "var(--althy-amber)",
    features: [
      "Profil expert vérifié",
      "Géomètre, archi, photographe, évaluateur",
      "Accès aux missions Althy",
      "Facturation automatique",
      "Note et avis vérifiés",
      "Accès rapport de marché",
    ],
    cta:   "Devenir Expert",
    note:  "Profil de base gratuit",
    highlight: false,
  },
];

const FEATURES_COMPARE = [
  { name: "Biens gérés",                starter: "2",           proprio: "15",          agence: "Illimité" },
  { name: "Documents IA",               starter: "Illimité",    proprio: "Illimité",    agence: "Illimité" },
  { name: "Interactions sphère IA/jour",starter: "5",           proprio: "30",          agence: "100" },
  { name: "Paiements Stripe Connect",   starter: "—",           proprio: "✓",           agence: "✓" },
  { name: "Marketplace ouvreurs",       starter: "—",           proprio: "✓",           agence: "✓" },
  { name: "Marketplace artisans",       starter: "—",           proprio: "✓",           agence: "✓" },
  { name: "Annonces portails",          starter: "—",           proprio: "✓ (CHF 49+)", agence: "✓ (CHF 49+)" },
  { name: "Comptabilité avancée (PPE)", starter: "—",           proprio: "+CHF 19/mois", agence: "✓ inclus" },
  { name: "API B2B données marché",     starter: "—",           proprio: "—",           agence: "✓ (CHF 600+/mois)" },
  { name: "Utilisateurs",               starter: "1",           proprio: "1",           agence: "2–50" },
];

export default function AbonnementPage() {
  const { data: profile } = useUser();
  const [annual, setAnnual] = useState(false);
  const currentPlan = "starter"; // TODO: load from subscription

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: S.text, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          Mon abonnement
        </h1>
        <p style={{ color: S.text3, fontSize: 14, margin: 0 }}>
          CHF 29/mois pour gérer vos biens. Économisez CHF 328/mois vs une régie.
        </p>
      </div>

      {/* Current plan banner */}
      <div style={{
        backgroundColor: S.orangeBg,
        border: `1px solid rgba(232,96,44,0.22)`,
        borderRadius: 14, padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 32,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={18} color="var(--althy-orange)" />
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: S.text }}>
              Plan actuel : <span style={{ color: "var(--althy-orange)", textTransform: "capitalize" }}>{currentPlan}</span>
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: S.text3 }}>14 jours d&apos;essai gratuit · Carte requise à l&apos;expiration</p>
          </div>
        </div>
        <div style={{
          padding: "6px 14px", borderRadius: 20,
          backgroundColor: "var(--althy-green-bg)",
          border: "1px solid rgba(46,94,34,0.2)",
          fontSize: 12, fontWeight: 600, color: "var(--althy-green)",
        }}>
          Actif — 12 jours restants
        </div>
      </div>

      {/* Annual toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 32 }}>
        <span style={{ fontSize: 13, color: annual ? S.text3 : S.text, fontWeight: annual ? 400 : 600 }}>Mensuel</span>
        <button
          onClick={() => setAnnual(v => !v)}
          style={{
            width: 44, height: 24, borderRadius: 12, border: "none",
            backgroundColor: annual ? "var(--althy-orange)" : S.surface2,
            cursor: "pointer", position: "relative", transition: "background 0.2s",
          }}
        >
          <div style={{
            position: "absolute", top: 3, left: annual ? 22 : 3,
            width: 18, height: 18, borderRadius: "50%",
            backgroundColor: "#fff",
            transition: "left 0.2s",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }} />
        </button>
        <span style={{ fontSize: 13, color: annual ? S.text : S.text3, fontWeight: annual ? 600 : 400 }}>
          Annuel <span style={{ color: "var(--althy-green)", fontWeight: 700 }}>−20%</span>
        </span>
      </div>

      {/* Plan cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 48 }}>
        {PLANS.map(plan => {
          const price = annual && plan.price > 0 ? Math.round(plan.price * 0.8) : plan.price;
          const isCurrent = plan.id === currentPlan;
          return (
            <div
              key={plan.id}
              style={{
                backgroundColor: S.surface,
                border: plan.highlight ? `2px solid var(--althy-orange)` : `1px solid ${S.border}`,
                borderRadius: 20, padding: 24, position: "relative",
                boxShadow: plan.highlight ? "0 8px 32px rgba(232,96,44,0.15)" : S.shadow,
              }}
            >
              {plan.highlight && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  backgroundColor: "var(--althy-orange)", color: "#fff",
                  padding: "3px 12px", borderRadius: 20,
                  fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                }}>
                  RECOMMANDÉ
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: plan.color }}>
                {plan.icon}
                <span style={{ fontWeight: 700, fontSize: 16 }}>{plan.name}</span>
              </div>

              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: S.text }}>{price > 0 ? `CHF ${price}` : "Gratuit"}</span>
                <span style={{ fontSize: 12, color: S.text3, marginLeft: 4 }}>{annual && plan.price > 0 ? "/mois · facturé annuellement" : plan.period}</span>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: S.text2 }}>
                    <Check size={14} color="var(--althy-orange)" style={{ flexShrink: 0, marginTop: 2 }} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                disabled={isCurrent}
                style={{
                  width: "100%", padding: "10px 0",
                  backgroundColor: isCurrent ? S.surface2 : plan.highlight ? "var(--althy-orange)" : S.surface2,
                  color: isCurrent ? S.text3 : plan.highlight ? "#fff" : S.text,
                  border: isCurrent ? `1px solid ${S.border}` : plan.highlight ? "none" : `1px solid ${S.border}`,
                  borderRadius: 10, fontSize: 13, fontWeight: 600,
                  cursor: isCurrent ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {isCurrent ? "Plan actuel" : plan.cta}
                {!isCurrent && <ArrowRight size={14} />}
              </button>
              {!isCurrent && <p style={{ textAlign: "center", fontSize: 11, color: S.text3, margin: "6px 0 0" }}>{plan.note}</p>}
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      <div style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 20, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${S.border}` }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: S.text }}>Comparaison détaillée</h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: S.surface2 }}>
                <th style={{ padding: "12px 20px", textAlign: "left", fontSize: 12, fontWeight: 600, color: S.text3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Fonctionnalité</th>
                {["Starter", "Proprio", "Agence"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "center", fontSize: 12, fontWeight: 600, color: h === "Proprio" ? "var(--althy-orange)" : S.text3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES_COMPARE.map((row, i) => (
                <tr key={row.name} style={{ borderTop: `1px solid ${S.border}`, backgroundColor: i % 2 === 0 ? "transparent" : S.surface2 }}>
                  <td style={{ padding: "10px 20px", fontSize: 13, color: S.text2 }}>{row.name}</td>
                  {[row.starter, row.proprio, row.agence].map((val, j) => (
                    <td key={j} style={{ padding: "10px 16px", textAlign: "center", fontSize: 13, color: val === "✓" ? "var(--althy-green)" : val === "—" ? S.text3 : j === 1 ? "var(--althy-orange)" : S.text, fontWeight: val === "✓" || j === 1 ? 600 : 400 }}>
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Savings */}
      <div style={{
        marginTop: 32, padding: 24, borderRadius: 16,
        background: "linear-gradient(135deg, rgba(232,96,44,0.06), rgba(232,96,44,0.12))",
        border: "1px solid rgba(232,96,44,0.22)",
        display: "flex", alignItems: "center", gap: 20,
      }}>
        <div style={{ fontSize: 32 }}>💰</div>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: S.text }}>
            Économisez CHF 328/mois vs une régie
          </p>
          <p style={{ margin: 0, fontSize: 13, color: S.text3 }}>
            Une régie facture 8–12% du loyer en frais de gérance. Pour un loyer moyen CHF 1 800/mois, c&apos;est CHF 180–216/mois.
            Althy vous revient à CHF 29/mois. La différence reste dans votre poche.
          </p>
        </div>
      </div>
    </div>
  );
}
