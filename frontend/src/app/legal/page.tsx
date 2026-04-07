import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mentions légales' }

export default function LegalPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAF5EB', fontFamily: 'var(--font-sans)', padding: '4rem 1.5rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/" style={{ fontSize: 11, color: 'rgba(80,35,8,0.4)', textDecoration: 'none', letterSpacing: '2px', textTransform: 'uppercase' }}>← Retour</Link>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 300, color: '#1C0F06', margin: '2rem 0 1rem' }}>
          Mentions légales
        </h1>
        <p style={{ color: 'rgba(80,35,8,0.5)', fontSize: 12, marginBottom: '3rem' }}>Dernière mise à jour : avril 2025</p>

        {[
          ['Éditeur', 'Althy SA\nSuisse\nEmail : contact@althy.ch'],
          ['Hébergement', 'Le site althy.ch est hébergé par Vercel Inc. (San Francisco, USA) et Railway (San Francisco, USA). Les données sont traitées sur des serveurs sécurisés.'],
          ['Propriété intellectuelle', 'L\'ensemble du contenu de ce site (textes, images, logo, interface) est la propriété exclusive d\'Althy SA et est protégé par le droit suisse de la propriété intellectuelle.'],
          ['Responsabilité', 'Althy SA ne peut être tenu responsable des dommages directs ou indirects résultant de l\'utilisation du site ou de l\'impossibilité d\'y accéder.'],
        ].map(([title, text]) => (
          <div key={title} style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: '#1C0F06', marginBottom: '0.5rem' }}>{title}</h2>
            <p style={{ fontSize: 14, color: 'rgba(80,35,8,0.65)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
