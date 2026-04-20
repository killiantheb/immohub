"use client";

import { C } from "@/lib/design-tokens";

type Inclusion = {
  icon: string;
  title: string;
  description: string;
  highlight?: boolean;
};

const INCLUSIONS: Inclusion[] = [
  {
    icon: "🔍",
    title: "4 vérifications locataire / an",
    description:
      "Scoring automatique + contrôle des documents (fiches de salaire, attestations, poursuites) inclus dans votre forfait.",
    highlight: true,
  },
  {
    icon: "🏠",
    title: "4 missions ouvreur / an",
    description:
      "Visites, check-in, check-out, état des lieux — exécutés par un ouvreur Althy vérifié, dans votre canton.",
    highlight: true,
  },
  {
    icon: "⚖️",
    title: "Assistance juridique",
    description:
      "Un juriste partenaire répond à vos questions (résiliation, loyer impayé, sinistre) sans frais supplémentaires.",
  },
  {
    icon: "🛡️",
    title: "Partenariat assurance",
    description:
      "Tarifs préférentiels sur l'assurance PPE, RC propriétaire et garantie loyer impayé via nos partenaires.",
  },
  {
    icon: "📄",
    title: "Contrats & quittances automatiques",
    description:
      "Contrat Sunimmo suisse, quittances de loyer, QR-factures SPC 2.0 générés en 2 clics.",
  },
  {
    icon: "💬",
    title: "Support humain (pas un bot)",
    description:
      "WhatsApp + email, réponse sous 4 heures ouvrées par un conseiller Althy dédié.",
  },
  {
    icon: "🧾",
    title: "Comptabilité & export fiscal",
    description:
      "Réconciliation CAMT.054, ventilation charges/revenus, export PDF pré-rempli pour votre déclaration.",
  },
  {
    icon: "🤖",
    title: "Althy IA 24/24",
    description:
      "L'assistant Althy rédige vos annonces, répond à vos locataires, trie vos candidatures.",
  },
];

export function InclusionsGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 16,
      }}
    >
      {INCLUSIONS.map((item) => (
        <div
          key={item.title}
          style={{
            background: item.highlight ? C.goldBg : C.surface,
            border: `1px solid ${item.highlight ? C.goldBorder : C.border}`,
            borderRadius: 14,
            padding: 20,
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 10, lineHeight: 1 }}>
            {item.icon}
          </div>
          <h4
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 17,
              fontWeight: 400,
              color: C.text,
              margin: 0,
              marginBottom: 6,
            }}
          >
            {item.title}
          </h4>
          <p
            style={{
              color: C.text2,
              fontSize: 13,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}
