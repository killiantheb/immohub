import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer IA — Documents générés automatiquement — Althy",
  description: "Informations importantes sur les documents générés par intelligence artificielle sur Althy — limites, responsabilité, recommandations.",
};

const LAST_UPDATE = "Avril 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 400, color: "var(--althy-text)", margin: "2.5rem 0 0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--althy-border)" }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--althy-text)", margin: "0.6rem 0" }}>{children}</p>;
}

export default function DisclaimerIaPage() {
  return (
    <>
      <div style={{ marginBottom: "2.5rem" }}>
        <p style={{ fontSize: 11, letterSpacing: "2px", textTransform: "uppercase" as const, color: "var(--althy-text-3)", marginBottom: "1rem" }}>Althy — Informations légales</p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.75rem,4vw,2.5rem)", fontWeight: 300, color: "var(--althy-text)", marginBottom: "0.5rem" }}>
          Disclaimer — Documents générés par IA
        </h1>
        <p style={{ fontSize: 12, color: "var(--althy-text-3)" }}>Dernière mise à jour : {LAST_UPDATE}</p>
      </div>

      {/* Main disclaimer box — reproduction du footer PDF */}
      <div style={{ padding: "1.25rem 1.5rem", background: "var(--althy-orange-light)", borderRadius: 12, border: "2px solid var(--althy-orange)", marginBottom: "2rem" }}>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 13, fontWeight: 400, color: "var(--althy-orange)", marginBottom: "0.5rem", letterSpacing: "0.5px" }}>DISCLAIMER — apparaissant sur chaque document généré</p>
        <p style={{ fontSize: 13, color: "#5C2E0E", lineHeight: 1.7, fontStyle: "italic" }}>
          "Document généré automatiquement par Althy IA le [DATE]. Ce document est fourni à titre indicatif et de facilitation uniquement. Il ne constitue pas un conseil juridique, fiscal ou professionnel. L'utilisateur est seul responsable de sa validation et de son utilisation. En cas de doute, consultez un professionnel qualifié. Killian Thébaud — Althy, Genève — althy.ch"
        </p>
      </div>

      <H2>1. Documents concernés</H2>
      <P>Le présent disclaimer s'applique à l'ensemble des documents générés automatiquement par Althy, notamment :</P>
      <ul style={{ paddingLeft: "1.5rem", margin: "0.5rem 0" }}>
        {[
          "Baux d'habitation et baux commerciaux",
          "États des lieux d'entrée et de sortie",
          "Quittances de loyer",
          "Avis d'échéance et rappels de loyer",
          "Lettres de relance (niveaux 1, 2, 3)",
          "Demandes d'intervention et ordres de travaux",
          "Devis comparés",
          "Estimations de valeur immobilière",
          "Rapports d'analyse du potentiel d'un bien",
          "Lettres de résiliation de bail",
          "Notifications de hausse de loyer",
          "Comptes-rendus d'assemblées de copropriétaires",
        ].map(item => (
          <li key={item} style={{ fontSize: 14, lineHeight: 1.75, color: "var(--althy-text)", marginBottom: "0.2rem" }}>{item}</li>
        ))}
      </ul>

      <H2>2. Nature et limites de l'IA</H2>
      <P>Althy utilise le modèle Claude d'Anthropic PBC pour générer ces documents. Ce modèle, bien qu'entraîné sur de vastes corpus de données juridiques et immobilières, présente des limites importantes :</P>
      <div style={{ display: "grid", gap: "0.75rem", margin: "0.75rem 0" }}>
        {[
          { title: "Pas de connaissance locale exhaustive", text: "Le modèle peut ne pas connaître toutes les dispositions cantonales spécifiques au canton de Vaud, Genève, Valais, etc. Le droit du bail suisse varie significativement selon les cantons." },
          { title: "Pas de mise à jour en temps réel", text: "Le modèle a une date de coupure de connaissance. Des modifications législatives récentes peuvent ne pas être reflétées." },
          { title: "Pas de vérification des faits", text: "Le modèle génère du texte basé sur les informations que vous lui fournissez. Il ne vérifie pas l'exactitude des données (loyers, adresses, dates) que vous saisissez." },
          { title: "Possible hallucination", text: "Les modèles d'IA peuvent parfois générer des informations incorrectes avec une apparence de confiance. Toujours vérifier les références légales citées." },
          { title: "Non-substitution à un avocat", text: "Un document généré par IA n'a pas la valeur d'un document rédigé par un avocat ou un notaire. Pour toute procédure judiciaire ou acte notarié, un professionnel qualifié est indispensable." },
        ].map(item => (
          <div key={item.title} style={{ padding: "0.875rem 1rem", background: "#fff", borderRadius: 10, border: "1px solid var(--althy-border)" }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: "var(--althy-text)", marginBottom: 4 }}>{item.title}</p>
            <p style={{ fontSize: 13, color: "var(--althy-text)", lineHeight: 1.65 }}>{item.text}</p>
          </div>
        ))}
      </div>

      <H2>3. Responsabilité de l'utilisateur</H2>
      <P>L'utilisateur est <strong>seul responsable</strong> de :</P>
      <ul style={{ paddingLeft: "1.5rem", margin: "0.5rem 0" }}>
        <li style={{ fontSize: 14, lineHeight: 1.75, color: "var(--althy-text)", marginBottom: "0.25rem" }}>La vérification de la conformité du document avec le droit applicable (droit suisse du bail, loi cantonale, etc.)</li>
        <li style={{ fontSize: 14, lineHeight: 1.75, color: "var(--althy-text)", marginBottom: "0.25rem" }}>L'exactitude des informations saisies (noms, adresses, montants, dates)</li>
        <li style={{ fontSize: 14, lineHeight: 1.75, color: "var(--althy-text)", marginBottom: "0.25rem" }}>La décision d'utiliser ou non le document généré</li>
        <li style={{ fontSize: 14, lineHeight: 1.75, color: "var(--althy-text)", marginBottom: "0.25rem" }}>Les conséquences juridiques et financières découlant de l'utilisation du document</li>
        <li style={{ fontSize: 14, lineHeight: 1.75, color: "var(--althy-text)", marginBottom: "0.25rem" }}>La signature et la notification des parties concernées</li>
      </ul>

      <H2>4. Exclusion de responsabilité d'Althy</H2>
      <P>Dans les limites autorisées par le droit suisse, Althy décline toute responsabilité pour :</P>
      <ul style={{ paddingLeft: "1.5rem", margin: "0.5rem 0" }}>
        <li style={{ fontSize: 14, lineHeight: 1.75, color: "var(--althy-text)", marginBottom: "0.25rem" }}>Toute erreur, omission ou inexactitude dans les documents générés</li>
        <li style={{ fontSize: 14, lineHeight: 1.75, color: "var(--althy-text)", marginBottom: "0.25rem" }}>Tout litige découlant de l'utilisation d'un document non validé par un professionnel</li>
        <li style={{ fontSize: 14, lineHeight: 1.75, color: "var(--althy-text)", marginBottom: "0.25rem" }}>Toute non-conformité avec des dispositions légales spécifiques non connues du modèle</li>
        <li style={{ fontSize: 14, lineHeight: 1.75, color: "var(--althy-text)", marginBottom: "0.25rem" }}>Tout dommage résultant d'une décision prise sur la base d'une estimation IA</li>
      </ul>

      <H2>5. Recommandations</H2>
      <div style={{ display: "grid", gap: "0.5rem", margin: "0.75rem 0" }}>
        {[
          { icon: "⚖️", text: "Pour un bail d'habitation : faites-le valider par un juriste spécialisé ou une association de propriétaires (HEV Suisse, USPI)" },
          { icon: "🏠", text: "Pour une estimation immobilière : obtenez au moins 2 avis d'experts indépendants avant toute décision de vente/achat" },
          { icon: "📋", text: "Pour un état des lieux : faites signer le document par les deux parties et conservez-le pendant toute la durée du bail + 5 ans" },
          { icon: "📬", text: "Pour une résiliation de bail : vérifiez les délais légaux (3 mois avant l'échéance, envoi en recommandé) avec la loi cantonale applicable" },
          { icon: "💼", text: "Pour toute procédure contentieuse (Commission de conciliation, Tribunal des baux) : consultez un avocat" },
        ].map(r => (
          <div key={r.icon} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "0.75rem 1rem", background: "var(--althy-bg)", borderRadius: 10, border: "1px solid var(--althy-border)" }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>{r.icon}</span>
            <p style={{ fontSize: 13, color: "var(--althy-text)", lineHeight: 1.65, margin: 0 }}>{r.text}</p>
          </div>
        ))}
      </div>

      <H2>6. Ressources et professionnels recommandés</H2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem", margin: "0.75rem 0" }}>
        {[
          { name: "HEV Suisse", role: "Association des propriétaires immobiliers", url: "https://www.hev-schweiz.ch" },
          { name: "USPI Suisse", role: "Union Suisse des Professionnels de l'Immobilier", url: "https://www.uspi.ch" },
          { name: "Mietrecht.ch", role: "Informations droit du bail locataire", url: "https://www.mietrecht.ch" },
          { name: "Conférence suisse des régies", role: "Répertoire des régies agréées", url: "https://www.svit.ch" },
        ].map(r => (
          <a key={r.name} href={r.url} target="_blank" rel="noreferrer" style={{ padding: "0.875rem 1rem", background: "#fff", borderRadius: 10, border: "1px solid var(--althy-border)", textDecoration: "none", display: "block" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--althy-orange)", marginBottom: 2 }}>{r.name}</p>
            <p style={{ fontSize: 11, color: "var(--althy-text-3)" }}>{r.role}</p>
          </a>
        ))}
      </div>

      <H2>7. Contact</H2>
      <P>Questions sur les documents générés : <a href="mailto:support@althy.ch" style={{ color: "var(--althy-orange)" }}>support@althy.ch</a></P>
      <P>Signalement d'une erreur dans un document : <a href="mailto:legal@althy.ch" style={{ color: "var(--althy-orange)" }}>legal@althy.ch</a></P>
    </>
  );
}
