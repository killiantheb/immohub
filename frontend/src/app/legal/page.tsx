import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mentions légales — Althy' }

export default function LegalPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAF5EB', fontFamily: 'var(--font-sans)', padding: '4rem 1.5rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/" style={{ fontSize: 11, color: 'rgba(80,35,8,0.4)', textDecoration: 'none', letterSpacing: '2px', textTransform: 'uppercase' }}>← Retour</Link>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 300, color: '#1C0F06', margin: '2rem 0 1rem' }}>
          Mentions légales
        </h1>
        <p style={{ color: 'rgba(80,35,8,0.5)', fontSize: 12, marginBottom: '3rem' }}>Dernière mise à jour : avril 2026</p>

        {[
          ['Éditeur du site', 'Althy\nEntreprise individuelle\nSuisse romande\nEmail : contact@althy.ch\n\nAlthy est un service en cours de développement. Aucune société formellement constituée n\'opère sous ce nom à ce jour.'],
          ['Responsable de la publication', 'Le responsable de la publication est le fondateur d\'Althy, joignable à l\'adresse contact@althy.ch.'],
          ['Hébergement', 'Le frontend (interface web) est hébergé par Vercel Inc., 340 Pine Street, Suite 900, San Francisco, CA 94104, États-Unis.\n\nLe backend (API et base de données) est hébergé par Railway Corp., San Francisco, États-Unis.\n\nL\'authentification est gérée par Supabase Inc., San Francisco, États-Unis.\n\nCes hébergeurs sont des prestataires américains. Les données peuvent être traitées aux États-Unis dans le cadre de leurs infrastructures mondiales.'],
          ['Propriété intellectuelle', 'L\'ensemble du contenu de ce site (textes, logo, interface) est la propriété d\'Althy et est protégé par le droit suisse de la propriété intellectuelle. Toute reproduction sans autorisation est interdite.'],
          ['Responsabilité', 'Althy ne peut être tenu responsable des dommages directs ou indirects résultant de l\'utilisation du site ou de l\'impossibilité d\'y accéder. Le service est fourni « en l\'état » sans garantie d\'uptime.'],
          ['Droit applicable', 'Les présentes mentions légales sont soumises au droit suisse. Tout litige relève de la compétence exclusive des tribunaux du canton de Vaud.'],
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
