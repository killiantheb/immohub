"use client";

/**
 * Bienvenue locataire — page d'accueil post-invitation (Sprint 1B).
 *
 * Affichée juste après la création du compte locataire via /invite/[token].
 * Présente la checklist des documents requis + objectif 100%.
 *
 * Redirect intelligent :
 *   - Au mount, on fetch la progression actuelle (via /locataires/me + /dossier).
 *   - Si progression > 0 (déjà visité cette page une fois) → redirect direct vers
 *     /app/mon-bien/dossier (UX : on ne fait pas attendre le user 2 fois).
 *   - Sinon → affiche la page bienvenue avec CTA « Commencer mon dossier ».
 *
 * §B.4 palette stricte, §B.10 wording honnête.
 */

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Globe,
  IdCard,
  Loader2,
  Receipt,
  Scale,
  Shield,
  Wallet,
} from "lucide-react";

import { useDossierDocuments, useMyLocataire } from "@/lib/hooks/useDossierDocuments";
import { C } from "@/lib/design-tokens";


const CHECKLIST: ReadonlyArray<{ icon: React.ElementType; label: string }> = [
  { icon: ClipboardCheck, label: "Renseignements de base (employeur, salaire)" },
  { icon: IdCard,         label: "Pièce d'identité" },
  { icon: Globe,          label: "Permis de séjour (si étranger)" },
  { icon: Briefcase,      label: "Contrat de travail ou promesse d'embauche" },
  { icon: Receipt,        label: "3 dernières fiches de salaire" },
  { icon: Shield,         label: "Assurance Responsabilité Civile" },
  { icon: Wallet,         label: "Preuve de caution" },
  { icon: Scale,          label: "Extrait des poursuites (< 3 mois)" },
];


export default function BienvenueLocatairePage() {
  const router = useRouter();
  const myLocataireQuery = useMyLocataire();
  const dossierQuery = useDossierDocuments(myLocataireQuery.data?.id);

  // Redirect intelligent : si dossier déjà entamé → /app/mon-bien/dossier
  useEffect(() => {
    if (dossierQuery.data && dossierQuery.data.progression > 0) {
      router.replace("/app/mon-bien/dossier");
    }
  }, [dossierQuery.data, router]);

  if (myLocataireQuery.isLoading || dossierQuery.isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Loader2 size={28} style={{ color: C.prussian, animation: "spin 1s linear infinite" }} />
        <p style={{ fontSize: 13, color: C.text3, marginTop: 12 }}>Préparation de votre espace…</p>
      </div>
    );
  }

  // Si pas de locataire (cas drift DB) → fallback gracieux
  if (myLocataireQuery.isError) {
    return (
      <div style={{ textAlign: "center", padding: 60, maxWidth: 520, margin: "0 auto" }}>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 22,
            color: C.text,
            fontWeight: 400,
            margin: "0 0 12px",
          }}
        >
          Votre logement n&apos;est pas encore lié
        </h1>
        <p style={{ fontSize: 14, color: C.text2, margin: "0 0 24px", lineHeight: 1.5 }}>
          Si vous venez de créer votre compte via une invitation, attendez
          quelques secondes puis rafraîchissez. Sinon contactez votre bailleur.
        </p>
        <Link
          href="/app/mon-bien"
          style={{
            display: "inline-block",
            padding: "10px 22px",
            borderRadius: 10,
            background: C.prussian,
            color: "#fff",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Actualiser
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 24px 48px", maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          aria-hidden
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: C.greenBg,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <CheckCircle2 size={32} style={{ color: C.green }} />
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 28,
            color: C.text,
            margin: "0 0 8px",
            fontWeight: 400,
            letterSpacing: "0.01em",
          }}
        >
          Bienvenue chez Althy !
        </h1>
        <p style={{ fontSize: 15, color: C.text2, margin: 0, lineHeight: 1.5 }}>
          Votre compte locataire a été créé avec succès.
        </p>
      </div>

      {/* Checklist */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: "24px 28px",
          marginBottom: 20,
          boxShadow: C.shadow,
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.gold,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            margin: "0 0 14px",
          }}
        >
          ⚠️ Action requise
        </p>
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 19,
            color: C.text,
            margin: "0 0 12px",
            fontWeight: 500,
          }}
        >
          Pour finaliser votre location, vous devez fournir :
        </h2>

        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {CHECKLIST.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: C.surface2,
                  border: `1px solid ${C.border}`,
                }}
              >
                <Icon size={18} style={{ color: C.prussian, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: C.text }}>{item.label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Info bail + clés */}
      <div
        style={{
          background: C.prussianBg,
          border: `1px solid ${C.prussianBorder}`,
          borderRadius: 14,
          padding: "18px 22px",
          marginBottom: 20,
        }}
      >
        <p style={{ fontSize: 13, color: C.text, margin: "0 0 8px", lineHeight: 1.5 }}>
          <strong>📋 Important :</strong> Le bail vous sera envoyé pour signature{" "}
          <strong>uniquement après vérification</strong> de vos documents par votre
          bailleur.
        </p>
        <p style={{ fontSize: 13, color: C.text, margin: 0, lineHeight: 1.5 }}>
          Les clés vous seront remises <strong>après versement</strong> du premier
          loyer et de la caution.
        </p>
      </div>

      {/* Objectif (Sprint 1B.1 : 100% strict + mention équivalents) */}
      <div
        style={{
          padding: "20px 24px",
          marginBottom: 24,
          background: C.goldBg,
          border: `1px solid ${C.gold}55`,
          borderRadius: 12,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 17,
            color: C.text,
            margin: "0 0 8px",
            fontWeight: 500,
          }}
        >
          🎯 Objectif : compléter votre dossier à 100%
        </p>
        <p style={{ fontSize: 13, color: C.text2, margin: "0 0 12px", lineHeight: 1.5 }}>
          Pour finaliser votre location, tous les documents doivent être présents.
        </p>
        <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>
          <strong>💡 Bon à savoir :</strong> si certains documents ne sont pas
          encore disponibles (extrait poursuites en attente, assurance en cours
          de souscription, etc.), vous pouvez fournir un <em>équivalent
          temporaire</em> qui sera marqué &laquo;&nbsp;En attente de
          confirmation&nbsp;&raquo;. Tous les documents — finaux ou équivalents
          — doivent être présents pour atteindre 100%.
        </p>
      </div>

      {/* CTA */}
      <div style={{ textAlign: "center" }}>
        <Link
          href="/app/mon-bien/dossier"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 28px",
            borderRadius: 12,
            background: C.prussian,
            color: "#fff",
            textDecoration: "none",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          Commencer mon dossier
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
