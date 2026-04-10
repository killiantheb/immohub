import Link from "next/link"
import { PLANS } from "@/lib/plans.config"
import { Footer } from "@/components/landing/Footer"

// ── Static data ───────────────────────────────────────────────────────────────

const FEATURES = [
  {
    role: "proprio",
    icon: "🏠",
    iconBg: "rgba(232,96,44,0.10)",
    title: "Propriétaire — Gérez seul ou avec une agence",
    desc: "Baux, états des lieux, quittances, artisans, rapports mensuels automatiques. Althy s'en charge, vous validez.",
    cta: "Commencer →",
    btnBg: "var(--althy-orange)",
    btnColor: "#fff",
    btnBorder: "transparent",
  },
  {
    role: "agence",
    icon: "🏢",
    iconBg: "rgba(59,130,246,0.10)",
    title: "Agence — Outillez votre équipe",
    desc: "Multi-agents, portail proprio pour vos clients, suivi des mandats, comptabilité PPE. Gagnez du temps sur chaque dossier.",
    cta: "Voir la démo →",
    btnBg: "rgba(59,130,246,0.10)",
    btnColor: "#3B82F6",
    btnBorder: "rgba(59,130,246,0.25)",
  },
  {
    role: "artisan",
    icon: "🔧",
    iconBg: "rgba(34,197,94,0.10)",
    title: "Artisan & Ouvreur — Trouvez des missions qualifiées",
    desc: "Profil vérifié, devis, facturation automatique, badge Althy. Recevez des chantiers dans votre zone sans démarcher.",
    cta: "Créer mon profil →",
    btnBg: "rgba(34,197,94,0.10)",
    btnColor: "#16A34A",
    btnBorder: "rgba(34,197,94,0.25)",
  },
  {
    role: "locataire",
    icon: "🗝️",
    iconBg: "rgba(245,158,11,0.10)",
    title: "Locataire — Vos documents en un clic",
    desc: "Retrouvez votre bail, vos quittances, signalez un problème. Simple, gratuit, disponible 24h/24.",
    cta: "Accéder →",
    btnBg: "rgba(245,158,11,0.10)",
    btnColor: "#D97706",
    btnBorder: "rgba(245,158,11,0.25)",
  },
]

const PORTALS = [
  { name: "Homegate",  logo: "🏠", note: "Tarif portail direct" },
  { name: "ImmoScout", logo: "🔍", note: "Tarif portail direct" },
  { name: "Booking",   logo: "📅", note: "4% sur réservations reçues" },
  { name: "Airbnb",    logo: "🌟", note: "4% sur réservations reçues" },
]

const TESTIMONIALS = [
  {
    text: "J'ai rédigé mon bail et mon état des lieux en 20 minutes. Avant ça me prenait une journée.",
    name: "Marc D.",
    role: "Propriétaire solo, Lausanne",
    initials: "MD",
  },
  {
    text: "Nos agents passent moins de temps sur l'administratif et plus avec les clients. Le ROI est immédiat.",
    name: "Sophie R.",
    role: "Directrice agence, Genève",
    initials: "SR",
  },
  {
    text: "Je reçois des missions sans démarcher. Mon profil vérifié parle pour moi.",
    name: "Patrick T.",
    role: "Plombier, Fribourg",
    initials: "PT",
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ background: "var(--althy-bg)", minHeight: "100vh", fontFamily: "var(--font-sans, 'DM Sans', system-ui, sans-serif)" }}>

      {/* ── 1. NAVBAR ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(250,248,245,0.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--althy-border)",
        height: 60, display: "flex", alignItems: "center",
        padding: "0 32px", gap: 24,
      }}>
        <Link href="/" style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22, fontWeight: 300, letterSpacing: 5, color: "var(--althy-orange)", textDecoration: "none" }}>
          ALTHY
        </Link>
        <div style={{ flex: 1 }} />
        <Link href="/login" style={{ fontSize: 13, color: "var(--althy-text-3)", textDecoration: "none" }}>
          Se connecter
        </Link>
        <Link href="/register" style={{ padding: "8px 18px", borderRadius: 10, background: "var(--althy-orange)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          Commencer gratuitement
        </Link>
      </nav>

      {/* ── 2. HERO ───────────────────────────────────────────────────────────── */}
      <section style={{ textAlign: "center", padding: "80px 24px 64px", maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{
          fontFamily: "Cormorant Garamond, serif",
          fontSize: "clamp(36px,6vw,58px)",
          fontWeight: 300, lineHeight: 1.15,
          color: "var(--althy-text)", margin: "0 0 16px",
        }}>
          Votre assistant immobilier,<br />disponible 24h/24
        </h1>
        <p style={{ fontSize: 18, color: "var(--althy-text-3)", margin: "0 0 36px", lineHeight: 1.6 }}>
          Simple, transparent, pour tous les acteurs de l&apos;immobilier suisse.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" style={{ padding: "13px 28px", borderRadius: 12, background: "var(--althy-orange)", color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
            Commencer gratuitement
          </Link>
          <Link href="/estimation" style={{ padding: "13px 28px", borderRadius: 12, background: "var(--althy-surface)", border: "1px solid var(--althy-border)", color: "var(--althy-text)", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
            Estimer mon bien →
          </Link>
        </div>
      </section>

      {/* ── 3. KPI ROW ────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 920, margin: "0 auto 80px", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          {[
            { n: "Disponible 24h/24", sub: "Althy ne dort jamais" },
            { n: "15 min",            sub: "pour rédiger un bail complet" },
            { n: "100% Suisse",       sub: "données hébergées en Suisse" },
            { n: "4% transparent",    sub: "sur flux reçus, zéro marge cachée" },
          ].map((kpi) => (
            <div key={kpi.n} style={{ background: "var(--althy-surface)", border: "1px solid var(--althy-border)", borderRadius: 14, padding: "20px 16px", textAlign: "center", boxShadow: "0 2px 12px rgba(26,22,18,0.04)" }}>
              <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 20, fontWeight: 600, color: "var(--althy-orange)", marginBottom: 6 }}>{kpi.n}</div>
              <div style={{ fontSize: 12, color: "var(--althy-text-3)", lineHeight: 1.4 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. FEATURES ROWS ──────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 920, margin: "0 auto 80px", padding: "0 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28, fontWeight: 300, color: "var(--althy-text)", textAlign: "center", marginBottom: 8 }}>
          Un outil pour chaque acteur
        </h2>
        {FEATURES.map((f) => (
          <div key={f.role} style={{ background: "var(--althy-surface)", border: "1px solid var(--althy-border)", borderRadius: 14, padding: "20px 24px", display: "flex", alignItems: "center", gap: 20, boxShadow: "0 2px 12px rgba(26,22,18,0.04)" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: f.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 24 }}>
              {f.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--althy-text)", marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "var(--althy-text-3)", lineHeight: 1.55 }}>{f.desc}</div>
            </div>
            <Link href="/register" style={{ padding: "9px 18px", borderRadius: 10, background: f.btnBg, color: f.btnColor, fontSize: 13, fontWeight: 600, textDecoration: "none", flexShrink: 0, border: `1px solid ${f.btnBorder}`, whiteSpace: "nowrap" }}>
              {f.cta}
            </Link>
          </div>
        ))}
      </section>

      {/* ── 5. PORTAILS ───────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 920, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28, fontWeight: 300, color: "var(--althy-text)", textAlign: "center", marginBottom: 6 }}>
          Publiez sur tous les portails
        </h2>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--althy-text-3)", marginBottom: 24 }}>
          Tarif portail direct · 4% Althy uniquement sur les flux reçus via la plateforme
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          {PORTALS.map((p) => (
            <div key={p.name} style={{ background: "var(--althy-surface)", border: "1px solid var(--althy-border)", borderRadius: 14, padding: "24px 16px", textAlign: "center", boxShadow: "0 2px 12px rgba(26,22,18,0.04)" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{p.logo}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--althy-text)", marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "var(--althy-text-3)" }}>{p.note}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. TARIFS ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 920, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28, fontWeight: 300, color: "var(--althy-text)", textAlign: "center", marginBottom: 6 }}>
          Tarifs simples et transparents
        </h2>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--althy-text-3)", marginBottom: 32 }}>
          Pas de frais cachés · 4% uniquement sur les flux reçus via Althy
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {PLANS.slice(0, 3).map((plan) => (
            <div key={plan.id} style={{ background: "var(--althy-surface)", border: plan.vedette ? "2px solid var(--althy-orange)" : "1px solid var(--althy-border)", borderRadius: 16, padding: "28px 22px", boxShadow: plan.vedette ? "0 4px 24px rgba(232,96,44,0.12)" : "0 2px 12px rgba(26,22,18,0.04)", position: "relative" }}>
              {plan.vedette && (
                <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: "var(--althy-orange)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 20, whiteSpace: "nowrap" }}>
                  Le plus populaire
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--althy-text)", marginBottom: 4 }}>{plan.nom}</div>
                <div style={{ fontSize: 12, color: "var(--althy-text-3)" }}>{plan.description}</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 34, fontWeight: 600, color: plan.vedette ? "var(--althy-orange)" : "var(--althy-text)" }}>
                  {plan.prix === 0 ? "Gratuit" : `CHF ${plan.prix}`}
                </span>
                {plan.prix > 0 && <span style={{ fontSize: 13, color: "var(--althy-text-3)", marginLeft: 4 }}>{plan.periode}</span>}
                {plan.note && <div style={{ fontSize: 11, color: "var(--althy-text-3)", marginTop: 4 }}>{plan.note}</div>}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px", display: "flex", flexDirection: "column", gap: 7 }}>
                {plan.fonctionnalites.map((feat) => (
                  <li key={feat} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12.5, color: "var(--althy-text)", lineHeight: 1.4 }}>
                    <span style={{ color: "var(--althy-orange)", flexShrink: 0, fontWeight: 700 }}>✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
              <Link href="/register" style={{ display: "block", textAlign: "center", padding: "10px 0", borderRadius: 10, background: plan.vedette ? "var(--althy-orange)" : "var(--althy-bg)", border: plan.vedette ? "none" : "1px solid var(--althy-border)", color: plan.vedette ? "#fff" : "var(--althy-text)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── 7. TÉMOIGNAGES ────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 920, margin: "0 auto 80px", padding: "0 24px" }}>
        <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28, fontWeight: 300, color: "var(--althy-text)", textAlign: "center", marginBottom: 32 }}>
          Ce qu&apos;ils en disent
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {TESTIMONIALS.map((t) => (
            <div key={t.name} style={{ background: "var(--althy-surface)", border: "1px solid var(--althy-border)", borderRadius: 14, padding: "22px 20px", boxShadow: "0 2px 12px rgba(26,22,18,0.04)" }}>
              <p style={{ fontSize: 13.5, color: "var(--althy-text)", lineHeight: 1.65, margin: "0 0 18px", fontStyle: "italic" }}>
                &ldquo;{t.text}&rdquo;
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--althy-orange)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {t.initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--althy-text)" }}>{t.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--althy-text-3)" }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 8. CTA FINAL ──────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 680, margin: "0 auto 80px", padding: "0 24px" }}>
        <div style={{ background: "var(--althy-surface)", border: "1px solid var(--althy-border)", borderRadius: 20, padding: "52px 40px", textAlign: "center", boxShadow: "0 4px 24px rgba(26,22,18,0.06)" }}>
          <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "clamp(28px,4vw,42px)", fontWeight: 300, color: "var(--althy-text)", margin: "0 0 12px" }}>
            Rejoignez l&apos;écosystème Althy
          </h2>
          <p style={{ fontSize: 15, color: "var(--althy-text-3)", margin: "0 0 30px", lineHeight: 1.6 }}>
            Propriétaires, agences, artisans, locataires —<br />un seul outil, pour tous.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register" style={{ padding: "13px 28px", borderRadius: 12, background: "var(--althy-orange)", color: "#fff", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              Commencer gratuitement
            </Link>
            <Link href="/estimation" style={{ padding: "13px 28px", borderRadius: 12, background: "transparent", border: "1px solid var(--althy-border)", color: "var(--althy-text)", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
              Estimer mon bien
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
