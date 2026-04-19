import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — Althy",
  description: "Conditions Générales d'Utilisation de la plateforme Althy — SaaS de facilitation immobilière suisse.",
};

const LAST_UPDATE = "Avril 2026";
const CGU_VERSION = "2026-04";

function H2({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 400, color: "var(--althy-text)", margin: "2.5rem 0 0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--althy-border)" }}>
      Article {num} — {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--althy-text)", margin: "0.6rem 0" }}>{children}</p>;
}
function Important({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: "0.75rem 0", padding: "0.875rem 1rem", background: "var(--althy-orange-light)", borderRadius: 8, border: "1px solid #F0C4A8", fontSize: 13, lineHeight: 1.65 }}>
      {children}
    </div>
  );
}
function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ fontSize: 14, lineHeight: 1.75, color: "var(--althy-text)", marginBottom: "0.25rem" }}>{children}</li>;
}

export default function CguPage() {
  return (
    <>
      <div style={{ marginBottom: "2.5rem" }}>
        <p style={{ fontSize: 11, letterSpacing: "2px", textTransform: "uppercase" as const, color: "var(--althy-text-3)", marginBottom: "1rem" }}>Althy — Informations légales</p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.75rem,4vw,2.5rem)", fontWeight: 300, color: "var(--althy-text)", marginBottom: "0.5rem" }}>
          Conditions Générales d'Utilisation
        </h1>
        <p style={{ fontSize: 12, color: "var(--althy-text-3)" }}>Version {CGU_VERSION} · Dernière mise à jour : {LAST_UPDATE}</p>
      </div>

      <P>Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme Althy, accessible à l'adresse <strong>althy.ch</strong>, exploitée par Killian Thébaud — Althy (ci-après « Althy »).</P>
      <P><strong>En créant un compte ou en utilisant les services d'Althy, vous acceptez intégralement les présentes CGU.</strong></P>

      <H2 num={1}>Objet et acceptation</H2>
      <P>Althy est un outil SaaS (Software as a Service) de facilitation, de centralisation et d'automatisation de la gestion immobilière en Suisse. La plateforme permet notamment la gestion des baux, le suivi des loyers, la mise en relation avec des prestataires, la génération de documents et l'accès à un assistant IA.</P>
      <P>Ces CGU constituent un contrat juridiquement contraignant entre vous (l'Utilisateur) et Althy. Si vous n'acceptez pas ces CGU, vous ne pouvez pas utiliser la plateforme.</P>

      <H2 num={2}>Description du service</H2>
      <P>Althy propose les fonctionnalités suivantes selon votre profil d'utilisation :</P>
      <ul style={{ paddingLeft: "1.5rem", margin: "0.5rem 0" }}>
        <Li><strong>Propriétaires :</strong> Gestion des biens, baux, locataires, loyers, documents, comptabilité, déclaration de sinistres, estimation IA</Li>
        <Li><strong>Agences :</strong> Tableau de bord multi-biens, portail proprio, gestion d'équipe, listings portails immobiliers</Li>
        <Li><strong>Locataires :</strong> Dossier numérique, suivi des paiements, communication avec le propriétaire</Li>
        <Li><strong>Openers, Artisans, Experts :</strong> Réception et gestion de missions, zone d'intervention, facturation</Li>
        <Li><strong>Hunters :</strong> Signalement de biens off-market, versement de fees de référence</Li>
        <Li><strong>Acheteurs Premium :</strong> Alertes de recherche, accès aux biens off-market</Li>
      </ul>

      <H2 num={3}>Statut d'Althy — point crucial</H2>
      <Important>
        <p style={{ fontWeight: 700, color: "var(--althy-orange)", marginBottom: "0.5rem" }}>⚠️ Althy est un outil de facilitation — pas un professionnel réglementé</p>
        <p>Althy <strong>n'est pas</strong> :</p>
        <ul style={{ paddingLeft: "1.25rem", margin: "0.25rem 0" }}>
          <li>Une régie immobilière au sens de la loi cantonale sur les activités immobilières</li>
          <li>Un intermédiaire financier au sens de la LBFA (Loi fédérale sur les bourses et le commerce de valeurs mobilières)</li>
          <li>Un assureur au sens de la LSA (Loi fédérale sur le contrat d'assurance)</li>
          <li>Un courtier habilité au sens de la loi applicable</li>
          <li>Un avocat ou conseiller juridique</li>
          <li>Un conseiller fiscal</li>
        </ul>
        <p style={{ marginTop: "0.5rem" }}>Toute décision — choix d'un locataire, validation d'un devis, signature d'un bail, sélection d'un intervenant — reste sous l'entière responsabilité de l'Utilisateur. Althy propose des outils d'aide à la décision, pas des décisions.</p>
      </Important>

      <H2 num={4}>Documents générés par intelligence artificielle</H2>
      <Important>
        <p style={{ fontWeight: 700, color: "var(--althy-orange)", marginBottom: "0.5rem" }}>Disclaimer obligatoire sur tous les documents générés</p>
        <p>Les documents générés automatiquement par l'IA d'Althy (baux, états des lieux, quittances, relances, estimations, rapports) sont fournis <strong>à titre indicatif et de facilitation uniquement</strong>. Ils <strong>ne constituent pas un conseil juridique, fiscal ou professionnel</strong>.</p>
        <p style={{ marginTop: "0.5rem" }}>L'Utilisateur est seul responsable de la validation et de l'utilisation de ces documents. Althy recommande vivement de faire valider tout document ayant des conséquences juridiques par un professionnel du droit qualifié (avocat, notaire).</p>
      </Important>
      <P>Chaque document généré porte automatiquement un pied de page mentionnant son origine IA, la date de génération et le présent disclaimer.</P>

      <H2 num={5}>Frais de dossier locataire</H2>
      <P>Althy peut percevoir des frais de dossier d'un montant de <strong>CHF 90</strong> lors de la sélection d'un candidat locataire.</P>
      <Important>
        <p><strong>Règle absolue :</strong> Ces frais sont prélevés <strong>UNIQUEMENT</strong> lorsque le propriétaire valide la candidature d'un locataire.</p>
        <ul style={{ paddingLeft: "1.25rem", margin: "0.25rem 0" }}>
          <li>En cas de non-sélection du candidat : <strong>aucun frais n'est dû</strong></li>
          <li>Le dossier du candidat reste actif sur la plateforme sans frais supplémentaires</li>
          <li>La carte bancaire est enregistrée à l'inscription du candidat mais <strong>jamais débitée avant la sélection</strong></li>
          <li>Un consentement explicite est requis du candidat avant toute soumission de dossier</li>
        </ul>
      </Important>
      <P>Ces frais sont conformes à l'art. 254 CO (interdiction des pots-de-vin dans le bail à loyer) : ils rémunèrent le service de traitement du dossier et non l'accès au logement.</P>

      <H2 num={6}>Transactions financières et loyers</H2>
      <P>Althy utilise <strong>Stripe Connect</strong> pour faciliter les paiements et virements entre utilisateurs. Althy prélève une commission de <strong>4 %</strong> sur chaque loyer traité via la plateforme. Ce montant est déduit du virement et affiché comme « loyer net reçu » dans le tableau de bord propriétaire.</P>
      <Important>
        <p>Althy <strong>ne conserve pas les fonds</strong>. Les virements sont traités directement par Stripe, sous licence d'établissement de paiement. Althy agit comme marchand référent (« platform ») au sens des règles Stripe Connect.</p>
      </Important>
      <P>Les propriétaires et locataires sont informés des frais applicables avant toute transaction. Les frais sont visibles dans le tableau de bord avant confirmation.</P>

      <H2 num={7}>Marketplace des intervenants</H2>
      <P>Althy met en relation des propriétaires et des prestataires indépendants (openers, artisans, experts). Althy n'est <strong>pas l'employeur</strong> de ces intervenants et <strong>ne garantit pas</strong> la qualité de leurs prestations.</P>
      <P>Althy prélève une <strong>commission de 10 à 15 %</strong> sur chaque mission conclue via la plateforme (10 % pour les openers Pro, 15 % standard). Cette commission est clairement affichée avant confirmation de la mission.</P>
      <P>Les intervenants sont des travailleurs indépendants responsables de leurs obligations fiscales, sociales et d'assurance. Althy peut procéder à une vérification de base (identité, IBAN) mais ne réalise pas d'audit approfondi.</P>

      <H2 num={8}>Abonnements et résiliation</H2>
      <P>Les abonnements sont mensuels et renouvelés automatiquement. Les tarifs sont affichés sur la page d'abonnement et peuvent évoluer avec un préavis de <strong>30 jours</strong> par email.</P>
      <P>Résiliation : l'Utilisateur peut résilier à tout moment depuis la page Paramètres → Paiement. La résiliation prend effet à la fin de la période en cours. Aucun remboursement prorata n'est accordé sauf obligation légale.</P>
      <P>Les données de l'Utilisateur sont conservées pendant 90 jours après résiliation, puis supprimées sauf obligation légale de conservation (données fiscales : 10 ans).</P>

      <H2 num={9}>Propriété des données</H2>
      <P>L'Utilisateur reste propriétaire de ses données (informations sur ses biens, locataires, documents). Althy n'utilise ces données que pour fournir le service, conformément à la <Link href="/legal/confidentialite" style={{ color: "var(--althy-orange)" }}>Politique de confidentialité</Link>.</P>
      <P>L'Utilisateur peut exporter l'intégralité de ses données à tout moment (Paramètres → Sécurité → Export). En cas de résiliation, une export peut être demandé pendant 90 jours.</P>
      <P>Althy peut utiliser des données agrégées et anonymisées pour améliorer ses services et ses modèles d'IA, sans identifier les utilisateurs individuellement.</P>

      <H2 num={10}>Responsabilité et force majeure</H2>
      <P>Althy s'efforce d'assurer la disponibilité du service (objectif : 99,5 % mensuel). En cas d'interruption non programmée, Althy ne saurait être tenu responsable des pertes directes ou indirectes subies par l'Utilisateur.</P>
      <P>Althy décline toute responsabilité en cas de :</P>
      <ul style={{ paddingLeft: "1.5rem", margin: "0.5rem 0" }}>
        <Li>Décisions prises sur la base de documents ou estimations générés par l'IA</Li>
        <Li>Non-paiement d'un loyer par un locataire</Li>
        <Li>Prestation défaillante d'un intervenant (opener, artisan, expert)</Li>
        <Li>Perte de données due à un événement extérieur (force majeure, cyberattaque)</Li>
      </ul>

      <H2 num={11}>Droit applicable et juridiction</H2>
      <P>Les présentes CGU sont régies par le <strong>droit suisse</strong>, à l'exclusion des règles de conflit de lois. Tout litige sera soumis à la compétence exclusive des <strong>tribunaux de Genève, Suisse</strong>.</P>
      <P>Pour les consommateurs résidant dans l'UE, les dispositions impératives du droit de leur pays de résidence restent applicables si elles offrent une protection plus élevée.</P>

      <H2 num={12}>Modifications des CGU</H2>
      <P>Althy se réserve le droit de modifier les présentes CGU. Les modifications sont communiquées par email avec un <strong>préavis de 30 jours</strong>. En cas de refus des nouvelles CGU, l'Utilisateur peut résilier son abonnement sans frais.</P>
      <P>La version en vigueur est toujours accessible à l'adresse <a href="/legal/cgu" style={{ color: "var(--althy-orange)" }}>althy.ch/legal/cgu</a> et datée de sa dernière modification.</P>
      <P>Version actuelle : <strong>{CGU_VERSION}</strong> — entrée en vigueur le {LAST_UPDATE}.</P>

      <H2 num={13}>Contact</H2>
      <P>Pour toute question relative aux présentes CGU : <a href="mailto:legal@althy.ch" style={{ color: "var(--althy-orange)" }}>legal@althy.ch</a></P>
    </>
  );
}
