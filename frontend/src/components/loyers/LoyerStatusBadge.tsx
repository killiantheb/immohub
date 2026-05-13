/**
 * Badge statut loyer canonique W7 — Sprint 8 Lot D.
 *
 * Statuts canoniques `LoyerStatut` (cf `lib/api/loyers.ts`) :
 *   - en_attente : ambre (loyer pas encore reçu, échéance future ou date du jour)
 *   - recu       : vert (paiement reçu sur compte transit Althy)
 *   - reverse    : bleu (loyer reversé au bailleur, fin du cycle)
 *   - en_retard  : rouge (échéance dépassée, pas de réception)
 *   - conteste   : violet (litige en cours, gel des actions auto)
 *
 * Distinct du legacy `RentStatusBadge` (mappe `TransactionStatus`
 * paid/pending/late/cancelled — schéma `Paiement` historique). Conservé séparé
 * tant que le legacy n'est pas retiré (Lot B back).
 */

import { C } from "@/lib/design-tokens";
import { TYPO_BADGE } from "@/lib/typography";
import type { LoyerStatut } from "@/lib/api/loyers";

const CONFIG: Record<LoyerStatut, { label: string; color: string; bg: string }> = {
  en_attente: { label: "En attente", color: C.amber,    bg: C.amberBg    },
  recu:       { label: "Reçu",       color: C.green,    bg: C.greenBg    },
  reverse:    { label: "Reversé",    color: C.blue,     bg: C.blueBg     },
  en_retard:  { label: "En retard",  color: C.red,      bg: C.redBg      },
  conteste:   { label: "Contesté",   color: C.purple,   bg: C.purpleBg   },
};

export function LoyerStatusBadge({ statut }: { statut: LoyerStatut | string }) {
  const cfg = CONFIG[statut as LoyerStatut] ?? {
    label: statut,
    color: C.text2,
    bg: C.surface2,
  };
  return (
    <span style={{ ...TYPO_BADGE, color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}
