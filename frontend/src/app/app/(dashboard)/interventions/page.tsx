"use client";

/**
 * /app/interventions — Vue agrégée "Mes interventions" (proprio_solo).
 *
 * Phase 1.0 = gestion pure. La marketplace artisans (RFQ + comparaison IA + commission
 * Althy 10 %) est code dormant Phase 2 (cf CLAUDE.md §B.15 + docs/2-ROADMAP.md §2.4.5).
 * Cette page liste UNIQUEMENT les interventions réelles créées depuis la fiche bien
 * (`/biens/{id}` → onglet Interventions), via `GET /api/v1/interventions-althy/`.
 *
 * Les onglets RFQ (Tous/Publiés/Devis reçus/Acceptés/En cours/Terminés), la modale
 * "Comparer IA" et les CTAs "Décrire des travaux → /app/artisans/devis" ont été
 * retirés. Le code RFQ backend/frontend reste accessible via URL directe pour
 * réactivation Phase 2.
 */

import { Suspense } from "react";
import Link from "next/link";
import { Wrench, MapPin, Loader2, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Intervention, InterventionStatut, InterventionUrgence } from "@/lib/types";
import { BienContextBanner } from "@/components/biens/BienContextBanner";
import { C } from "@/lib/design-tokens";

// ── Config statuts / urgences ────────────────────────────────────────────────

const STATUT_CONFIG: Record<InterventionStatut, { label: string; bg: string; fg: string }> = {
  nouveau:   { label: "Nouveau",    bg: C.blueBg,   fg: C.blue },
  planifie:  { label: "Planifié",   bg: C.amberBg,  fg: C.amber },
  en_cours:  { label: "En cours",   bg: C.amberBg,  fg: C.amber },
  resolu:    { label: "Résolu",     bg: C.greenBg,  fg: C.green },
};

const URGENCE_CONFIG: Record<InterventionUrgence, { label: string; fg: string }> = {
  faible:       { label: "Faible",         fg: C.text3 },
  moderee:      { label: "Modérée",        fg: C.blue },
  urgente:      { label: "Urgente",        fg: C.amber },
  tres_urgente: { label: "Très urgente",   fg: C.red },
};

// ── Mes interventions (vue agrégée) ──────────────────────────────────────────

interface InterventionWithBien extends Intervention {
  bien?: {
    id: string;
    adresse?: string | null;
    ville?: string | null;
  };
}

function MesInterventions() {
  const { data, isLoading, error } = useQuery<InterventionWithBien[]>({
    queryKey: ["interventions", "mine", "aggregated"],
    queryFn: async () => {
      const { data } = await api.get<InterventionWithBien[]>("/interventions-althy/", {
        params: { size: 100 },
      });
      return data;
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
        <Loader2 size={24} style={{ color: C.prussian, animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 16, borderRadius: 10, background: C.redBg,
          border: `1px solid ${C.red}`, color: C.red, fontSize: 13,
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <AlertTriangle size={14} />
        Impossible de charger vos interventions. Réessayez plus tard.
      </div>
    );
  }

  const items = data ?? [];

  if (items.length === 0) {
    return (
      <div
        style={{
          textAlign: "center", padding: "56px 24px",
          border: `2px dashed ${C.border}`, borderRadius: 16,
          background: C.surface,
        }}
      >
        <Wrench size={36} style={{ color: C.text3, margin: "0 auto 12px" }} />
        <p style={{ fontWeight: 600, color: C.text2, margin: "0 0 4px", fontSize: 15 }}>
          Aucune intervention enregistrée
        </p>
        <p style={{ fontSize: 13, color: C.text3, margin: "0 0 16px" }}>
          Les interventions sont créées depuis la fiche d&apos;un bien (onglet Interventions).
        </p>
        <Link
          href="/app/biens"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 18px", borderRadius: 9,
            background: C.prussian, color: "#fff",
            fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}
        >
          Voir mes biens
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((inter) => {
        const statut = STATUT_CONFIG[inter.statut] ?? STATUT_CONFIG.nouveau;
        const urgence = URGENCE_CONFIG[inter.urgence] ?? URGENCE_CONFIG.faible;
        const lieu = inter.bien
          ? [inter.bien.adresse, inter.bien.ville].filter(Boolean).join(" · ")
          : null;
        return (
          <Link
            key={inter.id}
            href={`/app/biens/${inter.bien_id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 18,
                boxShadow: C.shadow,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                cursor: "pointer",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>
                    {inter.titre}
                  </span>
                  <span
                    style={{
                      padding: "2px 10px", borderRadius: 20,
                      fontSize: 11, fontWeight: 600,
                      background: statut.bg, color: statut.fg,
                    }}
                  >
                    {statut.label}
                  </span>
                  <span style={{ fontSize: 11, color: urgence.fg, fontWeight: 600 }}>
                    {urgence.label}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 12, color: C.text3, flexWrap: "wrap" }}>
                  {lieu && (
                    <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <MapPin size={11} />
                      {lieu}
                    </span>
                  )}
                  {inter.date_signalement && (
                    <span>
                      Signalée le {new Date(inter.date_signalement).toLocaleDateString("fr-CH")}
                    </span>
                  )}
                  {inter.cout != null && (
                    <span style={{ fontWeight: 600, color: C.text2 }}>
                      CHF {inter.cout.toLocaleString("fr-CH")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InterventionsPage() {
  return (
    <div style={{ padding: "32px 24px", maxWidth: 900, margin: "0 auto" }}>
      {/* Banner contextuel — affiché uniquement si ?bien_id=X (lien fiche bien). */}
      <Suspense fallback={null}>
        <BienContextBanner />
      </Suspense>

      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 28, fontWeight: 700, color: C.text,
            margin: "0 0 6px", letterSpacing: "-0.02em",
          }}
        >
          Mes interventions
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: C.text3 }}>
          Suivi des interventions enregistrées sur vos biens.
        </p>
      </div>

      <MesInterventions />
    </div>
  );
}
