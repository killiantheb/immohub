'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

interface TenantDocument {
  id: string
  name: string
  type: string
  url: string
  created_at: string
}

export default function TenantDocumentsPage() {
  const [docs, setDocs] = useState<TenantDocument[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    api.get<TenantDocument[]>('/tenants/me/documents')
      .then(r => setDocs(r.data))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [])

  const TYPE_LABEL: Record<string, string> = {
    lease: 'Contrat de bail',
    receipt: 'Quittance de loyer',
    insurance: 'Attestation assurance',
    other: 'Autre',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5EB', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1.2rem', fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <button
            onClick={() => router.back()}
            style={{ fontSize: 11, letterSpacing: '1px', color: 'rgba(80,35,8,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ← Retour
          </button>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 11, letterSpacing: '6px', color: 'rgba(180,80,20,0.45)', textTransform: 'uppercase', margin: 0 }}>Althy</p>
        </div>

        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 300, color: '#1C0F06', marginBottom: '1.5rem', letterSpacing: '0.5px' }}>
          Mes documents
        </h1>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 64, background: 'rgba(212,96,26,0.06)', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'rgba(80,35,8,0.4)', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: '1rem' }}>📄</div>
            Aucun document disponible pour le moment.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {docs.map(doc => (
              <a
                key={doc.id}
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '0.5px solid rgba(212,96,26,0.15)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <span style={{ fontSize: 22 }}>📄</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#1C0F06', fontWeight: 500 }}>{doc.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(80,35,8,0.45)', marginTop: 2 }}>
                    {TYPE_LABEL[doc.type] ?? doc.type} · {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="rgba(212,96,26,0.6)" strokeWidth={1.5} strokeLinecap="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
