import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales — Althy",
  description: "Mentions légales de la plateforme Althy — éditeur, hébergement, propriété intellectuelle, droit applicable.",
};

const LAST_UPDATE = "Avril 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 400, color: "#3D3830", margin: "2.5rem 0 0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid #E8E4DC" }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, lineHeight: 1.75, color: "#4A4440", margin: "0.6rem 0" }}>{children}</p>;
}

export default function MentionsLegalesPage() {
  return (
    <>
      <div style={{ marginBottom: "2.5rem" }}>
        <p style={{ fontSize: 11, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#7A7469", marginBottom: "1rem" }}>Althy — Informations légales</p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.75rem,4vw,2.5rem)", fontWeight: 300, color: "#3D3830", marginBottom: "0.5rem" }}>
          Mentions légales
        </h1>
        <p style={{ fontSize: 12, color: "#7A7469" }}>Dernière mise à jour : {LAST_UPDATE}</p>
      </div>

      <H2>1. Éditeur du site</H2>
      <P><strong>Raison sociale :</strong> Althy Sàrl (en cours de constitution)</P>
      <P><strong>Forme juridique :</strong> Société à responsabilité limitée (Sàrl)</P>
      <P><strong>N° IDE :</strong> en cours d'attribution (CHE-XXX.XXX.XXX)</P>
      <P><strong>Siège social :</strong> Genève, Suisse</P>
      <P><strong>Email :</strong> contact@althy.ch</P>
      <P><strong>Site web :</strong> https://althy.ch</P>
      <p style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", background: "#FAE4D6", borderRadius: 8, border: "1px solid #F0C4A8", fontSize: 13, color: "#5C2E0E", lineHeight: 1.65 }}>
        Althy est un service en phase de lancement. La société est en cours de constitution au Registre du commerce de Genève. Les présentes mentions légales seront mises à jour dès l&apos;immatriculation officielle.
      </p>

      <H2>2. Responsable de la publication</H2>
      <P>Le responsable de la publication est le fondateur d'Althy, joignable à l'adresse <a href="mailto:contact@althy.ch" style={{ color: "var(--althy-orange)" }}>contact@althy.ch</a>.</P>

      <H2>3. Hébergement</H2>
      <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.5rem" }}>
        {[
          { label: "Frontend (interface web)", provider: "Vercel Inc.", address: "340 Pine Street, Suite 900, San Francisco, CA 94104, États-Unis", url: "https://vercel.com" },
          { label: "Backend (API)", provider: "Railway Corp.", address: "San Francisco, CA, États-Unis", url: "https://railway.app" },
          { label: "Base de données & Authentification", provider: "Supabase Inc.", address: "San Francisco, CA, États-Unis — infrastructure hébergée dans la région EU (Frankfurt)", url: "https://supabase.com" },
          { label: "CDN & Protection DDoS", provider: "Cloudflare Inc.", address: "101 Townsend St., San Francisco, CA 94107, États-Unis", url: "https://cloudflare.com" },
        ].map(h => (
          <div key={h.label} style={{ padding: "0.875rem 1rem", background: "#fff", borderRadius: 10, border: "1px solid #E8E4DC", fontSize: 13 }}>
            <p style={{ fontWeight: 600, color: "#3D3830", marginBottom: 2 }}>{h.label}</p>
            <p style={{ color: "#7A7469" }}>{h.provider} — {h.address}</p>
          </div>
        ))}
      </div>

      <H2>4. Propriété intellectuelle</H2>
      <P>L'ensemble du contenu de la plateforme Althy (textes, images, logos, code source, interfaces, bases de données) est protégé par le droit suisse de la propriété intellectuelle, notamment la Loi fédérale sur le droit d'auteur (LDA, RS 231.1).</P>
      <P>Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite, sauf autorisation écrite préalable d'Althy.</P>
      <P>Les marques, logos et signes distinctifs reproduits sur le site sont la propriété d'Althy. Toute reproduction sans autorisation est constitutive de contrefaçon.</P>

      <H2>5. Limitation de responsabilité</H2>
      <P>Althy s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées. Toutefois, Althy ne peut garantir l'exactitude, la précision ou l'exhaustivité des informations mises à disposition.</P>
      <P>Althy décline toute responsabilité pour tout dommage direct ou indirect résultant de l'utilisation du site ou de l'impossibilité d'y accéder. Le service est fourni « en l'état » sans garantie de disponibilité continue.</P>
      <P>Les liens hypertextes établis en direction d'autres sites ne sauraient engager la responsabilité d'Althy quant à leur contenu.</P>

      <H2>6. Droit applicable et juridiction compétente</H2>
      <P>Les présentes mentions légales sont soumises au droit suisse. Tout litige relatif à l'utilisation du site sera soumis à la compétence exclusive des tribunaux du canton de Genève, Suisse.</P>
      <P>En cas de litige avec un consommateur résidant dans l'Union européenne, les dispositions impératives du droit de l'État membre de résidence du consommateur demeurent applicables dans la mesure où elles offrent une protection plus élevée.</P>

      <H2>7. Contact</H2>
      <P>Pour toute question relative aux présentes mentions légales : <a href="mailto:contact@althy.ch" style={{ color: "var(--althy-orange)" }}>contact@althy.ch</a></P>
      <P>Pour toute question relative à vos données personnelles : <a href="mailto:privacy@althy.ch" style={{ color: "var(--althy-orange)" }}>privacy@althy.ch</a></P>
    </>
  );
}
