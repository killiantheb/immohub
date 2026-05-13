/**
 * "Mes paiements" — vue locataire (Sprint 8 Lot D Frontend Loyer W7).
 *
 * Remplace l'ancien placeholder ComingCard sur /app/mon-bien. Read-only.
 *
 * Tri : mois descendant (le mois courant en haut). Liste tronquée à 24 derniers
 * mois pour éviter scroll infini sur baux longue durée.
 *
 * Doctrine §B.10 : si la liste est vide on dit "Aucun loyer enregistré pour le
 * moment" — pas de chiffre fabriqué.
 */

"use client";

import { useMemo } from "react";
import { Banknote } from "lucide-react";
import { C } from "@/lib/design-tokens";
import { TYPO_CAPTION } from "@/lib/typography";
import { useMyLoyers } from "@/lib/hooks/useLoyers";
import type { LoyerTransaction } from "@/lib/api/loyers";
import { LoyerStatusBadge } from "./LoyerStatusBadge";

function moisLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
}

function formatCHF(n: number): string {
  return `CHF ${Number(n).toLocaleString("fr-CH")}`;
}

function MyLoyerRow({ loyer }: { loyer: LoyerTransaction }) {
  const recu = loyer.statut === "recu" || loyer.statut === "reverse";
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        background: recu ? C.greenBg : C.surface,
        border: `1px solid ${recu ? C.greenBg : C.border}`,
        display: "grid",
        gridTemplateColumns: "1fr 130px 120px",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div>
        <strong style={{ color: C.text, fontSize: 14 }}>{moisLabel(loyer.mois_concerne)}</strong>
        {loyer.qr_reference && (
          <div style={{ ...TYPO_CAPTION, color: C.text3, marginTop: 2 }}>
            Réf : {loyer.qr_reference}
          </div>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
        {formatCHF(loyer.montant_total)}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <LoyerStatusBadge statut={loyer.statut} />
      </div>
    </div>
  );
}

export function MesPaiementsSection() {
  const { data, isLoading, isError } = useMyLoyers();

  const sorted = useMemo<LoyerTransaction[]>(() => {
    return (data ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b.mois_concerne).getTime() - new Date(a.mois_concerne).getTime(),
      )
      .slice(0, 24);
  }, [data]);

  return (
    <section
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 20,
        boxShadow: C.shadow,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: C.prussianBg,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Banknote size={18} style={{ color: C.prussian }} />
        </div>
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 16,
            fontWeight: 500,
            color: C.text,
            margin: 0,
          }}
        >
          Mes paiements
        </h3>
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gap: 8 }}>
          <Skel h={48} />
          <Skel h={48} />
          <Skel h={48} />
        </div>
      ) : isError ? (
        <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>
          Impossible de charger vos paiements pour le moment.
        </p>
      ) : sorted.length === 0 ? (
        <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>
          Aucun loyer enregistré pour le moment.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {sorted.map((loyer) => (
            <MyLoyerRow key={loyer.id} loyer={loyer} />
          ))}
        </div>
      )}
    </section>
  );
}

function Skel({ h }: { h: number }) {
  return (
    <div
      style={{
        height: h,
        borderRadius: 10,
        background: C.border,
        opacity: 0.5,
      }}
    />
  );
}
