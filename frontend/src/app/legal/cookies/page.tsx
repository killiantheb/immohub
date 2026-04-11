import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Politique cookies — Althy",
  description: "Politique d'utilisation des cookies sur Althy — cookies nécessaires, analytiques et marketing.",
};

const LAST_UPDATE = "Avril 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 400, color: "#3D3830", margin: "2.5rem 0 0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid #E8E4DC" }}>{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 14, lineHeight: 1.75, color: "#4A4440", margin: "0.6rem 0" }}>{children}</p>;
}

interface CookieRow {
  name: string;
  provider: string;
  purpose: string;
  duration: string;
  required: boolean;
}

function CookieTable({ title, color, cookies }: { title: string; color: string; cookies: CookieRow[] }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#3D3830", margin: 0 }}>{title}</h3>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#F5F2EE" }}>
              {["Nom / Identifiant", "Fournisseur", "Finalité", "Durée"].map(h => (
                <th key={h} style={{ padding: "7px 10px", textAlign: "left", color: "#7A7469", fontWeight: 600, borderBottom: "1px solid #E8E4DC" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cookies.map((c, i) => (
              <tr key={c.name} style={{ borderBottom: "1px solid #E8E4DC", background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}>
                <td style={{ padding: "7px 10px", color: "#3D3830", fontWeight: 600 }}>{c.name}</td>
                <td style={{ padding: "7px 10px", color: "#4A4440" }}>{c.provider}</td>
                <td style={{ padding: "7px 10px", color: "#4A4440" }}>{c.purpose}</td>
                <td style={{ padding: "7px 10px", color: "#7A7469", whiteSpace: "nowrap" as const }}>{c.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CookiesPage() {
  return (
    <>
      <div style={{ marginBottom: "2.5rem" }}>
        <p style={{ fontSize: 11, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#7A7469", marginBottom: "1rem" }}>Althy — Informations légales</p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.75rem,4vw,2.5rem)", fontWeight: 300, color: "#3D3830", marginBottom: "0.5rem" }}>
          Politique cookies
        </h1>
        <p style={{ fontSize: 12, color: "#7A7469" }}>Dernière mise à jour : {LAST_UPDATE}</p>
      </div>

      <P>Althy utilise des cookies et technologies similaires (stockage local) pour faire fonctionner la plateforme, analyser son utilisation et, avec votre consentement, améliorer votre expérience.</P>

      <H2>Qu'est-ce qu'un cookie ?</H2>
      <P>Un cookie est un petit fichier texte stocké sur votre appareil lors de votre visite sur un site web. Il permet de mémoriser vos préférences et d'améliorer votre expérience. Althy utilise également le <strong>stockage local (localStorage)</strong> du navigateur, qui fonctionne de la même manière mais n'est pas envoyé automatiquement au serveur.</P>

      <H2>1. Cookies strictement nécessaires</H2>
      <P>Ces cookies sont indispensables au fonctionnement du site. <strong>Ils ne nécessitent pas votre consentement</strong> (art. 45c LTC suisse / directive ePrivacy européenne).</P>
      <CookieTable
        title="Cookies nécessaires — pas de consentement requis"
        color="#16A34A"
        cookies={[
          { name: "sb-[hash]-auth-token", provider: "Supabase (Althy)", purpose: "Session d'authentification — vous maintient connecté", duration: "7 jours", required: true },
          { name: "sb-[hash]-auth-token-code-verifier", provider: "Supabase (Althy)", purpose: "Protection PKCE OAuth2", duration: "Session", required: true },
          { name: "althy_cookie_consent", provider: "Althy (localStorage)", purpose: "Mémorisation de vos choix de consentement aux cookies", duration: "6 mois", required: true },
          { name: "__Host-next-auth.*", provider: "Next.js / Althy", purpose: "Protection CSRF pour les formulaires", duration: "Session", required: true },
        ]}
      />

      <H2>2. Cookies analytiques</H2>
      <P>Ces cookies nous permettent de comprendre comment vous utilisez Althy afin d'améliorer nos services. <strong>Votre consentement est requis.</strong></P>
      <CookieTable
        title="Cookies analytiques — consentement requis"
        color="#2563EB"
        cookies={[
          { name: "ph_[key]_posthog", provider: "PostHog Inc. (opt-in)", purpose: "Analyse anonymisée du comportement utilisateur — pages visitées, fonctionnalités utilisées", duration: "1 an", required: false },
          { name: "vercel_analytics_id", provider: "Vercel Inc.", purpose: "Analytics de performance web (Web Vitals) — données anonymisées, pas de tracking individuel", duration: "Session", required: false },
          { name: "sentry-sc", provider: "Sentry Inc.", purpose: "Monitoring des erreurs techniques — aucune donnée personnelle, stack traces uniquement", duration: "Session", required: false },
        ]}
      />

      <H2>3. Cookies marketing</H2>
      <div style={{ padding: "1rem", background: "#EBF2EA", borderRadius: 10, border: "1px solid #A8C9A4", fontSize: 13 }}>
        <p style={{ fontWeight: 700, color: "#2D5A28", marginBottom: 4 }}>Aucun cookie marketing</p>
        <p style={{ color: "#3D5A3A" }}>Althy n'intègre aucun cookie publicitaire ou de remarketing. Il n'y a pas de publicité dans l'application. Vos données ne sont jamais utilisées pour du ciblage publicitaire tiers.</p>
      </div>

      <H2>4. Gérer vos préférences</H2>
      <P>Vous pouvez modifier vos préférences cookies à tout moment :</P>
      <ul style={{ paddingLeft: "1.5rem", margin: "0.5rem 0" }}>
        <li style={{ fontSize: 14, lineHeight: 1.75, color: "#4A4440", marginBottom: "0.25rem" }}>
          <strong>Via la bannière cookies :</strong> Cliquez sur « Personnaliser » dans la bannière en bas de page
        </li>
        <li style={{ fontSize: 14, lineHeight: 1.75, color: "#4A4440", marginBottom: "0.25rem" }}>
          <strong>Via votre navigateur :</strong> Vous pouvez bloquer tous les cookies dans les paramètres de votre navigateur (nota : certaines fonctionnalités peuvent ne plus fonctionner)
        </li>
        <li style={{ fontSize: 14, lineHeight: 1.75, color: "#4A4440", marginBottom: "0.25rem" }}>
          <strong>Opt-out PostHog :</strong> <a href="https://posthog.com/privacy" style={{ color: "var(--althy-orange)" }} target="_blank" rel="noreferrer">posthog.com/privacy</a>
        </li>
      </ul>
      <P>Le retrait de votre consentement ne porte pas atteinte à la licéité du traitement fondé sur le consentement effectué avant ce retrait.</P>

      <H2>5. Contact</H2>
      <P>Pour toute question sur les cookies : <a href="mailto:privacy@althy.ch" style={{ color: "var(--althy-orange)" }}>privacy@althy.ch</a></P>
      <P>Voir aussi : <Link href="/legal/confidentialite" style={{ color: "var(--althy-orange)" }}>Politique de confidentialité complète</Link></P>
    </>
  );
}
