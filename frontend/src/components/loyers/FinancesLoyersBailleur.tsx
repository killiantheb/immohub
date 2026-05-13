/**
 * Timeline loyers mensuelle bailleur — Sprint 8 Lot D (Frontend Loyer W7).
 *
 * Affiche tous les loyers de l'année sélectionnée (12 lignes max), avec :
 *   - statut canonique (badge W7)
 *   - bouton "Marquer reçu" si en_attente | en_retard
 *   - bouton "Marquer reversé" si recu (après réception sur compte transit Althy)
 *   - QR-référence visible (Réf : …) si présente
 *   - sélecteur d'année (← / →)
 *   - bouton "Générer N mois manquants" si l'année est partielle
 *   - total reçu / total annuel en bas
 *
 * Doctrine §B.10 : aucun statut inventé. On affiche uniquement les loyers
 * retournés par le back. Si aucun loyer pour l'année → Empty + CTA générer.
 */

"use client";

import { useMemo, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { btnP, btnS, Card, Empty, fmtCHF, Skel } from "@/app/app/(dashboard)/biens/[id]/_shared";
import { C } from "@/lib/design-tokens";
import { TYPO_CAPTION, TYPO_LABEL_SMALL } from "@/lib/typography";
import {
  useGenererLoyersAnnee,
  useLoyersBien,
  useMarkLoyerStatut,
} from "@/lib/hooks/useLoyers";
import type { LoyerStatut, LoyerTransaction } from "@/lib/api/loyers";
import { LoyerStatusBadge } from "./LoyerStatusBadge";

function moisLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-CH", { month: "long", year: "numeric" });
}

function moisYear(iso: string): number {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 0 : d.getFullYear();
}

interface LoyerRowProps {
  loyer: LoyerTransaction;
  onMarkRecu: () => void;
  onMarkReverse: () => void;
  isPending: boolean;
}

function LoyerRow({ loyer, onMarkRecu, onMarkReverse, isPending }: LoyerRowProps) {
  const canMarkRecu = loyer.statut === "en_attente" || loyer.statut === "en_retard";
  const canMarkReverse = loyer.statut === "recu";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 140px 130px 1fr",
        gap: 12,
        padding: "12px 14px",
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
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
        {fmtCHF(loyer.montant_total)}
      </div>
      <LoyerStatusBadge statut={loyer.statut} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {canMarkRecu && (
          <button
            type="button"
            onClick={onMarkRecu}
            disabled={isPending}
            style={{ ...btnS, opacity: isPending ? 0.6 : 1 }}
          >
            Marquer reçu
          </button>
        )}
        {canMarkReverse && (
          <button
            type="button"
            onClick={onMarkReverse}
            disabled={isPending}
            style={{ ...btnS, opacity: isPending ? 0.6 : 1 }}
          >
            Marquer reversé
          </button>
        )}
      </div>
    </div>
  );
}

export function FinancesLoyersBailleur({ bienId }: { bienId: string }) {
  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState(currentYear);

  const { data: loyers, isLoading, isError } = useLoyersBien(bienId);
  const markMutation = useMarkLoyerStatut(bienId);
  const genererMutation = useGenererLoyersAnnee(bienId);

  const loyersAnnee = useMemo<LoyerTransaction[]>(() => {
    return (loyers ?? [])
      .filter((l) => moisYear(l.mois_concerne) === annee)
      .sort(
        (a, b) =>
          new Date(a.mois_concerne).getTime() - new Date(b.mois_concerne).getTime(),
      );
  }, [loyers, annee]);

  const totalAnnee = loyersAnnee.reduce((s, l) => s + Number(l.montant_total || 0), 0);
  const totalRecu = loyersAnnee
    .filter((l) => l.statut === "recu" || l.statut === "reverse")
    .reduce((s, l) => s + Number(l.montant_total || 0), 0);
  const missingMonths = Math.max(0, 12 - loyersAnnee.length);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Skel h={56} />
        <Skel h={320} />
      </div>
    );
  }

  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => setAnnee((y) => y - 1)}
            style={btnS}
            aria-label="Année précédente"
          >
            ← {annee - 1}
          </button>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 18,
              fontWeight: 500,
              color: C.text,
              margin: "0 8px",
              letterSpacing: "0.01em",
            }}
          >
            Loyers {annee}
          </h2>
          <button
            type="button"
            onClick={() => setAnnee((y) => y + 1)}
            style={btnS}
            aria-label="Année suivante"
          >
            {annee + 1} →
          </button>
        </div>

        {missingMonths > 0 && (
          <button
            type="button"
            onClick={() => genererMutation.mutate(annee)}
            disabled={genererMutation.isPending}
            style={{ ...btnP, opacity: genererMutation.isPending ? 0.6 : 1 }}
          >
            {genererMutation.isPending ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Génération…
              </>
            ) : (
              <>Générer {annee} ({missingMonths} mois manquants)</>
            )}
          </button>
        )}
      </div>

      {isError ? (
        <Empty
          icon={TrendingUp}
          title="Impossible de charger les loyers"
          sub="Réessayez dans quelques instants."
        />
      ) : loyersAnnee.length === 0 ? (
        <Empty
          icon={TrendingUp}
          title={`Aucun loyer pour ${annee}`}
          sub={`Cliquez sur « Générer ${annee} » pour créer les 12 mensualités.`}
        />
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {loyersAnnee.map((loyer) => (
            <LoyerRow
              key={loyer.id}
              loyer={loyer}
              onMarkRecu={() =>
                markMutation.mutate({ id: loyer.id, statut: "recu" as LoyerStatut })
              }
              onMarkReverse={() =>
                markMutation.mutate({ id: loyer.id, statut: "reverse" as LoyerStatut })
              }
              isPending={markMutation.isPending}
            />
          ))}
        </div>
      )}

      {loyersAnnee.length > 0 && (
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ ...TYPO_LABEL_SMALL, color: C.text3, margin: 0 }}>Total reçu {annee}</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.green, margin: "2px 0 0" }}>
              {fmtCHF(totalRecu)}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ ...TYPO_LABEL_SMALL, color: C.text3, margin: 0 }}>Total annuel</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: "2px 0 0" }}>
              {fmtCHF(totalAnnee)}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
