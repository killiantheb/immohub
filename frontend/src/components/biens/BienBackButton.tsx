"use client";

/**
 * Bouton "Retour à la fiche bien" affiché en haut des sous-pages
 * `/app/biens/[id]/X` (locataire, finances, documents, etc.).
 *
 * Sans cette nav, l'utilisateur doit repasser par sidebar > Biens >
 * re-cliquer le bien pour revenir à la vue d'ensemble.
 *
 * Variantes :
 *   - `default` : "Retour à <adresse du bien>"
 *   - `compact` : "Retour" (pour les sous-sous-pages historique/[loc_id])
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useBien } from "@/lib/hooks/useBiens";
import { C } from "@/lib/design-tokens";

interface Props {
  bienId: string;
  variant?: "default" | "compact";
}

export function BienBackButton({ bienId, variant = "default" }: Props) {
  const { data: bien } = useBien(bienId);

  return (
    <div style={{ marginBottom: 12 }}>
      <Link
        href={`/app/biens/${bienId}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: C.text2,
          textDecoration: "none",
          padding: "6px 10px",
          borderRadius: 8,
          border: `1px solid ${C.border}`,
          background: C.surface,
          transition: "border-color 0.15s, color 0.15s",
        }}
      >
        <ArrowLeft size={14} />
        {variant === "compact" ? (
          <span>Retour</span>
        ) : (
          <span>
            Retour à <strong style={{ color: C.text }}>{bien?.adresse || "la fiche bien"}</strong>
          </span>
        )}
      </Link>
    </div>
  );
}
