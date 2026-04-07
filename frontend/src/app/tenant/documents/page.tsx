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

interface Quittance {
  id: string
  created_at: string
  status: string
}

const O = '#D4601A'
const T = '#1C0F06'
const T4 = 'rgba(80,35,8,0.45)'
const T3 = 'rgba(80,35,8,0.32)'
const O20 = 'rgba(212,96,26,0.20)'
const O06 = 'rgba(212,96,26,0.06)'

const TYPE_LABEL: Record<string, string> = {
  lease: 'Contrat de bail',
  receipt: 'Quittance de loyer',
  insurance: 'Attestation assurance',
  other: 'Autre',
}

function fmtMonth(iso: string) {
  return new Date(iso).toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })
}

export default function TenantDocumentsPage() {
  const [docs, setDocs] = useState<TenantDocument[]>([])
  const [quittances, setQuittances] = useState<Quittance[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    Promise.all([
      api.get<TenantDocument[]>('/tenants/me/documents').then(r => setDocs(r.data)).catch(() => {}),
      api.get<Quittance[]>('/tenants/me/quittances').then(r => setQuittances(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5EB', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1.2rem 4rem', fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <button
            onClick={() => router.back()}
            style={{ fontSize: 11, letterSpacing: '1px', color: T3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ← Retour
          </button>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 11, letterSpacing: '6px', color: 'rgba(180,80,20,0.45)', textTransform: 'uppercase', margin: 0 }}>Althy</p>
        </div>

        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 300, color: T, marginBottom: '1.5rem', letterSpacing: '0.5px' }}>
          Mes documents
        </h1>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: 64, background: O06, borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Property documents */}
            {docs.length > 0 && (
              <section>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: T4, marginBottom: 8 }}>Documents du bail</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {docs.map(doc => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: `0.5px solid ${O20}`, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <span style={{ fontSize: 20 }}>📄</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: T, fontWeight: 500 }}>{doc.name}</div>
                        <div style={{ fontSize: 11, color: T4, marginTop: 2 }}>
                          {TYPE_LABEL[doc.type] ?? doc.type} · {new Date(doc.created_at).toLocaleDateString('fr-CH')}
                        </div>
                      </div>
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={O} strokeWidth={1.5} strokeLinecap="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Quittances */}
            {quittances.length > 0 && (
              <section>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: T4, marginBottom: 8 }}>Quittances de loyer</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {quittances.map(q => (
                    <div
                      key={q.id}
                      style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: `0.5px solid ${O20}`, display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <span style={{ fontSize: 20 }}>🧾</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: T, fontWeight: 500 }}>Quittance — {fmtMonth(q.created_at)}</div>
                        <div style={{ fontSize: 11, color: T4, marginTop: 2 }}>
                          {new Date(q.created_at).toLocaleDateString('fr-CH')}
                          <span style={{
                            marginLeft: 8,
                            padding: '1px 7px',
                            borderRadius: 20,
                            fontSize: 10,
                            background: q.status === 'generated' ? 'rgba(59,109,17,0.1)' : 'rgba(133,79,11,0.1)',
                            color: q.status === 'generated' ? '#3B6D11' : '#854F0B',
                          }}>
                            {q.status === 'generated' ? 'Générée' : q.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {docs.length === 0 && quittances.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: T4, fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: '1rem' }}>📄</div>
                Aucun document disponible pour le moment.
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
