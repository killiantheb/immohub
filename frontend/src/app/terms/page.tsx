import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Conditions générales d\'utilisation' }

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAF5EB', fontFamily: 'var(--font-sans)', padding: '4rem 1.5rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/" style={{ fontSize: 11, color: 'rgba(80,35,8,0.4)', textDecoration: 'none', letterSpacing: '2px', textTransform: 'uppercase' }}>← Retour</Link>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 300, color: '#1C0F06', margin: '2rem 0 1rem' }}>
          Conditions générales d&apos;utilisation
        </h1>
        <p style={{ color: 'rgba(80,35,8,0.5)', fontSize: 12, marginBottom: '3rem' }}>Dernière mise à jour : avril 2025</p>

        {[
          ['1. Acceptation', 'En utilisant Althy, vous acceptez les présentes conditions générales d\'utilisation. Si vous n\'acceptez pas ces conditions, veuillez ne pas utiliser le service.'],
          ['2. Description du service', 'Althy est une plateforme de gestion immobilière suisse permettant aux propriétaires, agences, locataires et artisans de gérer leurs interactions via un assistant IA.'],
          ['3. Abonnement et paiement', 'L\'accès au service est soumis à un abonnement mensuel. Les tarifs sont indiqués sur la page Tarifs. La facturation est mensuelle et automatique.'],
          ['4. Responsabilité', 'Althy est un outil d\'assistance. Les décisions finales restent de la responsabilité de l\'utilisateur. Althy ne peut être tenu responsable des décisions prises sur la base des informations fournies.'],
          ['5. Résiliation', 'Vous pouvez résilier votre abonnement à tout moment depuis votre espace client. La résiliation prend effet à la fin de la période de facturation en cours.'],
          ['6. Droit applicable', 'Les présentes CGU sont soumises au droit suisse. Tout litige sera soumis à la juridiction des tribunaux de Genève.'],
        ].map(([title, text]) => (
          <div key={title} style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: '#1C0F06', marginBottom: '0.5rem' }}>{title}</h2>
            <p style={{ fontSize: 14, color: 'rgba(80,35,8,0.65)', lineHeight: 1.7 }}>{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
