import dynamic from "next/dynamic";
import Link from "next/link";
import { Footer } from "@/components/landing/Footer";

// ── Map hero — client-side uniquement (mapbox-gl) ─────────────────────────────

const LandingHeroMap = dynamic(
  () => import("@/components/landing/LandingHeroMap"),
  {
    ssr: false,
    loading: () => (
      <div style={{
        height: 420, borderRadius: 18,
        background: "linear-gradient(135deg, #F0EBE3 0%, #E6DDD2 100%)",
        border: "1px solid rgba(26,22,18,0.07)",
        boxShadow: "0 8px 40px rgba(26,22,18,0.06)",
      }} />
    ),
  }
);

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:      "#FAFAF8",
  surface: "#FFFFFF",
  border:  "rgba(26,22,18,0.07)",
  orange:  "#E8602C",
  text:    "#1A1612",
  muted:   "#6B5E52",
  dark:    "#1A1612",
} as const;

const serif = "var(--font-serif, Fraunces, Georgia, serif)";
const sans  = "var(--font-sans, 'DM Sans', system-ui, sans-serif)";

// ── Données statiques ─────────────────────────────────────────────────────────

const FILTERS = [
  "Tous les biens", "Location", "Vente", "Saisonnier",
  "Studio", "2–3 pièces", "4 pièces+", "Genève", "Lausanne", "Fribourg", "Valais",
] as const;

const BIENS_MOCK = [
  {
    id: 1,
    gradient: "135deg, #E8D8C4 0%, #CCBA9C 100%",
    type: "Appartement", pieces: 3, surface: 75,
    prix: "2'200", devise: "CHF", periode: "/mois",
    adresse: "Rue de Rive 14", ville: "Genève — Rive Gauche",
    statut: "À louer", statutColor: "#3A7A5A",
    note: 4.8, verifie: true,
  },
  {
    id: 2,
    gradient: "135deg, #C4D8C4 0%, #9CC89C 100%",
    type: "Studio", pieces: 1, surface: 32,
    prix: "1'350", devise: "CHF", periode: "/mois",
    adresse: "Avenue de la Gare 8", ville: "Lausanne — Centre",
    statut: "À louer", statutColor: "#3A7A5A",
    note: 4.6, verifie: true,
  },
  {
    id: 3,
    gradient: "135deg, #C4CCE0 0%, #9CACC8 100%",
    type: "Villa", pieces: 5, surface: 180,
    prix: "1'850'000", devise: "CHF", periode: "",
    adresse: "Chemin des Vignes 3", ville: "Nyon — Vaud",
    statut: "À vendre", statutColor: "#2563EB",
    note: 4.9, verifie: true,
  },
  {
    id: 4,
    gradient: "135deg, #E0D8C4 0%, #C8BC9C 100%",
    type: "Appartement", pieces: 2, surface: 55,
    prix: "1'800", devise: "CHF", periode: "/mois",
    adresse: "Grand-Rue 22", ville: "Fribourg — Basse-Ville",
    statut: "À louer", statutColor: "#3A7A5A",
    note: 4.5, verifie: false,
  },
  {
    id: 5,
    gradient: "135deg, #E0C8C4 0%, #C8A09C 100%",
    type: "Chalet", pieces: 4, surface: 120,
    prix: "3'200", devise: "CHF", periode: "/mois",
    adresse: "Route des Crêtes 7", ville: "Verbier — Valais",
    statut: "Saisonnier", statutColor: "#B45309",
    note: 4.7, verifie: true,
  },
  {
    id: 6,
    gradient: "135deg, #C8C4E0 0%, #A09CC8 100%",
    type: "Appartement", pieces: 3, surface: 80,
    prix: "2'100", devise: "CHF", periode: "/mois",
    adresse: "Fbg de l'Hôpital 5", ville: "Neuchâtel — Centre",
    statut: "À louer", statutColor: "#3A7A5A",
    note: 4.4, verifie: false,
  },
] as const;

const VALEURS = [
  { n: "24h/24",    label: "Disponible",    desc: "Althy ne dort jamais — week-end et jours fériés inclus" },
  { n: "15 min",   label: "Chrono",         desc: "Pour rédiger un bail complet, une quittance, un état des lieux" },
  { n: "4%",       label: "Transparent",    desc: "Uniquement sur les flux reçus via Althy — zéro marge cachée" },
  { n: "100%",     label: "Suisse",         desc: "Données hébergées en Suisse, conformes LPD et RGPD" },
] as const;

const ETAPES = [
  {
    n: "01",
    titre: "Inscrivez-vous",
    desc: "Choisissez votre rôle en 2 minutes : propriétaire, agence, artisan, locataire. Aucune carte bancaire requise.",
  },
  {
    n: "02",
    titre: "La Sphère analyse",
    desc: "Notre agent IA lit votre contexte chaque matin et vous propose des actions prioritaires à valider.",
  },
  {
    n: "03",
    titre: "Vous décidez",
    desc: "Un clic pour valider. Althy exécute — envoi d'email, génération de document, coordination artisan.",
  },
] as const;

const ROLES = [
  {
    icon: "⌂",
    titre: "Propriétaire",
    desc: "Baux, états des lieux, quittances, relances, artisans — gérez seul ou avec votre agence.",
    prix: "CHF 29", periode: "/mois",
    note: "ou CHF 23 si annuel",
    href: "/register?role=proprio_solo",
    cta: "Commencer",
    accent: C.orange,
  },
  {
    icon: "⬜",
    titre: "Agence",
    desc: "Multi-agents, portail proprio pour vos clients, mandats, comptabilité PPE — un outil pour toute l'équipe.",
    prix: "CHF 29", periode: "/agent/mois",
    note: "Portail proprio CHF 9",
    href: "/register?role=agence",
    cta: "Voir la démo",
    accent: "#2563EB",
  },
  {
    icon: "⚒",
    titre: "Artisan & Ouvreur",
    desc: "Profil vérifié, missions qualifiées dans votre zone, devis et facturation automatiques.",
    prix: "Gratuit", periode: "",
    note: "Pro CHF 19/mois",
    href: "/register?role=artisan",
    cta: "Créer mon profil",
    accent: "#3A7A5A",
  },
  {
    icon: "◇",
    titre: "Locataire",
    desc: "Bail, quittances, signalement de problème — tout en un seul endroit, simple et gratuit.",
    prix: "Gratuit", periode: "",
    note: "Dossier CHF 90 si retenu",
    href: "/register?role=locataire",
    cta: "Accéder",
    accent: "#6B5E52",
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function Stars({ n }: { n: number }) {
  return (
    <span>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= Math.round(n) ? C.orange : "#D4CEC8", fontSize: 13 }}>★</span>
      ))}
      <span style={{ fontSize: 12, color: C.muted, marginLeft: 4, fontWeight: 500 }}>{n}</span>
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      {/* ── Styles responsifs ──────────────────────────────────────────────── */}
      <style>{`
        .lp-grid-biens {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .lp-grid-valeurs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .lp-grid-roles {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .lp-grid-etapes {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .lp-filter-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }
        @media (max-width: 1024px) {
          .lp-grid-biens    { grid-template-columns: repeat(2, 1fr); }
          .lp-grid-valeurs  { grid-template-columns: repeat(2, 1fr); }
          .lp-grid-roles    { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .lp-grid-biens    { grid-template-columns: 1fr; }
          .lp-grid-valeurs  { grid-template-columns: repeat(2, 1fr); }
          .lp-grid-roles    { grid-template-columns: 1fr; }
          .lp-grid-etapes   { grid-template-columns: 1fr; }
          .lp-nav-tagline   { display: none; }
        }
      `}</style>

      <div style={{ background: C.bg, minHeight: "100vh", fontFamily: sans }}>

        {/* ══════════════════════════════════════════════════════════════
            1. NAVBAR
        ══════════════════════════════════════════════════════════════ */}
        <nav style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(250,250,248,0.92)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(26,22,18,0.07)",
          height: 62, display: "flex", alignItems: "center",
          padding: "0 28px", gap: 20,
        }}>
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
            <span style={{
              fontFamily: serif,
              fontSize: 21, fontWeight: 400, letterSpacing: "0.18em",
              color: C.orange,
            }}>
              ALTHY
            </span>
          </Link>

          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <span className="lp-nav-tagline" style={{
              fontFamily: serif,
              fontSize: 14, fontStyle: "italic", fontWeight: 300,
              color: C.muted, letterSpacing: "0.02em",
            }}>
              Votre Agent Personnel
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <Link href="/login" style={{
              fontSize: 13, color: C.muted, fontWeight: 500,
              textDecoration: "none", padding: "7px 14px",
            }}>
              Se connecter
            </Link>
            <Link href="/register" style={{
              fontSize: 13, fontWeight: 600, color: "#fff",
              background: C.orange,
              padding: "8px 18px", borderRadius: 10,
              textDecoration: "none",
            }}>
              Commencer gratuitement
            </Link>
          </div>
        </nav>

        {/* ══════════════════════════════════════════════════════════════
            2. HERO
        ══════════════════════════════════════════════════════════════ */}
        <section style={{ padding: "72px 24px 0", maxWidth: 1100, margin: "0 auto" }}>

          {/* Texte hero */}
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 40px" }}>
            <p style={{
              fontSize: 12, fontWeight: 600, letterSpacing: "0.14em",
              color: C.orange, textTransform: "uppercase", marginBottom: 18,
            }}>
              Suisse romande · Genève · Vaud · Valais
            </p>
            <h1 style={{
              fontFamily: serif,
              fontSize: "clamp(34px, 5.5vw, 60px)",
              fontWeight: 300, lineHeight: 1.12,
              color: C.text, margin: "0 0 20px",
              letterSpacing: "-0.01em",
            }}>
              L&apos;immobilier suisse,<br />simplifié pour tous
            </h1>
            <p style={{
              fontSize: "clamp(15px, 2vw, 18px)",
              color: C.muted, lineHeight: 1.65,
              margin: "0 0 34px", maxWidth: 560, marginLeft: "auto", marginRight: "auto",
            }}>
              Propriétaires, agences, artisans, locataires —<br />
              Althy gère, vous décidez.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/register" style={{
                padding: "13px 28px", borderRadius: 12,
                background: C.orange, color: "#fff",
                fontSize: 15, fontWeight: 700, textDecoration: "none",
                boxShadow: "0 4px 18px rgba(232,96,44,0.30)",
              }}>
                Commencer gratuitement
              </Link>
              <Link href="/estimation" style={{
                padding: "13px 28px", borderRadius: 12,
                border: "1.5px solid rgba(26,22,18,0.14)",
                background: "transparent", color: C.text,
                fontSize: 15, fontWeight: 500, textDecoration: "none",
              }}>
                Voir une démo →
              </Link>
            </div>
          </div>

          {/* Carte Suisse interactive */}
          <LandingHeroMap />
        </section>

        {/* ══════════════════════════════════════════════════════════════
            3. FILTRES PILLS
        ══════════════════════════════════════════════════════════════ */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 0" }}>
          <div className="lp-filter-row">
            {FILTERS.map((f, i) => (
              <span key={f} style={{
                padding: "8px 16px",
                borderRadius: 20,
                fontSize: 13, fontWeight: i === 0 ? 600 : 500,
                cursor: "pointer",
                background: i === 0 ? C.orange : C.surface,
                color: i === 0 ? "#fff" : C.muted,
                border: `1px solid ${i === 0 ? "transparent" : "rgba(26,22,18,0.10)"}`,
                transition: "all 0.15s",
                userSelect: "none",
              }}>
                {f}
              </span>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            4. GRILLE BIENS
        ══════════════════════════════════════════════════════════════ */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 80px" }}>
          <div className="lp-grid-biens">
            {BIENS_MOCK.map(b => (
              <div key={b.id} style={{
                background: C.surface,
                border: `0.5px solid ${C.border}`,
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: "0 2px 16px rgba(26,22,18,0.05)",
              }}>
                {/* Photo placeholder */}
                <div style={{ position: "relative", aspectRatio: "16/10", overflow: "hidden" }}>
                  <div style={{
                    width: "100%", height: "100%",
                    background: `linear-gradient(${b.gradient})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 36, opacity: 0.4 }}>⌂</span>
                  </div>
                  {/* Badge statut */}
                  <div style={{
                    position: "absolute", top: 10, left: 10,
                    background: b.statutColor,
                    color: "#fff", fontSize: 11, fontWeight: 700,
                    padding: "3px 9px", borderRadius: 6,
                    letterSpacing: "0.02em",
                  }}>
                    {b.statut}
                  </div>
                  {/* Badge Vérifié */}
                  {b.verifie && (
                    <div style={{
                      position: "absolute", top: 10, right: 10,
                      background: "rgba(255,255,255,0.92)",
                      color: C.orange, fontSize: 10, fontWeight: 700,
                      padding: "3px 8px", borderRadius: 6,
                      border: `1px solid ${C.orange}`,
                      letterSpacing: "0.02em",
                    }}>
                      ✓ Vérifié Althy
                    </div>
                  )}
                </div>

                {/* Contenu */}
                <div style={{ padding: "14px 16px 16px" }}>
                  {/* Prix */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                    <span style={{
                      fontFamily: serif,
                      fontSize: 22, fontWeight: 400, color: C.text,
                    }}>
                      {b.devise} {b.prix}
                    </span>
                    {b.periode && (
                      <span style={{ fontSize: 13, color: C.muted }}>{b.periode}</span>
                    )}
                  </div>

                  {/* Adresse */}
                  <p style={{ margin: "0 0 10px", fontSize: 13, color: C.text, fontWeight: 500 }}>
                    {b.adresse}
                  </p>
                  <p style={{ margin: "0 0 10px", fontSize: 12, color: C.muted }}>
                    {b.ville}
                  </p>

                  {/* Tags */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    {[
                      `${b.pieces} pièce${b.pieces > 1 ? "s" : ""}`,
                      `${b.surface} m²`,
                      b.type,
                    ].map(tag => (
                      <span key={tag} style={{
                        fontSize: 11, fontWeight: 500,
                        padding: "3px 8px", borderRadius: 5,
                        background: "rgba(26,22,18,0.05)",
                        color: C.muted,
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Note */}
                  <Stars n={b.note} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 32 }}>
            <Link href="/app/biens" style={{
              display: "inline-block",
              padding: "11px 28px", borderRadius: 10,
              border: `1.5px solid rgba(26,22,18,0.14)`,
              fontSize: 14, fontWeight: 600, color: C.text,
              textDecoration: "none",
            }}>
              Voir tous les biens →
            </Link>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            5. VALEURS — 4 colonnes
        ══════════════════════════════════════════════════════════════ */}
        <section style={{
          background: C.surface,
          borderTop: "1px solid rgba(26,22,18,0.06)",
          borderBottom: "1px solid rgba(26,22,18,0.06)",
          padding: "64px 24px",
        }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div className="lp-grid-valeurs">
              {VALEURS.map(v => (
                <div key={v.n} style={{ textAlign: "center", padding: "8px 12px" }}>
                  <div style={{
                    fontFamily: serif,
                    fontSize: "clamp(32px, 4vw, 44px)",
                    fontWeight: 300, color: C.orange,
                    lineHeight: 1, marginBottom: 4,
                  }}>
                    {v.n}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 700,
                    letterSpacing: "0.10em", textTransform: "uppercase",
                    color: C.text, marginBottom: 8,
                  }}>
                    {v.label}
                  </div>
                  <p style={{
                    fontSize: 13, color: C.muted, lineHeight: 1.55,
                    margin: 0, maxWidth: 200, marginLeft: "auto", marginRight: "auto",
                  }}>
                    {v.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            6. COMMENT ÇA MARCHE — 3 étapes
        ══════════════════════════════════════════════════════════════ */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{
              fontFamily: serif,
              fontSize: "clamp(26px, 3.5vw, 38px)",
              fontWeight: 300, color: C.text, margin: "0 0 12px",
            }}>
              Comment ça marche
            </h2>
            <p style={{ fontSize: 15, color: C.muted, margin: 0 }}>
              Trois étapes — deux minutes.
            </p>
          </div>

          <div className="lp-grid-etapes">
            {ETAPES.map((e, i) => (
              <div key={e.n} style={{
                background: C.surface,
                border: `0.5px solid ${C.border}`,
                borderRadius: 14,
                padding: "32px 28px",
                boxShadow: "0 2px 16px rgba(26,22,18,0.05)",
                position: "relative",
              }}>
                {/* Connecteur horizontal */}
                {i < 2 && (
                  <div style={{
                    display: "none", // visible en CSS @media desktop uniquement
                  }} />
                )}
                <div style={{
                  fontFamily: serif,
                  fontSize: 48, fontWeight: 300,
                  color: "rgba(232,96,44,0.15)", lineHeight: 1,
                  marginBottom: 16,
                }}>
                  {e.n}
                </div>
                <h3 style={{
                  fontFamily: serif,
                  fontSize: 20, fontWeight: 400, color: C.text,
                  margin: "0 0 10px",
                }}>
                  {e.titre}
                </h3>
                <p style={{
                  fontSize: 14, color: C.muted, lineHeight: 1.65,
                  margin: 0,
                }}>
                  {e.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            7. 4 RÔLES
        ══════════════════════════════════════════════════════════════ */}
        <section style={{
          background: "rgba(26,22,18,0.02)",
          borderTop: "1px solid rgba(26,22,18,0.06)",
          padding: "80px 24px",
        }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <h2 style={{
                fontFamily: serif,
                fontSize: "clamp(26px, 3.5vw, 38px)",
                fontWeight: 300, color: C.text, margin: "0 0 12px",
              }}>
                Un outil pour chaque acteur
              </h2>
              <p style={{ fontSize: 15, color: C.muted, margin: 0 }}>
                Pas un logiciel de plus — un assistant qui s&apos;adapte à votre rôle.
              </p>
            </div>

            <div className="lp-grid-roles">
              {ROLES.map(r => (
                <div key={r.titre} style={{
                  background: C.surface,
                  border: `0.5px solid ${C.border}`,
                  borderRadius: 14,
                  padding: "28px 24px",
                  boxShadow: "0 2px 16px rgba(26,22,18,0.05)",
                  display: "flex", flexDirection: "column",
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${r.accent}14`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, marginBottom: 16, color: r.accent,
                  }}>
                    {r.icon}
                  </div>

                  <h3 style={{
                    fontFamily: serif,
                    fontSize: 20, fontWeight: 400, color: C.text,
                    margin: "0 0 8px",
                  }}>
                    {r.titre}
                  </h3>

                  <p style={{
                    fontSize: 13, color: C.muted, lineHeight: 1.65,
                    margin: "0 0 20px", flex: 1,
                  }}>
                    {r.desc}
                  </p>

                  {/* Prix */}
                  <div style={{ marginBottom: 18 }}>
                    <span style={{
                      fontFamily: serif,
                      fontSize: 26, fontWeight: 300, color: r.accent,
                    }}>
                      {r.prix}
                    </span>
                    {r.periode && (
                      <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>
                        {r.periode}
                      </span>
                    )}
                    {r.note && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                        {r.note}
                      </div>
                    )}
                  </div>

                  <Link href={r.href} style={{
                    display: "block", textAlign: "center",
                    padding: "9px 0", borderRadius: 9,
                    background: `${r.accent}12`,
                    color: r.accent, fontSize: 13, fontWeight: 600,
                    textDecoration: "none",
                    border: `1px solid ${r.accent}28`,
                  }}>
                    {r.cta} →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            8. CTA BAND
        ══════════════════════════════════════════════════════════════ */}
        <section style={{
          background: C.dark,
          padding: "80px 24px",
          textAlign: "center",
        }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <p style={{
              fontSize: 11, fontWeight: 700,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: "rgba(250,250,248,0.4)", marginBottom: 20,
            }}>
              Disponible maintenant
            </p>
            <h2 style={{
              fontFamily: serif,
              fontSize: "clamp(28px, 4.5vw, 48px)",
              fontWeight: 300, lineHeight: 1.15,
              color: "#FAFAF8", margin: "0 0 16px",
            }}>
              Rejoignez l&apos;immobilier<br />qui vous ressemble
            </h2>
            <p style={{
              fontSize: 15, color: "rgba(250,250,248,0.55)",
              margin: "0 0 36px", lineHeight: 1.6,
            }}>
              Propriétaires, agences, artisans, locataires — un seul écosystème.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/register" style={{
                padding: "13px 30px", borderRadius: 12,
                background: C.orange, color: "#fff",
                fontSize: 15, fontWeight: 700, textDecoration: "none",
                boxShadow: "0 4px 20px rgba(232,96,44,0.35)",
              }}>
                Commencer gratuitement
              </Link>
              <Link href="/estimation" style={{
                padding: "13px 28px", borderRadius: 12,
                border: "1.5px solid rgba(250,250,248,0.20)",
                color: "rgba(250,250,248,0.80)",
                fontSize: 15, fontWeight: 500, textDecoration: "none",
              }}>
                Estimer mon bien
              </Link>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            9. FOOTER
        ══════════════════════════════════════════════════════════════ */}
        <Footer />

      </div>
    </>
  );
}
