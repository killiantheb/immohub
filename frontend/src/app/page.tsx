import Link from 'next/link'
import { HeroSphere } from '@/components/HeroSphere'

// ── Tokens ─────────────────────────────────────────────────────────────────────
const O = '#D4601A'
const O12 = 'rgba(212,96,26,0.10)'
const O20 = 'rgba(212,96,26,0.22)'
const T = '#1C0F06'
const T5 = 'rgba(80,35,8,0.58)'
const T3 = 'rgba(80,35,8,0.32)'
const BG = '#FAF5EB'
const BG2 = '#F5EDE0'

// ── Helpers ────────────────────────────────────────────────────────────────────
function Divider() {
  return <div style={{ width: '100%', height: '0.5px', background: O20 }} />
}

function Section({ id, children, style }: { id?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section id={id} style={{ maxWidth: 1080, margin: '0 auto', padding: '5rem 1.5rem', ...style }}>
      {children}
    </section>
  )
}

// ── Data ───────────────────────────────────────────────────────────────────────
const STATS = [
  { val: '3 %', lbl: 'commission visible' },
  { val: '6 h', lbl: 'économisées / semaine' },
  { val: '0', lbl: 'formulaire à remplir' },
  { val: '24 / 7', lbl: 'disponible' },
]

const STEPS = [
  { n: '01', title: 'Vous parlez', desc: 'Dites à Cathy ce que vous voulez faire. Voix ou texte, en français, naturellement.' },
  { n: '02', title: 'Cathy analyse', desc: 'Elle lit vos données en temps réel — loyers, contrats, missions, devis — et propose une action.' },
  { n: '03', title: 'Vous validez', desc: 'Un tap suffit. Vous restez décisionnaire ; Cathy exécute sans friction.' },
  { n: '04', title: 'Les revenus arrivent', desc: 'Relances automatiques, documents générés, intervenants coordonnés. Zéro oubli.' },
]

const PERSONAS = [
  {
    icon: '🏠', role: 'Propriétaire', color: '#D4601A',
    features: ['Suivi des loyers en temps réel', 'Relances automatiques', 'Documents générés en 1 clic', 'Vue globale de votre patrimoine'],
  },
  {
    icon: '🏢', role: 'Agence', color: '#185FA5',
    features: ['Tableau de bord multi-biens', 'Affectation des ouvreurs', 'Pipeline de location', 'Rapports propriétaires automatiques'],
  },
  {
    icon: '🔑', role: 'Ouvreur', color: '#854F0B',
    features: ['Missions proches géolocalisées', 'Acceptation en 1 tap', 'Suivi des revenus du mois', 'Agenda intégré'],
  },
  {
    icon: '🛋️', role: 'Locataire', color: '#3B6D11',
    features: ['Prochain loyer en un coup d\'œil', 'Documents accessibles', 'Signalement de problème', 'Historique complet'],
  },
  {
    icon: '🔧', role: 'Artisan', color: '#6B4590',
    features: ['Appels d\'offre filtrés par spécialité', 'Devis en 2 minutes', 'Suivi de chantier simplifié', 'Paiement tracé'],
  },
]

const PLANS = [
  {
    name: 'Starter', price: 49, currency: 'CHF', period: 'mois',
    desc: 'Pour les propriétaires indépendants',
    features: ['Jusqu\'à 3 biens', 'Assistant Cathy inclus', 'Relances automatiques', 'Documents PDF', 'Support par e-mail'],
    cta: 'Commencer gratuitement', featured: false,
  },
  {
    name: 'Pro', price: 149, currency: 'CHF', period: 'mois',
    desc: 'Pour les agences et portfolios actifs',
    features: ['Biens illimités', 'Ouvreurs & artisans intégrés', 'Briefing IA quotidien', 'Rapports avancés', 'API access', 'Support prioritaire'],
    cta: 'Démarrer en Pro', featured: true,
  },
  {
    name: 'Agency', price: 399, currency: 'CHF', period: 'mois',
    desc: 'Pour les grandes agences',
    features: ['Multi-comptes & marque blanche', 'Onboarding dédié', 'SLA garanti', 'Intégrations sur mesure', 'Manager dédié', 'Formation équipe'],
    cta: 'Nous contacter', featured: false,
  },
]

// ── Page ───────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div style={{ background: BG, color: T, fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(250,245,235,0.92)', backdropFilter: 'blur(12px)', borderBottom: `0.5px solid ${O20}`, height: 56, display: 'flex', alignItems: 'center', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 300, color: O, letterSpacing: '3px' }}>Cathy</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: 13, color: T5 }}>
              {['Comment ça marche', 'Pour qui', 'Tarifs'].map((lbl, i) => (
                <Link key={i} href={`#${['how', 'who', 'pricing'][i]}`} style={{ color: T5, textDecoration: 'none', letterSpacing: '0.5px' }}>
                  {lbl}
                </Link>
              ))}
            </div>
            <Link href="/register" style={{ padding: '7px 18px', borderRadius: 24, background: O, color: '#fff', fontSize: 12, fontWeight: 500, textDecoration: 'none', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
              Essayer gratuitement
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <Section style={{ paddingTop: '8rem', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 11, letterSpacing: '8px', color: `rgba(200,95,25,0.38)`, textTransform: 'uppercase', marginBottom: '2.5rem' }}>
          Cathy · Assistant immobilier
        </p>
        <HeroSphere />
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2.4rem, 6vw, 4.2rem)', fontWeight: 300, lineHeight: 1.12, letterSpacing: '-0.5px', color: T, marginBottom: '1.2rem', maxWidth: 720, margin: '0 auto 1.2rem' }}>
          Parlez.<br />
          <span style={{ color: O }}>Cathy fait le reste.</span>
        </h1>
        <p style={{ fontSize: 'clamp(14px, 2vw, 17px)', color: T5, maxWidth: 460, margin: '0 auto 2.5rem', lineHeight: 1.6, letterSpacing: '0.3px' }}>
          Votre assistant immobilier — toujours disponible, toujours à jour, jamais dans vos jambes.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{ padding: '12px 28px', borderRadius: 28, background: O, color: '#fff', fontSize: 14, fontWeight: 500, textDecoration: 'none', letterSpacing: '0.5px' }}>
            Démarrer gratuitement
          </Link>
          <Link href="#how" style={{ padding: '12px 28px', borderRadius: 28, border: `0.5px solid ${O20}`, background: O12, color: T5, fontSize: 14, textDecoration: 'none', letterSpacing: '0.5px' }}>
            Voir comment ça marche
          </Link>
        </div>
      </Section>

      <Divider />

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: `0.5px solid ${O20}`, borderRadius: 20 }}>
          {STATS.map((s, i) => (
            <div key={i} style={{ padding: '2rem 1rem', textAlign: 'center', borderRight: i < 3 ? `0.5px solid ${O20}` : 'none' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 300, color: O, letterSpacing: 2, marginBottom: 6 }}>
                {s.val}
              </div>
              <div style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3 }}>
                {s.lbl}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <Section id="how">
        <p style={{ fontSize: 10, letterSpacing: '4px', textTransform: 'uppercase', color: `rgba(200,95,25,0.4)`, marginBottom: '0.8rem', textAlign: 'center' }}>
          Comment ça marche
        </p>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 300, textAlign: 'center', color: T, marginBottom: '3rem', letterSpacing: '-0.3px' }}>
          Simple comme une conversation
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ background: BG2, borderRadius: 20, padding: '2rem', border: `0.5px solid ${O20}`, position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 56, fontWeight: 300, color: O12, position: 'absolute', top: 12, right: 20, lineHeight: 1, userSelect: 'none' }}>
                {s.n}
              </div>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: `0.5px solid ${O20}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', fontSize: 11, color: O, letterSpacing: 1 }}>
                {s.n}
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 300, color: T, marginBottom: 8, letterSpacing: '0.5px' }}>
                {s.title}
              </h3>
              <p style={{ fontSize: 13, color: T5, lineHeight: 1.65 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── For who ───────────────────────────────────────────────────────── */}
      <Section id="who">
        <p style={{ fontSize: 10, letterSpacing: '4px', textTransform: 'uppercase', color: `rgba(200,95,25,0.4)`, marginBottom: '0.8rem', textAlign: 'center' }}>
          Pour qui
        </p>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 300, textAlign: 'center', color: T, marginBottom: '3rem', letterSpacing: '-0.3px' }}>
          Un espace dédié pour chaque profil
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {PERSONAS.map((p, i) => (
            <div key={i} style={{ background: BG2, borderRadius: 18, padding: '1.6rem', border: `0.5px solid ${O20}` }}>
              <div style={{ fontSize: 28, marginBottom: '0.8rem' }}>{p.icon}</div>
              <h3 style={{ fontSize: 14, fontWeight: 500, color: T, marginBottom: '1rem', letterSpacing: '0.5px' }}>{p.role}</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {p.features.map((f, j) => (
                  <li key={j} style={{ fontSize: 12, color: T5, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ color: p.color, marginTop: 1, flexShrink: 0 }}>·</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── Pricing ───────────────────────────────────────────────────────── */}
      <Section id="pricing">
        <p style={{ fontSize: 10, letterSpacing: '4px', textTransform: 'uppercase', color: `rgba(200,95,25,0.4)`, marginBottom: '0.8rem', textAlign: 'center' }}>
          Tarifs
        </p>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 300, textAlign: 'center', color: T, marginBottom: '0.8rem', letterSpacing: '-0.3px' }}>
          Transparent. Sans surprise.
        </h2>
        <p style={{ textAlign: 'center', color: T5, fontSize: 13, marginBottom: '3rem' }}>
          14 jours d&apos;essai gratuit · Pas de carte de crédit requise
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }}>
          {PLANS.map((plan, i) => (
            <div key={i} style={{ borderRadius: 22, padding: plan.featured ? '2.4rem 2rem' : '2rem', border: plan.featured ? `1px solid ${O}` : `0.5px solid ${O20}`, background: plan.featured ? `rgba(212,96,26,0.06)` : BG2, position: 'relative', overflow: 'hidden' }}>
              {plan.featured && (
                <div style={{ position: 'absolute', top: 14, right: 14, fontSize: 10, padding: '3px 10px', borderRadius: 20, background: O, color: '#fff', letterSpacing: 1, textTransform: 'uppercase' }}>
                  Populaire
                </div>
              )}
              <p style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: plan.featured ? O : T3, marginBottom: '0.5rem' }}>
                {plan.name}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: '0.3rem' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 42, fontWeight: 300, color: T, lineHeight: 1 }}>
                  {plan.price}
                </span>
                <span style={{ fontSize: 13, color: T5 }}>{plan.currency} / {plan.period}</span>
              </div>
              <p style={{ fontSize: 12, color: T5, marginBottom: '1.5rem', lineHeight: 1.5 }}>{plan.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.8rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{ fontSize: 12.5, color: T5, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                      <circle cx="8" cy="8" r="7.5" stroke={plan.featured ? O : 'rgba(212,96,26,0.3)'} strokeWidth="0.5" />
                      <path d="M5 8l2 2 4-4" stroke={plan.featured ? O : T3} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" style={{ display: 'block', textAlign: 'center', padding: '11px 0', borderRadius: 24, background: plan.featured ? O : 'transparent', border: plan.featured ? 'none' : `0.5px solid ${O20}`, color: plan.featured ? '#fff' : T5, fontSize: 13, fontWeight: plan.featured ? 500 : 400, textDecoration: 'none', letterSpacing: '0.3px' }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <Section style={{ textAlign: 'center', padding: '6rem 1.5rem' }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 11, letterSpacing: '8px', color: `rgba(200,95,25,0.38)`, textTransform: 'uppercase', marginBottom: '1.5rem' }}>
          Rejoignez Cathy
        </p>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 5vw, 3.6rem)', fontWeight: 300, color: T, marginBottom: '1rem', letterSpacing: '-0.5px', lineHeight: 1.15 }}>
          Prêt à laisser<br />
          <span style={{ color: O }}>Cathy gérer ?</span>
        </h2>
        <p style={{ fontSize: 15, color: T5, maxWidth: 420, margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
          Rejoignez des centaines de professionnels qui ont repris le contrôle de leur temps.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register" style={{ padding: '13px 32px', borderRadius: 28, background: O, color: '#fff', fontSize: 14, fontWeight: 500, textDecoration: 'none', letterSpacing: '0.5px' }}>
            Démarrer gratuitement
          </Link>
          <Link href="/login" style={{ padding: '13px 32px', borderRadius: 28, border: `0.5px solid ${O20}`, background: O12, color: T5, fontSize: 14, textDecoration: 'none', letterSpacing: '0.5px' }}>
            Se connecter
          </Link>
        </div>
      </Section>

      <Divider />

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ maxWidth: 1080, margin: '0 auto', padding: '2.5rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 300, color: O, letterSpacing: '3px' }}>Cathy</span>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {[['Mentions légales', '/legal'], ['Confidentialité', '/privacy'], ['CGU', '/terms'], ['Contact', '/contact']].map(([lbl, href]) => (
            <Link key={href} href={href} style={{ fontSize: 11, color: T3, textDecoration: 'none', letterSpacing: '0.5px' }}>
              {lbl}
            </Link>
          ))}
        </div>
        <span style={{ fontSize: 11, color: T3, letterSpacing: '0.5px' }}>
          © {new Date().getFullYear()} Cathy · Tous droits réservés
        </span>
      </footer>

    </div>
  )
}
