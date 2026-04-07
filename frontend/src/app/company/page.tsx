'use client'
import { useState, useEffect } from 'react'
import { AlthySphere } from '@/components/AlthySphere'
import { api } from '@/lib/api'

// Shapes from backend RFQRead / RFQQuoteRead
interface RFQQuote {
  id: string
  rfq_id: string
  amount: number
  description: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: string
}

interface RFQ {
  id: string
  title: string
  description: string
  category: string
  city: string | null
  budget_min: number | null
  budget_max: number | null
  urgency: string
  status: string
  quotes: RFQQuote[]
}

interface PaginatedRFQs {
  items: RFQ[]
  total: number
}

// Active quote = a quote I submitted that is still pending, enriched with rfq_id
interface ActiveQuote {
  quoteId: string
  rfqId: string
  title: string
  amount: number
  createdAt: string
}

const CATEGORY_COLORS: Record<string, string> = {
  plumbing: '#185FA5', electricity: '#854F0B', painting: '#3B6D11',
  masonry: '#4A3060', cleaning: '#2D5E4A', roofing: '#7A3B00',
  hvac: '#1A5C6B', locksmith: '#5C3317', renovation: '#7A2D2D', other: '#555',
}

export default function CompanyPage() {
  const [rfqs, setRfqs] = useState<RFQ[]>([])
  const [activeQuotes, setActiveQuotes] = useState<ActiveQuote[]>([])
  const [loadingRfqs, setLoadingRfqs] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState('à votre écoute')

  // Apply form state — shown inline when user clicks "Postuler"
  const [applyingRfqId, setApplyingRfqId] = useState<string | null>(null)
  const [applyAmount, setApplyAmount] = useState('')
  const [applyDesc, setApplyDesc] = useState('')

  useEffect(() => {
    // Available RFQs (published, open to bids)
    api.get<PaginatedRFQs>('/rfqs', { params: { rfq_status: 'published' } })
      .then(r => setRfqs(r.data.items))
      .catch(() => setRfqs([]))
      .finally(() => setLoadingRfqs(false))

    // My submitted quotes (RFQs where I have a quote)
    api.get<PaginatedRFQs>('/rfqs/company/dashboard')
      .then(r => {
        const quotes: ActiveQuote[] = []
        for (const rfq of r.data.items) {
          for (const q of rfq.quotes) {
            if (q.status === 'pending') {
              quotes.push({ quoteId: q.id, rfqId: rfq.id, title: rfq.title, amount: q.amount, createdAt: q.created_at })
            }
          }
        }
        setActiveQuotes(quotes)
      })
      .catch(() => setActiveQuotes([]))
  }, [])

  async function markDone(rfqId: string) {
    setActionId(rfqId)
    try {
      await api.put(`/rfqs/${rfqId}/complete`, {})
      setActiveQuotes(qs => qs.filter(q => q.rfqId !== rfqId))
      setStatusMsg('Travaux marqués comme terminés ✓')
    } catch {
      setStatusMsg('Erreur, réessayez.')
    } finally {
      setActionId(null)
    }
  }

  async function submitQuote(rfqId: string) {
    const amount = parseFloat(applyAmount)
    if (!amount || amount <= 0 || applyDesc.length < 20) {
      setStatusMsg('Montant et description (20 car. min) requis.')
      return
    }
    setActionId(rfqId)
    try {
      await api.post(`/rfqs/${rfqId}/quotes`, {
        amount,
        description: applyDesc,
        delay_days: null,
        warranty_months: null,
      })
      setRfqs(rs => rs.filter(r => r.id !== rfqId))
      setApplyingRfqId(null)
      setApplyAmount('')
      setApplyDesc('')
      setStatusMsg('Devis envoyé ✓')
    } catch {
      setStatusMsg('Erreur lors de l\'envoi du devis.')
    } finally {
      setActionId(null)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  function catColor(cat: string) {
    return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other
  }

  const CAT_LABELS: Record<string, string> = {
    plumbing: 'Plomberie', electricity: 'Électricité', painting: 'Peinture',
    masonry: 'Maçonnerie', cleaning: 'Nettoyage', roofing: 'Toiture',
    hvac: 'CVC', locksmith: 'Serrurerie', renovation: 'Rénovation', other: 'Autre',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5EB', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1.2rem', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 11, letterSpacing: '6px', color: 'rgba(180,80,20,0.45)', textTransform: 'uppercase', margin: 0 }}>Althy</p>
        <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(80,35,8,0.45)', padding: '4px 10px', borderRadius: 20, border: '0.5px solid rgba(212,96,26,0.2)', background: 'rgba(212,96,26,0.05)' }}>Artisan</span>
      </div>

      {/* Sphere */}
      <div style={{ marginBottom: '1rem', filter: 'drop-shadow(0 12px 36px rgba(212,96,26,0.18))' }}>
        <AlthySphere size={200} />
      </div>

      <p style={{ fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(80,35,8,0.5)', marginBottom: '2rem', textAlign: 'center' }}>
        {statusMsg}
      </p>

      {/* Active quotes */}
      {activeQuotes.length > 0 && (
        <div style={{ width: '100%', maxWidth: 420, marginBottom: '1.4rem' }}>
          <p style={{ fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(80,35,8,0.45)', marginBottom: '0.4rem' }}>
            Devis en cours ({activeQuotes.length})
          </p>
          {activeQuotes.map(q => (
            <div key={q.quoteId} style={{ background: '#fff', borderRadius: 14, padding: '12px 16px', border: '0.5px solid rgba(212,96,26,0.15)', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: '#1C0F06', fontWeight: 500, flex: 1, marginRight: 8 }}>{q.title}</span>
                <span style={{ fontSize: 12, color: '#D4601A', whiteSpace: 'nowrap' }}>{q.amount.toLocaleString('fr-FR')} CHF</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(80,35,8,0.5)', marginBottom: 10 }}>
                Soumis le {formatDate(q.createdAt)}
              </div>
              <button
                onClick={() => markDone(q.rfqId)}
                disabled={actionId === q.rfqId}
                style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: 'none', background: '#D4601A', color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, cursor: 'pointer', opacity: actionId === q.rfqId ? 0.6 : 1 }}
              >
                {actionId === q.rfqId ? '…' : 'Marquer terminé'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Available RFQs */}
      <div style={{ width: '100%', maxWidth: 420 }}>
        <p style={{ fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(80,35,8,0.45)', marginBottom: '0.4rem' }}>
          Appels d&apos;offre disponibles
        </p>
        {loadingRfqs && (
          <div style={{ height: 80, background: 'rgba(212,96,26,0.04)', borderRadius: 14, animation: 'pulse 1.5s ease-in-out infinite' }} />
        )}
        {!loadingRfqs && rfqs.length === 0 && (
          <p style={{ textAlign: 'center', color: 'rgba(80,35,8,0.4)', fontSize: 12, padding: '1.5rem 0' }}>
            Aucun appel d&apos;offre disponible pour le moment
          </p>
        )}
        {rfqs.map(r => (
          <div key={r.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '0.5px solid rgba(212,96,26,0.12)', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, padding: '2px 8px', borderRadius: 20, background: `${catColor(r.category)}22`, color: catColor(r.category) }}>
                {CAT_LABELS[r.category] ?? r.category}
              </span>
              {r.city && <span style={{ fontSize: 10, color: 'rgba(80,35,8,0.4)', marginLeft: 'auto' }}>{r.city}</span>}
            </div>
            <div style={{ fontSize: 13, color: '#1C0F06', fontWeight: 500, marginBottom: 4 }}>{r.title}</div>
            <div style={{ fontSize: 11, color: 'rgba(80,35,8,0.45)', marginBottom: 10, WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{r.description}</div>

            {/* Budget */}
            {(r.budget_min != null || r.budget_max != null) && (
              <div style={{ fontSize: 12, color: '#D4601A', marginBottom: 10 }}>
                {r.budget_min != null && r.budget_max != null
                  ? `${r.budget_min.toLocaleString('fr-FR')} – ${r.budget_max.toLocaleString('fr-FR')} CHF`
                  : r.budget_min != null ? `Dès ${r.budget_min.toLocaleString('fr-FR')} CHF` : `Jusqu'à ${r.budget_max!.toLocaleString('fr-FR')} CHF`}
              </div>
            )}

            {/* Apply form or button */}
            {applyingRfqId === r.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                <input
                  type="number"
                  placeholder="Montant de votre devis (CHF) *"
                  value={applyAmount}
                  onChange={e => setApplyAmount(e.target.value)}
                  style={{ padding: '8px 12px', border: '0.5px solid rgba(160,92,40,0.25)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                />
                <textarea
                  placeholder="Décrivez votre offre (20 caractères min) *"
                  value={applyDesc}
                  onChange={e => setApplyDesc(e.target.value)}
                  rows={3}
                  style={{ padding: '8px 12px', border: '0.5px solid rgba(160,92,40,0.25)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'none' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setApplyingRfqId(null)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '0.5px solid rgba(160,92,40,0.2)', background: 'transparent', color: 'rgba(80,35,8,0.55)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Annuler
                  </button>
                  <button
                    onClick={() => submitQuote(r.id)}
                    disabled={actionId === r.id}
                    style={{ flex: 2, padding: '7px 0', borderRadius: 8, border: 'none', background: '#D4601A', color: '#fff', fontFamily: 'inherit', fontSize: 11, fontWeight: 500, cursor: 'pointer', opacity: actionId === r.id ? 0.6 : 1 }}
                  >
                    {actionId === r.id ? '…' : 'Envoyer le devis'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setApplyingRfqId(r.id); setApplyAmount(r.budget_min ? String(r.budget_min) : '') }}
                style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: 'none', background: '#D4601A', color: '#fff', fontFamily: 'inherit', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}
              >
                Proposer un devis
              </button>
            )}
          </div>
        ))}
      </div>

      <button style={{ marginTop: 'auto', paddingTop: '2rem', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(80,35,8,0.25)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }} onClick={() => { window.location.href = '/login' }}>
        Déconnexion
      </button>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
