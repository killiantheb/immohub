"use client";

/**
 * Banner contextuel affiché en haut des modules globaux (`/app/candidatures`,
 * `/app/finances`, `/app/interventions`, `/app/documents`, `/app/communication`)
 * lorsqu'un `?bien_id=X` est présent dans l'URL.
 *
 * Sans ce banner, l'utilisateur clique "Recevoir candidatures" depuis la
 * fiche bien et arrive sur la page CRM globale sans aucune indication
 * "on est en train de voir les données DU BIEN X".
 *
 * Comportement :
 *   - Pas de `?bien_id=` → return null (banner caché)
 *   - `?bien_id=X` présent → affiche le banner avec :
 *     * adresse du bien
 *     * bouton "Fiche bien" (retour `/app/biens/X`)
 *     * bouton "Tout voir" (retire `bien_id` mais garde les autres params)
 */

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { ArrowLeft, Building2, X } from "lucide-react";
import { useBien } from "@/lib/hooks/useBiens";
import { C } from "@/lib/design-tokens";

interface Props {
  /** Override optionnel — sinon lit `?bien_id=` dans l'URL. */
  bienId?: string;
}

export function BienContextBanner({ bienId: bienIdProp }: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const bienId = bienIdProp ?? searchParams.get("bien_id") ?? null;
  const { data: bien } = useBien(bienId ?? "");

  if (!bienId || !bien) return null;

  // URL "Tout voir" : retire bien_id mais garde les autres params (statut, etc.).
  const params = new URLSearchParams(searchParams.toString());
  params.delete("bien_id");
  const exitUrl = params.toString() ? `${pathname}?${params}` : pathname;

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${C.prussianBorder}`,
        background: `linear-gradient(90deg, ${C.prussianBg} 0%, ${C.surface} 100%)`,
        padding: 14,
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      {/* GAUCHE — info bien */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: C.prussian,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Building2 size={20} style={{ color: "#fff" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: 11,
              color: C.text3,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 0 2px",
            }}
          >
            Vue contextuelle
          </p>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 15,
              color: C.text,
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {bien.adresse}
          </p>
          <p style={{ fontSize: 12, color: C.text3, margin: 0 }}>
            {bien.cp ? `${bien.cp} ` : ""}
            {bien.ville}
          </p>
        </div>
      </div>

      {/* DROITE — actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <Link
          href={`/app/biens/${bienId}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            fontSize: 13,
            borderRadius: 8,
            border: `1px solid ${C.prussianBorder}`,
            color: C.prussian,
            background: C.surface,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} />
          <span>Fiche bien</span>
        </Link>
        <Link
          href={exitUrl}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            fontSize: 13,
            color: C.text3,
            textDecoration: "none",
          }}
          title="Voir tous les biens (retire le filtre)"
        >
          <X size={14} />
          <span>Tout voir</span>
        </Link>
      </div>
    </div>
  );
}
