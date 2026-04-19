'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { C } from "@/lib/design-tokens";

interface InsuranceDashboard {
  total_offers: number
  accepted_offers: number
  total_commission_chf: number
  pending_rfqs: number
  offers: InsuranceOffer[]
}

interface InsuranceOffer {
  id: string
  rfq_id: string
  product_name: string
  insurer_name: string
  annual_premium_chf: number
  monthly_premium_chf: number
  coverage_details: string
  deductible_chf: number
  commission_pct: number
  commission_chf: number
  net_premium_chf: number
  notes: string | null
  created_by_id: string
  status: string
}

interface OpenRfq {
  id: string
  title: string
  description: string
  status: string
  urgency: string | null
  budget_max: number | null
  created_at: string
}

function fmt(n: number) {
  return n.toLocaleString('fr-CH', { minimumFractionDigits: 2 })
}

function statusColor(status: string): string {
  if (status === 'accepted' || status === 'open') return C.green
  if (status === 'quoted') return C.orange
  if (status === 'draft') return C.amber
  if (status === 'rejected') return C.red
  return C.text3
}

function statusBg(status: string): string {
  if (status === 'accepted' || status === 'open') return C.greenBg
  if (status === 'quoted') return C.orangeBg
  if (status === 'draft') return C.amberBg
  if (status === 'rejected') return C.redBg
  return C.bg
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Brouillon',
    quoted: 'Offre déposée',
    accepted: 'Acceptée',
    rejected: 'Rejetée',
    open: 'Ouvert',
  }
  return map[status] ?? status
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 13px',
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  fontSize: 13,
  color: C.text,
  background: C.surface,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

export default function InsurancePage() {
  const [dashboard, setDashboard] = useState<InsuranceDashboard | null>(null)
  const [rfqs, setRfqs] = useState<OpenRfq[]>([])
  const [tab, setTab] = useState<'offers' | 'rfqs'>('offers')
  const [loading, setLoading] = useState(true)
  const [respondRfq, setRespondRfq] = useState<OpenRfq | null>(null)
  const [form, setForm] = useState({ product_name: '', insurer_name: '', annual_premium_chf: '', coverage_details: '', deductible_chf: '0', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/insurance/dashboard').then(r => setDashboard(r.data)).catch(() => null),
      api.get('/insurance/rfqs').then(r => setRfqs(r.data)).catch(() => null),
    ]).finally(() => setLoading(false))
  }, [])

  async function submitOffer() {
    if (!respondRfq) return
    setSubmitting(true)
    try {
      await api.post(`/insurance/rfqs/${respondRfq.id}/respond`, {
        rfq_id: respondRfq.id,
        product_name: form.product_name,
        insurer_name: form.insurer_name,
        annual_premium_chf: parseFloat(form.annual_premium_chf),
        coverage_details: form.coverage_details,
        deductible_chf: parseFloat(form.deductible_chf) || 0,
        commission_pct: 10,
        notes: form.notes || null,
      })
      setSuccess('Offre déposée avec succès.')
      setRespondRfq(null)
      setForm({ product_name: '', insurer_name: '', annual_premium_chf: '', coverage_details: '', deductible_chf: '0', notes: '' })
      const [d, r] = await Promise.all([
        api.get('/insurance/dashboard'),
        api.get('/insurance/rfqs'),
      ])
      setDashboard(d.data)
      setRfqs(r.data)
    } catch {
      setSuccess('Erreur lors du dépôt.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: C.text2, fontSize: 13 }}>Chargement…</div>
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem 0', fontFamily: 'var(--font-sans)' }}>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 400, color: C.orange, letterSpacing: 2, marginBottom: '1.5rem' }}>
        Espace assureur
      </h1>

      {/* KPIs */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Offres déposées', value: String(dashboard.total_offers) },
            { label: 'Offres acceptées', value: String(dashboard.accepted_offers) },
            { label: 'Commissions CHF', value: fmt(dashboard.total_commission_chf) },
            { label: 'Appels ouverts', value: String(dashboard.pending_rfqs) },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: C.surface, borderRadius: 14, padding: '16px 18px', border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
              <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.text3, marginBottom: 6 }}>{kpi.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {success && (
        <div style={{ background: C.greenBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: C.green, fontSize: 13 }}>
          {success}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: C.surface, borderRadius: 12, padding: 4, border: `1px solid ${C.border}`, width: 'fit-content', boxShadow: C.shadow }}>
        {[
          { key: 'offers' as const, label: `Mes offres (${dashboard?.total_offers ?? 0})` },
          { key: 'rfqs' as const, label: `Appels d'offre (${rfqs.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', background: tab === t.key ? C.orange : 'transparent', color: tab === t.key ? '#fff' : C.text2, fontSize: 13, fontFamily: 'inherit', transition: 'all 0.15s' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Offers tab */}
      {tab === 'offers' && (
        <>
          {dashboard?.offers.length === 0 ? (
            <div style={{ background: C.surface, borderRadius: 16, padding: '40px', border: `1px solid ${C.border}`, textAlign: 'center', boxShadow: C.shadow }}>
              <p style={{ fontSize: 14, color: C.text2 }}>Aucune offre déposée. Consultez les appels d'offre ouverts.</p>
            </div>
          ) : (
            dashboard?.offers.map(offer => (
              <div key={offer.id} style={{ background: C.surface, borderRadius: 16, padding: '20px', border: `1px solid ${C.border}`, marginBottom: 12, boxShadow: C.shadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 3 }}>{offer.product_name}</p>
                    <p style={{ fontSize: 13, color: C.text2 }}>{offer.insurer_name}</p>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: statusBg(offer.status), color: statusColor(offer.status), fontWeight: 500 }}>
                    {statusLabel(offer.status)}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 10, color: C.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>Prime annuelle</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{fmt(offer.annual_premium_chf)} CHF</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: C.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>Prime mensuelle</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{fmt(offer.monthly_premium_chf)} CHF</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: C.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>Commission (10%)</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color: C.orange }}>{fmt(offer.commission_chf)} CHF</p>
                  </div>
                </div>
                {offer.coverage_details && (
                  <p style={{ fontSize: 13, color: C.text2, marginTop: 10, padding: '8px 12px', borderRadius: 8, background: C.orangeBg, border: `1px solid ${C.border}` }}>
                    {offer.coverage_details}
                  </p>
                )}
              </div>
            ))
          )}
        </>
      )}

      {/* RFQs tab */}
      {tab === 'rfqs' && (
        <>
          {rfqs.length === 0 ? (
            <div style={{ background: C.surface, borderRadius: 16, padding: '40px', border: `1px solid ${C.border}`, textAlign: 'center', boxShadow: C.shadow }}>
              <p style={{ fontSize: 14, color: C.text2 }}>Aucun appel d'offre disponible.</p>
            </div>
          ) : (
            rfqs.map(rfq => (
              <div key={rfq.id} style={{ background: C.surface, borderRadius: 16, padding: '20px', border: `1px solid ${C.border}`, marginBottom: 12, boxShadow: C.shadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>{rfq.title}</p>
                    {rfq.urgency && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: C.redBg, color: C.red }}>{rfq.urgency}</span>}
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: statusBg(rfq.status), color: statusColor(rfq.status), fontWeight: 500 }}>{statusLabel(rfq.status)}</span>
                </div>
                {rfq.description && (
                  <p style={{ fontSize: 13, color: C.text2, marginBottom: 12, lineHeight: 1.5 }}>{rfq.description}</p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {rfq.budget_max && (
                    <p style={{ fontSize: 13, color: C.text2 }}>Budget max : <strong style={{ color: C.text }}>{fmt(rfq.budget_max)} CHF/an</strong></p>
                  )}
                  <button
                    onClick={() => { setRespondRfq(rfq); setSuccess('') }}
                    style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: C.orange, color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Déposer une offre
                  </button>
                </div>
                <p style={{ fontSize: 12, color: C.text3, marginTop: 8 }}>
                  Publié le {new Date(rfq.created_at).toLocaleDateString('fr-CH')}
                </p>
              </div>
            ))
          )}
        </>
      )}

      {/* Respond modal */}
      {respondRfq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: C.bg, borderRadius: 20, padding: '28px', maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: C.shadowMd }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 400, color: C.orange, margin: 0 }}>Déposer une offre</h2>
              <button onClick={() => setRespondRfq(null)} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: C.text2 }}>x</button>
            </div>
            <p style={{ fontSize: 13, color: C.text2, marginBottom: 20 }}>En réponse à : <strong style={{ color: C.text }}>{respondRfq.title}</strong></p>

            {[
              { label: 'Nom du produit', key: 'product_name', placeholder: 'RC + Ménage Premium' },
              { label: "Compagnie d'assurance", key: 'insurer_name', placeholder: 'Zurich Insurance' },
              { label: 'Prime annuelle (CHF)', key: 'annual_premium_chf', placeholder: '850.00', type: 'number' },
              { label: 'Franchise (CHF)', key: 'deductible_chf', placeholder: '200', type: 'number' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: C.text2, marginBottom: 6 }}>{label}</label>
                <input
                  type={type ?? 'text'}
                  value={(form as Record<string, string>)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={inputStyle}
                />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: C.text2, marginBottom: 6 }}>Détails de couverture</label>
              <textarea
                value={form.coverage_details}
                onChange={e => setForm(f => ({ ...f, coverage_details: e.target.value }))}
                placeholder="Responsabilité civile jusqu'à 5M CHF, dommages eau, incendie…"
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: C.text2, marginBottom: 6 }}>Notes (optionnel)</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Conditions particulières…"
                rows={2}
                style={{ ...inputStyle, resize: 'none' }}
              />
            </div>

            <p style={{ fontSize: 12, color: C.text3, marginBottom: 16 }}>
              Commission plateforme : 10% = {form.annual_premium_chf ? fmt(parseFloat(form.annual_premium_chf) * 0.1) : '0.00'} CHF/an
            </p>

            <button
              onClick={submitOffer}
              disabled={submitting || !form.product_name || !form.annual_premium_chf}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: submitting ? C.orangeBg : C.orange, color: submitting ? C.orange : '#fff', fontSize: 14, fontWeight: 500, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {submitting ? 'Dépôt…' : "Confirmer l'offre"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
