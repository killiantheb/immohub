"use client";

/**
 * /app/candidatures — Phase 2 (marketplace publique).
 *
 * Doctrine §B.15 (CLAUDE.md) + docs/2-ROADMAP.md §2.4.5 :
 *   - Phase 1.0 = logiciel de gestion pure, locataires entrent par invitation
 *     du bailleur uniquement (pas de candidature spontanée, pas de scoring IA
 *     activé en écriture, pas de prélèvement CHF 45 owner fee).
 *   - Le module "Candidatures reçues" (annonces marketplace + scoring IA +
 *     owner_fee CHF 45) appartient à Phase 2.
 *
 * La suppression de l'entrée sidebar est traitée dans le Lot C (sidebar/header).
 * Cette page conserve son URL pour ne pas casser les liens externes / favoris
 * éventuels mais affiche un ComingSoon propre en palette Prussian (§B.4).
 *
 * Le code source précédent (UI scoring, prélèvement Stripe owner_fee, fetch
 * /marketplace/candidatures…) est conservé sous git history (commit Phase 2).
 */

import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";
import { C } from "@/lib/design-tokens";

export default function CandidaturesPage() {
  return (
    <div style={{ padding: "32px 24px", maxWidth: 720, margin: "0 auto" }}>
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: "48px 32px",
          textAlign: "center",
          boxShadow: C.shadow,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: C.prussianBg,
            border: `1px solid ${C.prussianBorder}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
          }}
        >
          <Sparkles size={24} color={C.prussian} />
        </div>

        <h1
          style={{
            margin: "0 0 10px",
            fontFamily: "var(--font-serif)",
            fontSize: 26,
            fontWeight: 400,
            color: C.text,
            letterSpacing: "-0.01em",
          }}
        >
          Candidatures locataires — Phase 2
        </h1>

        <p
          style={{
            margin: "0 auto 8px",
            fontSize: 14,
            color: C.text2,
            lineHeight: 1.6,
            maxWidth: 480,
          }}
        >
          La réception de candidatures spontanées avec scoring IA arrivera lors de
          l&apos;ouverture publique de la marketplace Althy (Phase 2).
        </p>
        <p
          style={{
            margin: "0 auto 24px",
            fontSize: 13,
            color: C.text3,
            lineHeight: 1.6,
            maxWidth: 480,
          }}
        >
          En Phase 1, les locataires entrent par invitation directe depuis la fiche
          d&apos;un bien (bouton « Inviter un locataire »).
        </p>

        <Link
          href="/app/biens"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 20px",
            borderRadius: 9,
            background: C.prussian,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={14} />
          Retour à mes biens
        </Link>
      </div>
    </div>
  );
}
