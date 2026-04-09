import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Althy",
  description: "Politique de confidentialité d'Althy — conforme LPD suisse et RGPD européen. Données collectées, finalités, durées de conservation, droits des utilisateurs.",
};

const LAST_UPDATE = "Avril 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 400, color: "#3D3830", margin: "2.5rem 0 0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid #E8E4DC" }}>{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 14, fontWeight: 700, color: "#3D3830", margin: "1.25rem 0 0.4rem" }}>{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, lineHeight: 1.75, color: "#4A4440", margin: "0.6rem 0" }}>{children}</p>;
}
function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ fontSize: 14, lineHeight: 1.75, color: "#4A4440", marginBottom: "0.25rem" }}>{children}</li>;
}
function Table({ rows }: { rows: [string, string, string, string][] }) {
  const headers = ["Catégorie", "Données", "Finalité", "Durée"];
  return (
    <div style={{ overflowX: "auto", margin: "0.75rem 0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#F5F2EE" }}>
            {headers.map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#7A7469", fontWeight: 600, borderBottom: "1px solid #E8E4DC" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #E8E4DC", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}>
              {row.map((cell, j) => <td key={j} style={{ padding: "8px 12px", color: "#4A4440", verticalAlign: "top" }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ConfidentialitePage() {
  return (
    <>
      <div style={{ marginBottom: "2.5rem" }}>
        <p style={{ fontSize: 11, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#7A7469", marginBottom: "1rem" }}>Althy — Informations légales</p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.75rem,4vw,2.5rem)", fontWeight: 300, color: "#3D3830", marginBottom: "0.5rem" }}>
          Politique de confidentialité
        </h1>
        <p style={{ fontSize: 12, color: "#7A7469" }}>Dernière mise à jour : {LAST_UPDATE} · Conforme LPD suisse (2023) et RGPD</p>
      </div>

      <div style={{ padding: "1rem", background: "#EBF2EA", borderRadius: 10, border: "1px solid #A8C9A4", marginBottom: "2rem", fontSize: 13 }}>
        <p style={{ fontWeight: 700, color: "#2D5A28", marginBottom: 4 }}>Vos droits en résumé</p>
        <p style={{ color: "#3D5A3A" }}>Vous pouvez accéder, rectifier, exporter ou supprimer vos données à tout moment. Contactez <a href="mailto:privacy@althy.ch" style={{ color: "#2D5A28", fontWeight: 600 }}>privacy@althy.ch</a> — délai de réponse : 30 jours maximum.</p>
      </div>

      <H2>1. Responsable du traitement</H2>
      <P><strong>Althy Sàrl</strong> (en cours de constitution), Genève, Suisse</P>
      <P><strong>DPO (Délégué à la Protection des Données) :</strong> <a href="mailto:privacy@althy.ch" style={{ color: "#B55A30" }}>privacy@althy.ch</a></P>
      <P>Base légale principale : LPD suisse (RS 235.1, en vigueur depuis le 1er septembre 2023) et RGPD européen (Règlement 2016/679) pour les utilisateurs résidant dans l'UE.</P>

      <H2>2. Données collectées</H2>
      <Table rows={[
        ["Identification", "Nom, prénom, email, téléphone, photo de profil", "Création de compte, communication", "Durée abonnement + 3 ans"],
        ["Profil professionnel", "IBAN, BIC, UID IDE, N° TVA, spécialités, zone d'intervention", "Facturation, matching prestataires", "Durée abonnement + 3 ans"],
        ["Biens immobiliers", "Adresses, descriptions, photos, charges, loyers", "Gestion immobilière", "Durée abonnement + 5 ans"],
        ["Locataires", "Dossiers de candidature, scoring, bail, paiements", "Gestion locative", "5 ans après fin du bail"],
        ["Finances", "Transactions Stripe, loyers, dépenses, factures", "Comptabilité, facturation", "10 ans (obligation fiscale CH)"],
        ["Documents", "PDFs uploadés ou générés (baux, EDL, quittances)", "Service documentaire", "5 ans après création"],
        ["Localisation", "Adresse principale, zone d'intervention, lat/lng biens", "Carte, matching géographique", "Durée abonnement"],
        ["Interactions IA", "Questions posées à l'assistant, estimations demandées", "Fourniture du service IA", "90 jours maximum"],
        ["Logs techniques", "Adresse IP, user agent, sessions, erreurs Sentry", "Sécurité, debugging", "30 jours"],
        ["Consentements", "Acceptation CGU, consentement marketing, frais dossier", "Preuve de consentement", "Durée abonnement + 5 ans"],
      ]} />

      <H2>3. Base légale du traitement (art. 6 RGPD / LPD)</H2>
      <ul style={{ paddingLeft: "1.5rem", margin: "0.5rem 0" }}>
        <Li><strong>Exécution du contrat (art. 6.1.b RGPD) :</strong> Toutes les données nécessaires à la fourniture du service (gestion des biens, paiements, matching)</Li>
        <Li><strong>Obligation légale (art. 6.1.c RGPD) :</strong> Données financières (conservation 10 ans selon CO et LT)</Li>
        <Li><strong>Intérêt légitime (art. 6.1.f RGPD) :</strong> Sécurité, prévention des fraudes, amélioration du service (données anonymisées)</Li>
        <Li><strong>Consentement (art. 6.1.a RGPD) :</strong> Cookies analytiques, communications marketing, PostHog</Li>
      </ul>

      <H2>4. Partage des données</H2>
      <P>Althy partage des données uniquement avec les sous-traitants nécessaires à la fourniture du service :</P>
      <Table rows={[
        ["Stripe Inc.", "Paiements, virements", "USA — SCCs", "Données minimales de transaction"],
        ["Supabase Inc.", "Base de données, authentification", "USA — infrastructure EU (Frankfurt)", "Toutes les données"],
        ["Vercel Inc.", "Hébergement frontend", "USA — SCCs", "Logs d'accès"],
        ["Railway Corp.", "Hébergement backend", "USA — SCCs", "Logs d'application"],
        ["Anthropic PBC", "Modèle IA (Claude)", "USA — SCCs", "Questions/réponses anonymisées*"],
        ["Resend Inc.", "Emails transactionnels", "USA — SCCs", "Email, contenu minimal"],
        ["Twilio Inc.", "SMS", "USA — SCCs", "Numéro de téléphone, message"],
        ["Sentry Inc.", "Monitoring erreurs", "USA — SCCs", "Logs d'erreurs anonymisés"],
        ["PostHog Inc.", "Analytics (opt-in)", "USA/EU — SCCs", "Comportement utilisateur (si consentement)"],
      ]} />
      <p style={{ fontSize: 12, color: "#7A7469", fontStyle: "italic", margin: "0.5rem 0" }}>* Les questions posées à l&apos;IA sont minimisées avant envoi à Anthropic : les noms propres, adresses et données financières sont remplacés par des pseudonymes. Les données ne sont jamais utilisées pour entraîner les modèles d&apos;Anthropic.</p>
      <P><strong>Althy ne vend jamais vos données à des tiers à des fins commerciales.</strong></P>

      <H2>5. Transferts hors Suisse / UE</H2>
      <P>Certains sous-traitants sont établis aux États-Unis. Ces transferts sont encadrés par des <strong>Clauses Contractuelles Types (CCT/SCCs)</strong> approuvées par la Commission européenne et reconnues par le Préposé fédéral à la protection des données (PFPDT).</P>
      <P>La base de données principale (Supabase) est hébergée dans la région EU (Frankfurt, Allemagne), ce qui minimise les transferts transatlantiques pour les données les plus sensibles.</P>

      <H2>6. Vos droits (LPD art. 25 / RGPD art. 15–22)</H2>
      <div style={{ display: "grid", gap: "0.75rem", margin: "0.75rem 0" }}>
        {[
          { droit: "Accès (art. 15 RGPD)", desc: "Obtenir une copie de toutes vos données personnelles" },
          { droit: "Rectification (art. 16 RGPD)", desc: "Corriger des données inexactes ou incomplètes" },
          { droit: "Effacement (art. 17 RGPD / LPD art. 32)", desc: "Demander la suppression de vos données (sous réserve d'obligations légales)" },
          { droit: "Portabilité (art. 20 RGPD)", desc: "Recevoir vos données dans un format structuré (JSON/CSV)" },
          { droit: "Opposition (art. 21 RGPD)", desc: "S'opposer au traitement fondé sur l'intérêt légitime" },
          { droit: "Retrait du consentement", desc: "Retirer votre consentement à tout moment (analytics, marketing)" },
        ].map(r => (
          <div key={r.droit} style={{ padding: "0.75rem 1rem", background: "#fff", borderRadius: 10, border: "1px solid #E8E4DC", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#B55A30", minWidth: 200, flexShrink: 0 }}>{r.droit}</p>
            <p style={{ fontSize: 13, color: "#4A4440" }}>{r.desc}</p>
          </div>
        ))}
      </div>
      <P>Exercice de vos droits : <a href="mailto:privacy@althy.ch" style={{ color: "#B55A30", fontWeight: 600 }}>privacy@althy.ch</a></P>
      <P>Depuis votre espace client : Paramètres → Sécurité → Export de mes données</P>
      <P>Délai de réponse : <strong>30 jours maximum</strong> (prorogeable à 60 jours en cas de demande complexe, avec information préalable).</P>
      <P>Vous avez également le droit de déposer une réclamation auprès du Préposé fédéral à la protection des données et à la transparence (PFPDT) : <a href="https://www.edoeb.admin.ch" style={{ color: "#B55A30" }} target="_blank" rel="noreferrer">edoeb.admin.ch</a></P>

      <H2>7. Sécurité des données</H2>
      <ul style={{ paddingLeft: "1.5rem", margin: "0.5rem 0" }}>
        <Li>Chiffrement <strong>AES-256</strong> des données au repos</Li>
        <Li>Chiffrement <strong>TLS 1.3</strong> de toutes les communications</Li>
        <Li><strong>Row Level Security (RLS)</strong> : chaque utilisateur n'accède qu'à ses propres données</Li>
        <Li>Authentification à deux facteurs (2FA) disponible</Li>
        <Li>Tokens d'accès limités dans le temps (JWT)</Li>
        <Li>Monitoring des accès anormaux via Sentry</Li>
        <Li>Protection DDoS via Cloudflare</Li>
      </ul>

      <H2>8. Cookies</H2>
      <P>Pour les informations détaillées sur les cookies utilisés, consultez notre <a href="/legal/cookies" style={{ color: "#B55A30" }}>Politique cookies</a>.</P>

      <H2>9. Mineurs</H2>
      <P>Althy est réservé aux personnes de <strong>18 ans ou plus</strong>. Althy ne collecte pas sciemment de données de mineurs. Si vous avez connaissance qu'un mineur a créé un compte, contactez <a href="mailto:privacy@althy.ch" style={{ color: "#B55A30" }}>privacy@althy.ch</a> pour suppression immédiate.</P>

      <H2>10. Modifications</H2>
      <P>Cette politique peut être mise à jour. Les modifications significatives sont notifiées par email avec un préavis de 30 jours. La version en vigueur est toujours consultable à l'adresse <a href="/legal/confidentialite" style={{ color: "#B55A30" }}>althy.ch/legal/confidentialite</a>.</P>

      <H2>11. Contact</H2>
      <P>DPO Althy : <a href="mailto:privacy@althy.ch" style={{ color: "#B55A30", fontWeight: 600 }}>privacy@althy.ch</a></P>
    </>
  );
}
