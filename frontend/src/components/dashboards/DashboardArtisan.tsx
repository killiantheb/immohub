// src/components/dashboards/DashboardArtisan.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Clock,
  Euro,
  FileText,
  Plus,
  Wrench,
} from "lucide-react";
import { useArtisanDashboard } from "@/lib/hooks/useDashboardData";
import {
  DC,
  DCard,
  DKpi,
  DRoleHeader,
  DSectionTitle,
  DEmptyState,
} from "@/components/dashboards/DashBoardShared";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCHF(n: number) {
  return `CHF ${n.toLocaleString("fr-CH")}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CH", {
    day: "numeric",
    month: "short",
  });
}

// ── Mock devis ────────────────────────────────────────────────────────────────
const DEVIS_MOCK = [
  {
    id: "1",
    client: "M. Dupont",
    travaux: "Plomberie salle de bain",
    montant: 1850,
    dateEnvoi: "2026-04-02",
    statut: "en attente",
  },
  {
    id: "2",
    client: "Mme Chabloz",
    travaux: "Peinture appartement 4p",
    montant: 3200,
    dateEnvoi: "2026-04-05",
    statut: "accepté",
  },
  {
    id: "3",
    client: "SCI Leman",
    travaux: "Électricité mise aux normes",
    montant: 4700,
    dateEnvoi: "2026-04-08",
    statut: "en attente",
  },
  {
    id: "4",
    client: "M. Favre",
    travaux: "Carrelage cuisine",
    montant: 2100,
    dateEnvoi: "2026-04-09",
    statut: "refusé",
  },
];

// ── Statut badge ──────────────────────────────────────────────────────────────
const STATUT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  "en attente": { label: "En attente", color: "#D97706", bg: "rgba(217,119,6,0.10)" },
  "accepté":    { label: "Accepté",    color: "#16A34A", bg: "rgba(22,163,74,0.10)" },
  "refusé":     { label: "Refusé",     color: "#DC2626", bg: "rgba(220,38,38,0.10)" },
};

function StatutBadge({ statut }: { statut: string }) {
  const s = STATUT_MAP[statut] ?? { label: statut, color: DC.muted, bg: DC.border };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 9px",
        borderRadius: 20,
        color: s.color,
        background: s.bg,
      }}
    >
      {s.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DashboardArtisan
// ══════════════════════════════════════════════════════════════════════════════
interface Props {
  firstName: string;
}

export function DashboardArtisan({ firstName }: Props) {
  const [clientInput, setClientInput] = useState("");
  const [montantInput, setMontantInput] = useState("");

  const { isLoading, chantiersEnCours, metrics } = useArtisanDashboard();

  const initials = firstName ? firstName.slice(0, 2).toUpperCase() : "AR";

  const kpiCA = metrics.factureeMois;
  const kpiDevisAttente = DEVIS_MOCK.filter((d) => d.statut === "en attente").length;
  const kpiChantiers = isLoading ? 0 : (chantiersEnCours.length || 2);
  const kpiFactures = 3;

  return (
    <div style={{ minHeight: "100vh", background: DC.bg }}>
      <DRoleHeader role="artisan" initials={initials} />

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
        <p style={{ fontSize: 14, color: DC.muted }}>
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
        <DKpi
          icon={Euro}
          iconColor="#16A34A"
          iconBg="rgba(22,163,74,0.10)"
          value={fmtCHF(kpiCA)}
          label="CA ce mois"
          sub="Facturé et encaissé"
          trend="up"
        />
        <DKpi
          icon={Clock}
          iconColor="#D97706"
          iconBg="rgba(217,119,6,0.10)"
          value={String(kpiDevisAttente)}
          label="Devis en attente"
          sub="Réponse du client"
          trend="neutral"
        />
        <DKpi
          icon={Wrench}
          iconColor="#16A34A"
          iconBg="rgba(22,163,74,0.10)"
          value={String(kpiChantiers)}
          label="Chantiers actifs"
          sub="En cours"
          trend="neutral"
        />
        <DKpi
          icon={FileText}
          iconColor={DC.orange}
          iconBg="rgba(232,96,44,0.10)"
          value={String(kpiFactures)}
          label="Factures à envoyer"
          sub="En attente d'envoi"
          trend="neutral"
        />
      </div>

      {/* Devis en attente */}
      <div style={{ marginBottom: "2rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <DSectionTitle style={{ marginBottom: 0 }}>Devis en attente</DSectionTitle>
          <Link
            href="/app/artisans"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              color: DC.orange,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            <Plus size={13} />
            Nouveau devis
          </Link>
        </div>

        {DEVIS_MOCK.length === 0 ? (
          <DEmptyState
            icon={Briefcase}
            title="Aucun devis en cours"
            subtitle="Créez votre premier devis en 2 clics."
            ctaLabel="Nouveau devis"
            ctaHref="/app/artisans"
          />
        ) : (
          <DCard style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "rgba(26,22,18,0.02)" }}>
                    {["Client", "Travaux", "Montant", "Envoyé le", "Statut"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "10px 16px",
                          fontSize: 11,
                          fontWeight: 700,
                          color: DC.muted,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          borderBottom: `1px solid ${DC.border}`,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEVIS_MOCK.slice(0, 5).map((d, i) => (
                    <tr
                      key={d.id}
                      style={{
                        borderBottom:
                          i < Math.min(DEVIS_MOCK.length, 5) - 1
                            ? `1px solid ${DC.border}`
                            : "none",
                      }}
                    >
                      <td style={{ padding: "11px 16px", fontWeight: 600, color: DC.text }}>
                        {d.client}
                      </td>
                      <td style={{ padding: "11px 16px", color: DC.muted }}>
                        {d.travaux}
                      </td>
                      <td style={{ padding: "11px 16px", fontWeight: 600, color: DC.text }}>
                        {fmtCHF(d.montant)}
                      </td>
                      <td style={{ padding: "11px 16px", color: DC.muted }}>
                        {fmtDate(d.dateEnvoi)}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <StatutBadge statut={d.statut} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DCard>
        )}
      </div>

      {/* Facturation rapide */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Facturation rapide</DSectionTitle>
        <DCard>
          <p style={{ fontSize: 14, color: DC.muted, marginBottom: "1rem" }}>
            Générez une facture et envoyez-la directement par email via Althy.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              marginBottom: "0.75rem",
            }}
          >
            <input
              type="text"
              value={clientInput}
              onChange={(e) => setClientInput(e.target.value)}
              placeholder="Nom du client"
              style={{
                padding: "9px 14px",
                borderRadius: 10,
                border: `1px solid ${DC.border}`,
                fontSize: 13,
                color: DC.text,
                background: DC.bg,
                outline: "none",
              }}
            />
            <input
              type="number"
              value={montantInput}
              onChange={(e) => setMontantInput(e.target.value)}
              placeholder="Montant CHF"
              style={{
                padding: "9px 14px",
                borderRadius: 10,
                border: `1px solid ${DC.border}`,
                fontSize: 13,
                color: DC.text,
                background: DC.bg,
                outline: "none",
              }}
            />
          </div>
          <button
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 0",
              borderRadius: 10,
              border: "none",
              background: DC.orange,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              marginBottom: "0.5rem",
            }}
          >
            <FileText size={14} />
            Générer la facture
          </button>
          <p style={{ fontSize: 11, color: DC.muted, textAlign: "center" }}>
            Envoyée par email automatiquement via Althy
          </p>
        </DCard>
      </div>

      {/* Bottom link */}
      <div style={{ paddingBottom: "2rem" }}>
        <Link
          href="/app/artisans"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: DC.orange,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Voir tous mes devis <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
