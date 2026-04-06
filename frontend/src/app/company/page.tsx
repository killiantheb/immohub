'use client'
import { useState, useEffect } from 'react'
import { CathySphere } from '@/components/CathySphere'
import { api } from '@/lib/api'

interface ServiceRequest {
  id: string
  title: string
  description: string
  specialty: string
  address: string
  budget_min: number
  budget_max: number
  currency: string
  deadline: string
  status: 'open' | 'in_progress' | 'completed'
}

interface Quote {
  id: string
  service_request_id: string
  title: string
  amount: number
  currency: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

const SPEC_COLORS: Record<string, string> = {
  plomberie: '#185FA5',
  electricite: '#854F0B',
  peinture: '#3B6D11',
  menuiserie: '#A32D2D',
  maçonnerie: '#4A3060',
  default: '#555',
}

export default function CompanyPage() {
  const [rfqs, setRfqs] = useState<ServiceRequest[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loadingRfqs, setLoadingRfqs] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [status, setStatus] = useState('à votre écoute')

  useEffect(() => {
    api.get<ServiceRequest[]>('/service-requests?available=true')
      .then(r => setRfqs(r.data))
      .catch(() => setRfqs([]))
      .finally(() => setLoadingRfqs(false))
    api.get<Quote[]>('/service-requests/my-quotes')
      .then(r => setQuotes(r.data))
      .catch(() => setQuotes([]))
  }, [])

  async function markDone(quoteId: string) {
    setActionId(quoteId)
    try {
      await api.put(`/service-requests/quotes/${quoteId}/complete`, {})
      setQuotes(qs => qs.map(q => q.id === quoteId ? { ...q, status: 'accepted' as const } : q))
      setStatus('Travaux marqués comme terminés ✓')
    } catch {
      setStatus('Erreur, réessayez.')
    } finally {
      setActionId(null)
    }
  }

  async function applyRfq(id: string) {
    setActionId(id)
    try {
      await api.post(`/service-requests/${id}/apply`, {})
      setRfqs(rs => rs.filter(r => r.id !== id))
      setStatus('Candidature envoyée ✓')
    } catch {
      setStatus('Erreur, réessayez.')
    } finally {
      setActionId(null)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  function specColor(spec: string) {
    const key = spec?.toLowerCase()
    return SPEC_COLORS[key] ?? SPEC_COLORS.default
  }

  const activeQuotes = quotes.filter(q => q.status === 'pending')

  return (
    <div style={{ minHeight: '100vh', background: '#060402', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1.2rem', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 11, letterSpacing: '6px', color: 'rgba(200,95,25,0.38)', textTransform: 'uppercase', margin: 0 }}>Cathy</p>
        <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(200,95,25,0.35)', padding: '4px 10px', borderRadius: 20, border: '0.5px solid rgba(212,96,26,0.12)' }}>Artisan</span>
      </div>

      {/* Sphere */}
      <div style={{ marginBottom: '1rem', filter: 'drop-shadow(0 12px 36px rgba(212,96,26,0.18))' }}>
        <CathySphere size={200} />
      </div>

      <p style={{ fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(200,95,25,0.5)', marginBottom: '2rem', textAlign: 'center' }}>
        {status}
      </p>

      {/* Active quotes */}
      {activeQuotes.length > 0 && (
        <div style={{ width: '100%', maxWidth: 420, marginBottom: '1.4rem' }}>
          <p style={{ fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(200,95,25,0.45)', marginBottom: '0.4rem' }}>
            Devis en cours ({activeQuotes.length})
          </p>
          {activeQuotes.map(q => (
            <div key={q.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '12px 16px', border: '0.5px solid rgba(212,96,26,0.15)', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'rgba(255,195,140,0.9)', fontWeight: 500, flex: 1, marginRight: 8 }}>{q.title}</span>
                <span style={{ fontSize: 12, color: '#D4601A', whiteSpace: 'nowrap' }}>{q.amount.toLocaleString('fr-FR')} {q.currency ?? '€'}</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(200,150,80,0.5)', marginBottom: 10 }}>
                Soumis le {formatDate(q.created_at)}
              </div>
              <button
                onClick={() => markDone(q.id)}
                disabled={actionId === q.id}
                style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: 'none', background: '#D4601A', color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: actionId === q.id ? 0.6 : 1 }}
              >
                {actionId === q.id ? '…' : 'Marquer terminé'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Available RFQs */}
      <div style={{ width: '100%', maxWidth: 420 }}>
        <p style={{ fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(200,95,25,0.45)', marginBottom: '0.4rem' }}>
          Appels d&apos;offre disponibles
        </p>
        {loadingRfqs && (
          <div style={{ height: 80, background: 'rgba(212,96,26,0.04)', borderRadius: 14, animation: 'pulse 1.5s ease-in-out infinite' }} />
        )}
        {!loadingRfqs && rfqs.length === 0 && (
          <p style={{ textAlign: 'center', color: 'rgba(200,150,80,0.4)', fontSize: 12, padding: '1.5rem 0' }}>
            Aucun appel d&apos;offre disponible pour votre spécialité
          </p>
        )}
        {rfqs.map(r => (
          <div key={r.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '14px 16px', border: '0.5px solid rgba(212,96,26,0.12)', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, padding: '2px 8px', borderRadius: 20, background: `${specColor(r.specialty)}22`, color: specColor(r.specialty) }}>
                {r.specialty}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(200,150,80,0.4)', marginLeft: 'auto' }}>avant le {formatDate(r.deadline)}</span>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,195,140,0.9)', fontWeight: 500, marginBottom: 4 }}>{r.title}</div>
            <div style={{ fontSize: 11, color: 'rgba(200,150,80,0.55)', marginBottom: 4 }}>{r.address}</div>
            <div style={{ fontSize: 11, color: 'rgba(200,150,80,0.45)', marginBottom: 10 }}>{r.description}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#D4601A' }}>
                {r.budget_min.toLocaleString('fr-FR')} – {r.budget_max.toLocaleString('fr-FR')} {r.currency ?? '€'}
              </span>
              <button
                onClick={() => applyRfq(r.id)}
                disabled={actionId === r.id}
                style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: '#D4601A', color: '#fff', fontFamily: 'inherit', fontSize: 11, fontWeight: 500, cursor: 'pointer', opacity: actionId === r.id ? 0.6 : 1 }}
              >
                {actionId === r.id ? '…' : 'Postuler'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <button style={{ marginTop: 'auto', paddingTop: '2rem', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(200,95,25,0.25)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }} onClick={() => { window.location.href = '/login' }}>
        Déconnexion
      </button>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
