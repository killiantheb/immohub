'use client'
import { useState, useEffect } from 'react'
import { AlthySphere } from '@/components/AlthySphere'
import { api } from '@/lib/api'
import { useUser } from '@/lib/auth'

interface TenantInfo {
  next_rent_due: string
  next_rent_amount: number
  currency: string
  property_address: string
  lease_end_date: string
  status: 'ok' | 'late' | 'pending'
}

const STATUS_LABEL: Record<string, string> = {
  ok: 'À jour',
  late: 'En retard',
  pending: 'En attente',
}
const STATUS_COLOR: Record<string, string> = {
  ok: '#3B6D11',
  late: '#A32D2D',
  pending: '#854F0B',
}
const STATUS_BG: Record<string, string> = {
  ok: 'rgba(59,109,17,0.1)',
  late: 'rgba(163,45,45,0.1)',
  pending: 'rgba(133,79,11,0.1)',
}

export default function TenantPage() {
  const { data: profile } = useUser()
  const [info, setInfo] = useState<TenantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [reportSent, setReportSent] = useState(false)

  useEffect(() => {
    api.get<TenantInfo>('/tenants/me')
      .then(r => setInfo(r.data))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false))
  }, [])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  async function reportIssue() {
    setReportSent(true)
    // Navigate to a simple issue form — kept minimal for now
    window.location.href = '/tenant/report'
  }

  const firstName = profile?.first_name ?? 'Locataire'
  const rentStatus = info?.status ?? 'ok'

  return (
    <div style={{ minHeight: '100vh', background: '#FAF5EB', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1.2rem', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 11, letterSpacing: '6px', color: 'rgba(180,80,20,0.45)', textTransform: 'uppercase', margin: 0 }}>Althy</p>
        <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(80,35,8,0.45)', padding: '4px 10px', borderRadius: 20, border: '0.5px solid rgba(212,96,26,0.2)', background: 'rgba(212,96,26,0.05)' }}>Locataire</span>
      </div>

      {/* Sphere */}
      <div style={{ marginBottom: '1rem', filter: 'drop-shadow(0 12px 36px rgba(212,96,26,0.18))' }}>
        <AlthySphere size={200} />
      </div>

      <p style={{ fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(80,35,8,0.5)', marginBottom: '2rem', textAlign: 'center' }}>
        Bonjour {firstName}
      </p>

      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Prochain loyer */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: '0.5px solid rgba(212,96,26,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(80,35,8,0.45)' }}>Prochain loyer</span>
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
              <div style={{ fontSize: 32, fontWeight: 300, color: '#D4601A', fontFamily: 'var(--font-serif)', letterSpacing: 2, marginBottom: 6 }}>
                {info.next_rent_amount.toLocaleString('fr-FR')} {info.currency ?? '€'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(80,35,8,0.55)' }}>
                Échéance le {formatDate(info.next_rent_due)}
              </div>
              {info.property_address && (
                <div style={{ fontSize: 11, color: 'rgba(80,35,8,0.4)', marginTop: 4 }}>{info.property_address}</div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'rgba(80,35,8,0.4)' }}>Information indisponible</div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={() => window.location.href = '/tenant/documents'}
            style={{ padding: '14px 0', borderRadius: 14, border: '0.5px solid rgba(212,96,26,0.2)', background: '#fff', color: 'rgba(80,35,8,0.65)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
            Documents
          </button>
          <button
            onClick={reportIssue}
            style={{ padding: '14px 0', borderRadius: 14, border: '0.5px solid rgba(212,96,26,0.2)', background: '#fff', color: 'rgba(80,35,8,0.65)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {reportSent ? 'Envoyé ✓' : 'Signaler'}
          </button>
        </div>

        {/* Bail info */}
        {info?.lease_end_date && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', border: '0.5px solid rgba(212,96,26,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(80,35,8,0.45)', letterSpacing: 1 }}>Fin du bail</span>
            <span style={{ fontSize: 12, color: 'rgba(80,35,8,0.65)' }}>{formatDate(info.lease_end_date)}</span>
          </div>
        )}
      </div>

      <button style={{ marginTop: 'auto', paddingTop: '2rem', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(80,35,8,0.25)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }} onClick={() => { window.location.href = '/login' }}>
        Déconnexion
      </button>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}
