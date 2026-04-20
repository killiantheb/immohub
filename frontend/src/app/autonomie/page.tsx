"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { C } from "@/lib/design-tokens";
import { trackEvent } from "@/lib/analytics";
import { ComparisonCalculator } from "@/components/autonomie/ComparisonCalculator";
import { InclusionsGrid } from "@/components/autonomie/InclusionsGrid";

/**
 * Landing publique Althy Autonomie.
 * Objectif : convertir un propriétaire en régie vers CHF 39/mois.
 * Pas d'authent requise.
 */

const FAQ = [
  {
    q: "Puis-je vraiment me passer d'une régie ?",
    a: "Oui, si vous gérez 1 à 10 biens. Althy Autonomie vous donne les outils qu'utilisent les régies (contrats, quittances, vérifs, ouvreurs, compta, juridique) à CHF 39/mois au lieu de ~5% de vos loyers. Pour +10 biens, le plan Pro ou Proprio Pro est plus adapté.",
  },
  {
    q: "Qu'est-ce qui se passe si j'ai plus de 4 vérifications ou 4 missions ouvreur dans l'année ?",
    a: "Les unités supplémentaires sont facturées au tarif marketplace (vérif ≈ CHF 30, mission ouvreur ≈ CHF 50-100). Vous restez libre de passer par la plateforme ou de gérer vous-même.",
  },
  {
    q: "L'assistance juridique est-elle vraiment incluse ?",
    a: "Oui — un partenaire juridique répond à vos questions courantes (résiliation, loyer impayé, sinistre, travaux). Les dossiers complexes nécessitant une représentation en justice restent payants au tarif du partenaire.",
  },
  {
    q: "Je suis actuellement chez une agence, que se passe-t-il ?",
    a: "Vous résiliez votre mandat de gestion selon les conditions de votre contrat (généralement 3 à 6 mois). Vous souscrivez à Althy Autonomie et récupérez tous les documents (baux, EDL, correspondance) pour continuer la gestion de vos biens. Notre équipe peut vous aider à préparer la résiliation.",
  },
  {
    q: "Et si je change d'avis après 3 mois ?",
    a: "L'abonnement est résiliable à tout moment, sans engagement. Vos données restent exportables en CSV / PDF.",
  },
];

const TEMOIGNAGES = [
  {
    nom: "Laurent M.",
    ville: "Lausanne",
    biens: 3,
    avant: "Régie Genève-Riviera",
    economie: 2400,
    citation:
      "J'étais chez une régie depuis 15 ans. J'ai basculé en octobre, je gère tout depuis mon téléphone. Le support WhatsApp est bluffant.",
  },
  {
    nom: "Marie-Claire B.",
    ville: "Fribourg",
    biens: 2,
    avant: "Société de gérance locale",
    economie: 1850,
    citation:
      "Les 4 missions ouvreur incluses couvrent largement mes EDL et visites. Je garde le contrôle, sans la paperasse.",
  },
  {
    nom: "Eric T.",
    ville: "Sion",
    biens: 5,
    avant: "Régie familiale",
    economie: 4200,
    citation:
      "L'assistance juridique m'a permis de gérer un loyer impayé en 2 semaines. Impossible sans Althy.",
  },
];

export default function AutonomiePublicPage() {
  const [economie, setEconomie] = useState(0);

  useEffect(() => {
    trackEvent("autonomy_page_viewed", { source: "public_landing" });
  }, []);

  return (
    <main
      style={{
        background: C.bg,
        minHeight: "100vh",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* ── Nav légère ──────────────────────────────────────────────────── */}
      <nav
        style={{
          padding: "20px 24px",
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 22,
            fontWeight: 300,
            color: C.prussian,
            textDecoration: "none",
          }}
        >
          Althy
        </Link>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link
            href="/login"
            style={{ color: C.text2, fontSize: 14, textDecoration: "none" }}
          >
            Se connecter
          </Link>
          <Link
            href="/register?plan=autonomie"
            style={{
              padding: "9px 18px",
              background: C.prussian,
              color: "#fff",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Commencer
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "64px 24px 48px",
          textAlign: "center",
        }}
      >
        <span
          style={{
            display: "inline-block",
            padding: "6px 14px",
            background: C.goldBg,
            border: `1px solid ${C.goldBorder}`,
            borderRadius: 999,
            color: C.prussian,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          Nouveau · Pour quitter sa régie
        </span>

        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(36px, 5vw, 56px)",
            fontWeight: 300,
            lineHeight: 1.1,
            color: C.text,
            margin: 0,
            marginBottom: 16,
          }}
        >
          Reprenez la main sur vos biens.<br />
          <span style={{ color: C.prussian }}>Gardez 5% de vos loyers.</span>
        </h1>

        <p
          style={{
            color: C.text2,
            fontSize: 18,
            maxWidth: 680,
            margin: "0 auto 32px",
            lineHeight: 1.5,
          }}
        >
          <strong>Althy Autonomie</strong> vous donne les outils d'une régie,
          sans la commission. CHF 39/mois — tout compris : contrats,
          vérifications locataire, ouvreurs, juridique, fiscal.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 48,
          }}
        >
          <Link
            href="/register?plan=autonomie"
            style={{
              padding: "14px 32px",
              background: C.prussian,
              color: "#fff",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Démarrer pour CHF 39/mois →
          </Link>
          <a
            href="#comparatif"
            style={{
              padding: "14px 24px",
              background: "transparent",
              border: `1px solid ${C.border}`,
              color: C.text2,
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Calculer mon économie
          </a>
        </div>

        <p
          style={{
            color: C.text3,
            fontSize: 13,
            margin: 0,
          }}
        >
          Sans engagement · Résiliable à tout moment · Support humain inclus
        </p>
      </section>

      {/* ── Comparateur ─────────────────────────────────────────────────── */}
      <section
        id="comparatif"
        style={{
          maxWidth: 860,
          margin: "0 auto",
          padding: "32px 24px",
        }}
      >
        <ComparisonCalculator onCalculated={setEconomie} />
        {economie > 2000 && (
          <p
            style={{
              textAlign: "center",
              color: C.prussian,
              fontSize: 14,
              fontWeight: 600,
              marginTop: 16,
            }}
          >
            CHF {economie.toLocaleString("fr-CH")}/an — de quoi refaire une
            cuisine tous les 3 ans.
          </p>
        )}
      </section>

      {/* ── Inclusions ──────────────────────────────────────────────────── */}
      <section
        style={{
          background: C.surface,
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          padding: "64px 24px",
          marginTop: 48,
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 300,
              color: C.text,
              margin: 0,
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            Tout ce qu'une régie fait. En mieux.
          </h2>
          <p
            style={{
              color: C.text2,
              fontSize: 15,
              textAlign: "center",
              maxWidth: 620,
              margin: "0 auto 40px",
            }}
          >
            Inclus dans votre forfait CHF 39/mois, sans surprise, sans frais
            cachés.
          </p>
          <InclusionsGrid />
        </div>
      </section>

      {/* ── Témoignages ─────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "64px 24px",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(26px, 3.5vw, 36px)",
            fontWeight: 300,
            color: C.text,
            textAlign: "center",
            margin: "0 0 40px",
          }}
        >
          Ils ont quitté leur régie.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {TEMOIGNAGES.map((t) => (
            <div
              key={t.nom}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                padding: 24,
              }}
            >
              <p
                style={{
                  color: C.text,
                  fontSize: 15,
                  lineHeight: 1.6,
                  fontStyle: "italic",
                  margin: 0,
                  marginBottom: 16,
                }}
              >
                « {t.citation} »
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                  gap: 12,
                  paddingTop: 14,
                  borderTop: `1px solid ${C.border}`,
                }}
              >
                <div>
                  <p
                    style={{
                      fontWeight: 600,
                      color: C.text,
                      fontSize: 14,
                      margin: 0,
                    }}
                  >
                    {t.nom} · {t.ville}
                  </p>
                  <p
                    style={{
                      color: C.text3,
                      fontSize: 12,
                      margin: 0,
                      marginTop: 2,
                    }}
                  >
                    {t.biens} bien{t.biens > 1 ? "s" : ""} · ex-{t.avant}
                  </p>
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    color: C.prussian,
                    fontSize: 18,
                    fontWeight: 400,
                  }}
                >
                  +CHF {t.economie.toLocaleString("fr-CH")}/an
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section
        style={{
          background: C.glacier,
          padding: "64px 24px",
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <div style={{ maxWidth: 780, margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(26px, 3.5vw, 36px)",
              fontWeight: 300,
              color: C.text,
              textAlign: "center",
              margin: "0 0 32px",
            }}
          >
            Questions fréquentes
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FAQ.map((item) => (
              <details
                key={item.q}
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: "16px 20px",
                }}
              >
                <summary
                  style={{
                    fontWeight: 600,
                    color: C.text,
                    fontSize: 15,
                    cursor: "pointer",
                    listStyle: "none",
                  }}
                >
                  {item.q}
                </summary>
                <p
                  style={{
                    color: C.text2,
                    fontSize: 14,
                    lineHeight: 1.6,
                    margin: "12px 0 0",
                  }}
                >
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ───────────────────────────────────────────────────── */}
      <section
        style={{
          background: C.prussian,
          color: "#fff",
          padding: "72px 24px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 300,
            margin: 0,
            marginBottom: 14,
          }}
        >
          Votre régie vous coûte 2 000 CHF/an.<br />
          Althy Autonomie, 468 CHF.
        </h2>
        <p
          style={{
            color: "rgba(255,255,255,0.8)",
            fontSize: 16,
            maxWidth: 560,
            margin: "0 auto 28px",
          }}
        >
          Essayez pendant 30 jours. Résiliez en 1 clic si ça ne vous plaît pas.
        </p>
        <Link
          href="/register?plan=autonomie"
          style={{
            display: "inline-block",
            padding: "14px 36px",
            background: C.gold,
            color: C.prussian,
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Démarrer mon abonnement →
        </Link>
      </section>

      <footer
        style={{
          padding: "32px 24px",
          textAlign: "center",
          color: C.text3,
          fontSize: 13,
        }}
      >
        <Link href="/legal/cgu" style={{ color: C.text3, marginRight: 16 }}>
          CGU
        </Link>
        <Link
          href="/legal/confidentialite"
          style={{ color: C.text3, marginRight: 16 }}
        >
          Confidentialité
        </Link>
        <Link href="/contact" style={{ color: C.text3 }}>
          Contact
        </Link>
      </footer>
    </main>
  );
}
