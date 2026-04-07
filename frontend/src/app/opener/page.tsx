'use client'
import { useState, useEffect } from 'react'
import { AlthySphere } from '@/components/AlthySphere'
import { api } from '@/lib/api'
import { useUser } from '@/lib/auth'

interface Mission {
  id: string
  type: string
  address: string
  scheduled_at: string
  amount: number
  status: string
}

interface Earnings {
  month_total: number
  currency: string
}

const S = {
  root: { minHeight: '100vh', background: '#FAF5EB', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', padding: '2rem 1.2rem', fontFamily: 'var(--font-sans)' },
  label: { fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase' as const, color: 'rgba(80,35,8,0.45)', marginBottom: '0.4rem' },
  section: { width: '100%', maxWidth: 420, marginBottom: '1.4rem' },
  card: { background: '#fff', borderRadius: 14, padding: '12px 16px', border: '0.5px solid rgba(212,96,26,0.14)', marginBottom: 8 },
  missionType: { fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '1.5px', color: '#D4601A', marginBottom: 4 },
  missionAddr: { fontSize: 13, color: '#1C0F06', fontWeight: 500, marginBottom: 2 },
  missionMeta: { fontSize: 11, color: 'rgba(80,35,8,0.5)', marginBottom: 8 },
  btnAccept: { flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: '#D4601A', color: '#fff', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' },
  btnRefuse: { flex: 1, padding: '7px 0', borderRadius: 8, border: '0.5px solid rgba(212,96,26,0.3)', background: 'transparent', color: 'rgba(80,35,8,0.55)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  earningsBox: { background: 'rgba(212,96,26,0.07)', borderRadius: 14, padding: '16px', border: '0.5px solid rgba(212,96,26,0.18)', textAlign: 'center' as const },
  earningsNum: { fontSize: 28, fontWeight: 300, color: '#D4601A', fontFamily: 'var(--font-serif)', letterSpacing: 2 },
  earningsSub: { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'rgba(80,35,8,0.45)', marginTop: 4 },
  empty: { textAlign: 'center' as const, color: 'rgba(80,35,8,0.35)', fontSize: 12, padding: '1.5rem 0' },
  signout: { marginTop: 'auto', padding: '1rem 0', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' as const, color: 'rgba(80,35,8,0.25)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' },
}

export default function OpenerPage() {
  const { data: profile } = useUser()
  const [missions, setMissions] = useState<Mission[]>([])
  const [earnings, setEarnings] = useState<Earnings | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [status, setStatus] = useState('à votre écoute')

  useEffect(() => {
    api.get<Mission[]>('/missions?available=true')
      .then(r => setMissions(r.data))
      .catch(() => setMissions([]))
    api.get<Earnings>('/openers/me/earnings')
      .then(r => setEarnings(r.data))
      .catch(() => setEarnings(null))
  }, [])

  async function accept(id: string) {
    setActionId(id)
    try {
      await api.put(`/missions/${id}/accept`, {})
      setMissions(ms => ms.filter(m => m.id !== id))
      setStatus('Mission acceptée ✓')
    } catch {
      setStatus('Erreur, réessayez.')
    } finally {
      setActionId(null)
    }
  }

  async function refuse(id: string) {
    setActionId(id)
    try {
      await api.put(`/missions/${id}/refuse`, {})
      setMissions(ms => ms.filter(m => m.id !== id))
    } catch {
      setStatus('Erreur, réessayez.')
    } finally {
      setActionId(null)
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const firstName = profile?.first_name ?? 'Ouvreur'

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 11, letterSpacing: '6px', color: 'rgba(180,80,20,0.45)', textTransform: 'uppercase', margin: 0 }}>Althy</p>
        <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(80,35,8,0.45)', padding: '4px 10px', borderRadius: 20, border: '0.5px solid rgba(212,96,26,0.2)', background: 'rgba(212,96,26,0.05)' }}>Ouvreur</span>
      </div>

      {/* Sphere */}
      <div style={{ marginBottom: '1rem', filter: 'drop-shadow(0 12px 36px rgba(212,96,26,0.18))' }}>
        <AlthySphere size={200} />
      </div>

      {/* Status */}
      <p style={{ fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(80,35,8,0.5)', marginBottom: '1.8rem', textAlign: 'center' }}>
        {status}
      </p>

      {/* Earnings */}
      <div style={S.section}>
        <p style={S.label}>Revenus du mois</p>
        <div style={S.earningsBox}>
          <div style={S.earningsNum}>
            {earnings ? `${earnings.month_total.toLocaleString('fr-FR')} ${earnings.currency ?? '€'}` : '—'}
          </div>
          <div style={S.earningsSub}>{new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
        </div>
      </div>

      {/* Missions */}
      <div style={S.section}>
        <p style={S.label}>Missions disponibles ({missions.length})</p>
        {missions.length === 0 && <p style={S.empty}>Aucune mission proche pour le moment</p>}
        {missions.map(m => (
          <div key={m.id} style={S.card}>
            <div style={S.missionType}>{m.type}</div>
            <div style={S.missionAddr}>{m.address}</div>
            <div style={S.missionMeta}>{formatDate(m.scheduled_at)} · {m.amount.toLocaleString('fr-FR')} €</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => accept(m.id)} disabled={actionId === m.id} style={S.btnAccept}>
                {actionId === m.id ? '…' : 'Accepter'}
              </button>
              <button onClick={() => refuse(m.id)} disabled={actionId === m.id} style={S.btnRefuse}>
                Refuser
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Profile */}
      <div style={{ ...S.section, marginBottom: 0 }}>
        <p style={S.label}>Mon profil</p>
        <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(212,96,26,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#D4601A' }}>
            {firstName[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#1C0F06', fontWeight: 500 }}>{firstName} {profile?.last_name ?? ''}</div>
            <div style={{ fontSize: 11, color: 'rgba(80,35,8,0.5)', marginTop: 2 }}>{profile?.email ?? ''}</div>
          </div>
        </div>
      </div>

      <button style={S.signout} onClick={() => { window.location.href = '/login' }}>Déconnexion</button>
    </div>
  )
}
