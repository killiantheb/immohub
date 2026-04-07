import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Contact' }

export default function ContactPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAF5EB', fontFamily: 'var(--font-sans)', padding: '4rem 1.5rem' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <Link href="/" style={{ fontSize: 11, color: 'rgba(80,35,8,0.4)', textDecoration: 'none', letterSpacing: '2px', textTransform: 'uppercase' }}>← Retour</Link>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 300, color: '#1C0F06', margin: '2rem 0 1rem' }}>
          Contact
        </h1>
        <p style={{ color: 'rgba(80,35,8,0.55)', fontSize: 14, lineHeight: 1.7, marginBottom: '3rem' }}>
          Une question ? Besoin d&apos;aide ? Notre équipe répond en moins de 24 heures.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'Support général', value: 'support@althy.ch', href: 'mailto:support@althy.ch' },
            { label: 'Partenariats & agences', value: 'partnerships@althy.ch', href: 'mailto:partnerships@althy.ch' },
            { label: 'Données personnelles', value: 'privacy@althy.ch', href: 'mailto:privacy@althy.ch' },
          ].map(item => (
            <div key={item.label} style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', border: '0.5px solid rgba(212,96,26,0.15)', textAlign: 'left' }}>
              <p style={{ fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(80,35,8,0.4)', marginBottom: 6 }}>{item.label}</p>
              <a href={item.href} style={{ fontSize: 15, color: '#D4601A', textDecoration: 'none', fontWeight: 400 }}>{item.value}</a>
            </div>
          ))}
        </div>

        <p style={{ marginTop: '3rem', fontSize: 12, color: 'rgba(80,35,8,0.35)' }}>
          Althy · Suisse · Réponse sous 24h ouvrées
        </p>
      </div>
    </div>
  )
}
