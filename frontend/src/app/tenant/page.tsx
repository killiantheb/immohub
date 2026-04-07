'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlthySphere } from '@/components/AlthySphere'
import { api } from '@/lib/api'
import { useUser } from '@/lib/auth'

interface TenantInfo {
  next_rent_due: string | null
  next_rent_amount: number | null
  currency: string
  property_address: string | null
  lease_end_date: string | null
  status: 'ok' | 'late' | 'pending'
  pending_transaction_id?: string
}

interface DepositInfo {
  status: string
  deposit_amount_chf: number | null
  monthly_rent_chf: number
  months: number
  paid_at: string | null
  reference: string | null
}

interface Quittance {
  id: string
  created_at: string
  status: string
}

const STATUS_LABEL: Record<string, string> = { ok: 'À jour', late: 'En retard', pending: 'En attente' }
const STATUS_COLOR: Record<string, string> = { ok: '#3B6D11', late: '#A32D2D', pending: '#854F0B' }
const STATUS_BG: Record<string, string> = { ok: 'rgba(59,109,17,0.1)', late: 'rgba(163,45,45,0.1)', pending: 'rgba(133,79,11,0.1)' }

const O = '#D4601A'
const T = '#1C0F06'
const T5 = 'rgba(80,35,8,0.58)'
const T4 = 'rgba(80,35,8,0.45)'
const T3 = 'rgba(80,35,8,0.32)'
const O20 = 'rgba(212,96,26,0.20)'

function fmt(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })
}

export default function TenantPage() {
  const { data: profile } = useUser()
  const [info, setInfo] = useState<TenantInfo | null>(null)
  const [deposit, setDeposit] = useState<DepositInfo | null>(null)
  const [quittances, setQuittances] = useState<Quittance[]>([])
  const [loading, setLoading] = useState(true)
  const [payLoading, setPayLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    Promise.all([
      api.get<TenantInfo>('/tenants/me').then(r => setInfo(r.data)).catch(() => {}),
      api.get<DepositInfo>('/tenants/me/deposit').then(r => setDeposit(r.data)).catch(() => {}),
      api.get<Quittance[]>('/tenants/me/quittances').then(r => setQuittances(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  async function payRent(transactionId: string) {
    setPayLoading(true)
    try {
      const { data } = await api.post<{ checkout_url: string }>(`/transactions/${transactionId}/checkout`)
      window.location.href = data.checkout_url
    } catch {
      alert('Paiement indisponible pour le moment.')
    } finally {
      setPayLoading(false)
    }
  }

  const firstName = profile?.first_name ?? 'Locataire'
  const rentStatus = info?.status ?? 'ok'

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5EB', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1.2rem 4rem', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 11, letterSpacing: '6px', color: 'rgba(180,80,20,0.45)', textTransform: 'uppercase' }}>Althy</span>
        <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: T4, padding: '4px 10px', borderRadius: 20, border: `0.5px solid ${O20}`, background: 'rgba(212,96,26,0.05)' }}>Locataire</span>
      </div>

      {/* Sphere */}
      <div style={{ marginBottom: '1rem', filter: 'drop-shadow(0 12px 36px rgba(212,96,26,0.18))' }}>
        <AlthySphere size={160} />
      </div>
      <p style={{ fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', color: T4, marginBottom: '2rem', textAlign: 'center' }}>
        Bonjour {firstName}
      </p>

      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Prochain loyer */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: `0.5px solid ${O20}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: T4 }}>Prochain loyer</span>
            {info && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: STATUS_BG[rentStatus], color: STATUS_COLOR[rentStatus] }}>
                {STATUS_LABEL[rentStatus]}
              </span>
            )}
          </div>
          {loading ? (
            <div style={{ height: 40, background: 'rgba(212,96,26,0.06)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ) : info ? (
            <>
              <div style={{ fontSize: 32, fontWeight: 300, color: O, fontFamily: 'var(--font-serif)', letterSpacing: 2, marginBottom: 6 }}>
                CHF {info.next_rent_amount?.toLocaleString('fr-CH') ?? '—'}
              </div>
              {info.next_rent_due && (
                <div style={{ fontSize: 12, color: T5 }}>Échéance le {fmt(info.next_rent_due)}</div>
              )}
              {info.property_address && (
                <div style={{ fontSize: 11, color: T3, marginTop: 4 }}>{info.property_address}</div>
              )}
              {info.pending_transaction_id && rentStatus !== 'ok' && (
                <button
                  onClick={() => payRent(info.pending_transaction_id!)}
                  disabled={payLoading}
                  style={{ marginTop: 12, width: '100%', padding: '10px 0', borderRadius: 10, background: O, border: 'none', color: '#fff', fontSize: 13, fontWeight: 500, cursor: payLoading ? 'not-allowed' : 'pointer', opacity: payLoading ? 0.7 : 1, fontFamily: 'inherit' }}
                >
                  {payLoading ? 'Redirection…' : 'Payer le loyer en ligne →'}
                </button>
              )}
              {rentStatus === 'ok' && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#3B6D11' }}>
                  <span>✓</span> Vous êtes à jour de vos paiements
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: T4 }}>Aucun bail actif trouvé</div>
          )}
        </div>

        {/* Bail info */}
        {info?.lease_end_date && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', border: `0.5px solid ${O20}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: T4, letterSpacing: '0.5px' }}>Fin du bail</span>
            <span style={{ fontSize: 12, color: T5, fontWeight: 500 }}>{fmt(info.lease_end_date)}</span>
          </div>
        )}

        {/* Caution / dépôt de garantie */}
        {deposit && deposit.deposit_amount_chf && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: `0.5px solid ${O20}` }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: T4, marginBottom: 8 }}>Dépôt de garantie</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 500, color: T }}>CHF {deposit.deposit_amount_chf.toLocaleString('fr-CH')}</span>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: deposit.status === 'paid' ? 'rgba(59,109,17,0.1)' : 'rgba(133,79,11,0.1)', color: deposit.status === 'paid' ? '#3B6D11' : '#854F0B' }}>
                {deposit.status === 'paid' ? 'Versé' : 'En attente'}
              </span>
            </div>
            {deposit.paid_at && (
              <div style={{ fontSize: 11, color: T3, marginTop: 4 }}>Reçu le {fmt(deposit.paid_at)}</div>
            )}
          </div>
        )}

        {/* Quittances récentes */}
        {quittances.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', border: `0.5px solid ${O20}` }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: T4, marginBottom: 10 }}>Quittances de loyer</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {quittances.slice(0, 6).map(q => (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: T5 }}>🧾 {fmtShort(q.created_at)}</span>
                  <span style={{ fontSize: 10, color: T3 }}>{new Date(q.created_at).toLocaleDateString('fr-CH')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
          <button
            onClick={() => router.push('/tenant/documents')}
            style={{ padding: '14px 0', borderRadius: 14, border: `0.5px solid ${O20}`, background: '#fff', color: T5, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Mes documents
          </button>
          <button
            onClick={() => router.push('/tenant/report')}
            style={{ padding: '14px 0', borderRadius: 14, border: `0.5px solid ${O20}`, background: '#fff', color: T5, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Signaler
          </button>
        </div>
      </div>

      <button
        style={{ marginTop: '3rem', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: T3, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}
        onClick={() => router.push('/login')}
      >
        Déconnexion
      </button>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
