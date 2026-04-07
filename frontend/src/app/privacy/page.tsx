import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Politique de confidentialité — Althy' }

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FAF5EB', fontFamily: 'var(--font-sans)', padding: '4rem 1.5rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link href="/" style={{ fontSize: 11, color: 'rgba(80,35,8,0.4)', textDecoration: 'none', letterSpacing: '2px', textTransform: 'uppercase' }}>← Retour</Link>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 300, color: '#1C0F06', margin: '2rem 0 1rem' }}>
          Politique de confidentialité
        </h1>
        <p style={{ color: 'rgba(80,35,8,0.5)', fontSize: 12, marginBottom: '3rem' }}>Dernière mise à jour : avril 2026</p>

        {[
          ['1. Cadre légal applicable', 'La présente politique est établie conformément à la Loi fédérale sur la protection des données (LPD, RS 235.1), entrée en vigueur le 1er septembre 2023. Pour les utilisateurs résidant dans l\'Union européenne, le Règlement général sur la protection des données (RGPD) s\'applique en complément.'],
          ['2. Données collectées', 'Althy collecte uniquement les données nécessaires au fonctionnement du service :\n• Données d\'identification : prénom, nom, adresse email\n• Données immobilières : informations sur vos biens, contrats, locataires\n• Données financières : montants de loyers, dépôts de garantie (aucune donnée de carte bancaire — les paiements sont gérés par Stripe)\n• Données techniques : adresse IP (pour la signature électronique), journaux de connexion\n\nAucune donnée n\'est vendue à des tiers.'],
          ['3. Finalités du traitement', 'Vos données sont utilisées pour :\n• Fournir le service Althy (gestion de biens, contrats, documents)\n• Envoyer des notifications liées à votre compte (relances, rappels)\n• Améliorer le service (analyses agrégées et anonymisées)\n• Respecter nos obligations légales'],
          ['4. Sous-traitants et transferts internationaux', 'Althy fait appel aux sous-traitants suivants, qui peuvent traiter vos données en dehors de la Suisse :\n• Supabase Inc. (USA) — authentification et stockage de fichiers\n• Vercel Inc. (USA) — hébergement du frontend\n• Railway Corp. (USA) — hébergement du backend et base de données\n• Anthropic PBC (USA) — traitement IA des requêtes (sans conservation de vos données par Anthropic)\n• Stripe Inc. (USA) — traitement des paiements\n\nCes transferts vers les États-Unis sont encadrés par les garanties contractuelles appropriées (clauses contractuelles types).'],
          ['5. Durée de conservation', 'Vos données sont conservées pendant toute la durée de votre abonnement actif, puis supprimées dans un délai de 90 jours suivant la résiliation, sauf obligation légale de conservation plus longue (10 ans pour les données comptables selon le CO suisse).'],
          ['6. Vos droits (LPD art. 25–27)', 'Conformément à la LPD, vous disposez des droits suivants :\n• Droit d\'accès à vos données personnelles\n• Droit de rectification des données inexactes\n• Droit à l\'effacement (« droit à l\'oubli »)\n• Droit à la portabilité de vos données\n• Droit d\'opposition au traitement\n\nPour exercer ces droits : privacy@althy.ch\nRéponse garantie dans les 30 jours.'],
          ['7. Cookies', 'Althy utilise uniquement des cookies techniques essentiels au fonctionnement du service (gestion de session, authentification). Aucun cookie publicitaire ou de tracking tiers n\'est utilisé.'],
          ['8. Sécurité', 'Vos données sont protégées par un chiffrement TLS en transit et au repos. L\'accès est limité aux personnes habilitées. En cas de violation de données, vous serez notifié dans les délais prévus par la LPD.'],
          ['9. Contact', 'Responsable du traitement : Althy, contact@althy.ch\nDélégué à la protection des données : privacy@althy.ch'],
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
