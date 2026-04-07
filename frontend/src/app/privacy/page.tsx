import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Politique de confidentialité' }

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAF5EB', fontFamily: 'var(--font-sans)', padding: '4rem 1.5rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/" style={{ fontSize: 11, color: 'rgba(80,35,8,0.4)', textDecoration: 'none', letterSpacing: '2px', textTransform: 'uppercase' }}>← Retour</Link>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 300, color: '#1C0F06', margin: '2rem 0 1rem' }}>
          Politique de confidentialité
        </h1>
        <p style={{ color: 'rgba(80,35,8,0.5)', fontSize: 12, marginBottom: '3rem' }}>Dernière mise à jour : avril 2025</p>

        {[
          ['1. Données collectées', 'Althy collecte uniquement les données nécessaires au fonctionnement du service : nom, email, informations sur vos biens immobiliers et transactions. Aucune donnée n\'est vendue à des tiers.'],
          ['2. Utilisation des données', 'Vos données sont utilisées pour vous fournir le service Althy : gestion de vos biens, contrats, transactions et communications avec votre assistant IA. Les données sont hébergées sur des serveurs sécurisés en Europe.'],
          ['3. Cookies', 'Althy utilise des cookies essentiels au fonctionnement du service (authentification, préférences). Aucun cookie publicitaire ou de tracking tiers n\'est utilisé.'],
          ['4. Vos droits', 'Conformément au RGPD, vous disposez d\'un droit d\'accès, de rectification, d\'effacement et de portabilité de vos données. Contactez-nous à privacy@althy.ch.'],
          ['5. Contact', 'Pour toute question relative à vos données personnelles : privacy@althy.ch'],
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
