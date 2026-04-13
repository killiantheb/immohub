// src/components/dashboards/DashboardTenant.tsx
"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Download,
  FileText,
  Home,
  Layers,
  Send,
  Wrench,
} from "lucide-react";
import { useTenantDashboard } from "@/lib/hooks/useDashboardData";
import {
  DC,
  DCard,
  DKpi,
  DRoleHeader,
  DTopNav,
  DSectionTitle,
  DEmptyState,
} from "@/components/dashboards/DashBoardShared";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCHF(n: number) {
  return `CHF ${n.toLocaleString("fr-CH")}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Mock documents ────────────────────────────────────────────────────────────
const DOCS_MOCK = [
  { id: "1", nom: "Contrat de bail",          date: "2024-03-01", type: "bail" },
  { id: "2", nom: "Quittance mars 2026",       date: "2026-03-01", type: "quittance" },
  { id: "3", nom: "Quittance février 2026",    date: "2026-02-01", type: "quittance" },
  { id: "4", nom: "Quittance janvier 2026",    date: "2026-01-01", type: "quittance" },
  { id: "5", nom: "Attestation assurance RC",  date: "2026-01-10", type: "assurance" },
  { id: "6", nom: "État des lieux entrée",     date: "2024-03-01", type: "edl" },
];

// ── Categories problème ───────────────────────────────────────────────────────
const CATEGORIES = [
  { value: "fuite",        label: "Fuite d'eau" },
  { value: "electricite",  label: "Électricité" },
  { value: "chauffage",    label: "Chauffage" },
  { value: "autre",        label: "Autre" },
];

// ══════════════════════════════════════════════════════════════════════════════
// DashboardTenant
// ══════════════════════════════════════════════════════════════════════════════
interface Props {
  firstName: string;
}

export function DashboardTenant({ firstName }: Props) {
  const [probleme, setProbleme] = useState("");
  const [categorie, setCategorie] = useState("autre");

  const { isLoading, locataire, bien, documents, paiementMois } = useTenantDashboard();

  const initials = firstName ? firstName.slice(0, 2).toUpperCase() : "LO";

  // KPI values
  const kpiLoyer = locataire?.loyer
    ? Number(locataire.loyer)
    : bien?.loyer
    ? Number(bien.loyer)
    : 0;

  const kpiEcheance = (paiementMois as { date_echeance?: string | null } | null)?.date_echeance ?? locataire?.date_sortie ?? null;
  const kpiInterventions = 0; // Placeholder
  const kpiDocuments = documents.length || DOCS_MOCK.length;

  // Docs to show
  const docsAffichees = documents.length > 0
    ? documents.slice(0, 6).map((d) => ({
        id: d.id,
        nom: d.type ?? "Document",
        date: d.date_document ?? d.created_at ?? null,
        type: d.type ?? "autre",
      }))
    : DOCS_MOCK;

  return (
    <div style={{ minHeight: "100vh", background: DC.bg }}>
      <DTopNav />
          <DRoleHeader role="locataire" initials={initials} />

      {/* Greeting */}
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 400,
            fontFamily: DC.serif,
            color: DC.text,
            marginBottom: 4,
            letterSpacing: "0.01em",
          }}
        >
          Bonjour{firstName ? `, ${firstName}` : ""}
        </h1>
        <p style={{ fontSize: 14, color: DC.muted }} suppressHydrationWarning>
          {new Date().toLocaleDateString("fr-CH", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* 4 KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <DCard key={i}>
              <div style={{ height: 80, borderRadius: 8, background: DC.border, opacity: 0.5 }} />
            </DCard>
          ))
        ) : (
          <>
            <DKpi
              icon={Home}
              iconColor="#64748B"
              iconBg="rgba(100,116,139,0.10)"
              value={kpiLoyer > 0 ? fmtCHF(kpiLoyer) : "—"}
              label="Loyer mensuel"
              sub="Charges comprises"
              trend="neutral"
            />
            <DKpi
              icon={Calendar}
              iconColor={DC.orange}
              iconBg="rgba(232,96,44,0.10)"
              value={fmtDate(kpiEcheance)}
              label="Prochaine échéance"
              sub="Date de paiement"
              trend="neutral"
            />
            <DKpi
              icon={Wrench}
              iconColor={kpiInterventions > 0 ? "#D97706" : "var(--althy-green)"}
              iconBg={kpiInterventions > 0 ? "rgba(217,119,6,0.10)" : "var(--althy-green-bg)"}
              value={String(kpiInterventions)}
              label="Interventions actives"
              sub="En cours"
              trend="neutral"
            />
            <DKpi
              icon={FileText}
              iconColor="#2563EB"
              iconBg="rgba(37,99,235,0.10)"
              value={String(kpiDocuments)}
              label="Documents"
              sub="Disponibles"
              trend="neutral"
            />
          </>
        )}
      </div>

      {/* Mes documents */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Mes documents</DSectionTitle>
        {docsAffichees.length === 0 ? (
          <DEmptyState
            icon={FileText}
            title="Aucun document"
            subtitle="Vos documents apparaîtront ici."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {docsAffichees.map((doc) => (
              <DCard
                key={doc.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "0.85rem 1.25rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: "var(--althy-red-bg)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <FileText size={15} style={{ color: "var(--althy-red)" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: DC.text, marginBottom: 1 }}>
                      {doc.nom}
                    </p>
                    <p style={{ fontSize: 11, color: DC.muted }}>
                      {fmtDate(doc.date)}
                    </p>
                  </div>
                </div>
                <button
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: `1px solid ${DC.border}`,
                    background: DC.surface,
                    color: DC.muted,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <Download size={12} />
                  Télécharger
                </button>
              </DCard>
            ))}
          </div>
        )}
      </div>

      {/* Signaler un problème */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Signaler un problème</DSectionTitle>
        <DCard>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              style={{
                padding: "9px 14px",
                borderRadius: 10,
                border: `1px solid ${DC.border}`,
                fontSize: 13,
                color: DC.text,
                background: DC.bg,
                outline: "none",
                cursor: "pointer",
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={probleme}
            onChange={(e) => setProbleme(e.target.value)}
            placeholder="Décrivez le problème en quelques mots…"
            rows={3}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${DC.border}`,
              fontSize: 13,
              color: DC.text,
              background: DC.bg,
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
              marginBottom: "0.75rem",
              boxSizing: "border-box",
            }}
          />
          <button
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: DC.orange,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Send size={14} />
            Envoyer à mon propriétaire
          </button>
        </DCard>
      </div>

      {/* Votre logement */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Votre logement</DSectionTitle>
        <DCard>
          {isLoading ? (
            <div style={{ height: 60, borderRadius: 8, background: DC.border, opacity: 0.5 }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={14} style={{ color: DC.muted }} />
                <span style={{ fontSize: 13, color: DC.muted }}>Adresse</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: DC.text, marginLeft: "auto" }}>
                  {bien?.adresse ? `${bien.adresse}, ${bien.ville}` : "—"}
                </span>
              </div>
              <div
                style={{
                  height: 1,
                  background: DC.border,
                  margin: "0.25rem 0",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Home size={14} style={{ color: DC.muted }} />
                <span style={{ fontSize: 13, color: DC.muted }}>Propriétaire</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: DC.text, marginLeft: "auto" }}>
                  {"—"}
                </span>
              </div>
              <div
                style={{
                  height: 1,
                  background: DC.border,
                  margin: "0.25rem 0",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={14} style={{ color: DC.muted }} />
                <span style={{ fontSize: 13, color: DC.muted }}>Prochain loyer</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: DC.text, marginLeft: "auto" }}>
                  {kpiLoyer > 0 ? fmtCHF(kpiLoyer) : "—"}
                  {kpiEcheance ? ` · le ${fmtDate(kpiEcheance)}` : ""}
                </span>
              </div>
            </div>
          )}
        </DCard>
      </div>
    </div>
  );
}
