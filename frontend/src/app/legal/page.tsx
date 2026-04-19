import type { Metadata } from "next"
import { LEGAL } from "@/lib/legal-entity"

export const metadata: Metadata = {
  title: "Mentions légales — Althy",
  description: "Mentions légales de la plateforme Althy — éditeur, hébergement, propriété intellectuelle, droit applicable.",
}

const LAST_UPDATE = "Avril 2026"

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 400, color: "var(--althy-text)", margin: "2.5rem 0 0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--althy-border)" }}>{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, lineHeight: 1.75, color: "var(--althy-text)", margin: "0.6rem 0" }}>{children}</p>
}

export default function MentionsLegalesPage() {
  return (
    <>
      <div style={{ marginBottom: "2.5rem" }}>
        <p style={{ fontSize: 11, letterSpacing: "2px", textTransform: "uppercase" as const, color: "var(--althy-text-3)", marginBottom: "1rem" }}>Althy — Informations légales</p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.75rem,4vw,2.5rem)", fontWeight: 300, color: "var(--althy-text)", marginBottom: "0.5rem" }}>
          Mentions légales
        </h1>
        <p style={{ fontSize: 12, color: "var(--althy-text-3)" }}>Dernière mise à jour : {LAST_UPDATE}</p>
      </div>

      <H2>1. Éditeur du site</H2>
      <P><strong>Raison sociale :</strong> {LEGAL.name}</P>
      <P><strong>Forme juridique :</strong> {LEGAL.form}</P>
      <P><strong>N° IDE :</strong> {LEGAL.ide}</P>
      <P><strong>Siège social :</strong> {LEGAL.adresse}</P>
      <P><strong>Représentant légal :</strong> {LEGAL.representant}</P>
      <P><strong>Email :</strong> <a href={`mailto:${LEGAL.email}`} style={{ color: "var(--althy-orange)" }}>{LEGAL.email}</a></P>
      <P><strong>Protection des données :</strong> <a href={`mailto:${LEGAL.emailPrivacy}`} style={{ color: "var(--althy-orange)" }}>{LEGAL.emailPrivacy}</a></P>
      <P><strong>Site web :</strong> <a href={LEGAL.url} style={{ color: "var(--althy-orange)" }}>{LEGAL.url}</a></P>
      <p style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", background: "var(--althy-orange-light)", borderRadius: 8, border: "1px solid #F0C4A8", fontSize: 13, color: "#5C2E0E", lineHeight: 1.65 }}>
        Althy est un service en phase de lancement. La société Sàrl est en cours de constitution au Registre du commerce de Genève. Les présentes mentions légales seront mises à jour dès l&apos;immatriculation officielle.
      </p>

      <H2>2. Responsable de la publication</H2>
      <P>{LEGAL.representant}, joignable à l&apos;adresse <a href={`mailto:${LEGAL.email}`} style={{ color: "var(--althy-orange)" }}>{LEGAL.email}</a>.</P>

      <H2>3. Hébergement</H2>
      <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.5rem" }}>
        {[
          { label: "Frontend (interface web)", provider: "Vercel Inc.", address: "340 Pine Street, Suite 900, San Francisco, CA 94104, États-Unis", url: "https://vercel.com" },
          { label: "Backend (API)", provider: "Railway Corp.", address: "San Francisco, CA, États-Unis", url: "https://railway.app" },
          { label: "Base de données & Authentification", provider: "Supabase Inc.", address: "San Francisco, CA, États-Unis — infrastructure hébergée dans la région EU (Frankfurt)", url: "https://supabase.com" },
          { label: "CDN & Protection DDoS", provider: "Cloudflare Inc.", address: "101 Townsend St., San Francisco, CA 94107, États-Unis", url: "https://cloudflare.com" },
        ].map(h => (
          <div key={h.label} style={{ padding: "0.875rem 1rem", background: "#fff", borderRadius: 10, border: "1px solid var(--althy-border)", fontSize: 13 }}>
            <p style={{ fontWeight: 600, color: "var(--althy-text)", marginBottom: 2 }}>{h.label}</p>
            <p style={{ color: "var(--althy-text-3)" }}>{h.provider} — {h.address}</p>
          </div>
        ))}
      </div>

      <H2>4. Propriété intellectuelle</H2>
      <P>L&apos;ensemble du contenu de la plateforme Althy (textes, images, logos, code source, interfaces, bases de données) est protégé par le droit suisse de la propriété intellectuelle, notamment la Loi fédérale sur le droit d&apos;auteur (LDA, RS 231.1).</P>
      <P>Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable d&apos;Althy.</P>
      <P>Les marques, logos et signes distinctifs reproduits sur le site sont la propriété de {LEGAL.name}. Toute reproduction sans autorisation est constitutive de contrefaçon.</P>

      <H2>5. Limitation de responsabilité</H2>
      <P>Althy s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des informations diffusées. Toutefois, Althy ne peut garantir l&apos;exactitude, la précision ou l&apos;exhaustivité des informations mises à disposition.</P>
      <P>Althy décline toute responsabilité pour tout dommage direct ou indirect résultant de l&apos;utilisation du site ou de l&apos;impossibilité d&apos;y accéder. Le service est fourni « en l&apos;état » sans garantie de disponibilité continue.</P>
      <P>Les liens hypertextes établis en direction d&apos;autres sites ne sauraient engager la responsabilité d&apos;Althy quant à leur contenu.</P>

      <H2>6. Droit applicable et juridiction compétente</H2>
      <P>Les présentes mentions légales sont soumises au droit suisse. Tout litige relatif à l&apos;utilisation du site sera soumis à la compétence exclusive des tribunaux du canton de Genève, Suisse.</P>
      <P>En cas de litige avec un consommateur résidant dans l&apos;Union européenne, les dispositions impératives du droit de l&apos;État membre de résidence du consommateur demeurent applicables dans la mesure où elles offrent une protection plus élevée.</P>

      <H2>7. Contact</H2>
      <P>Pour toute question relative aux présentes mentions légales : <a href={`mailto:${LEGAL.email}`} style={{ color: "var(--althy-orange)" }}>{LEGAL.email}</a></P>
      <P>Pour toute question relative à vos données personnelles : <a href={`mailto:${LEGAL.emailPrivacy}`} style={{ color: "var(--althy-orange)" }}>{LEGAL.emailPrivacy}</a></P>
    </>
  )
}
