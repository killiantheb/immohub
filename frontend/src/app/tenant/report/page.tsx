'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

const CATEGORIES = [
  { value: 'plumbing', label: '🚰 Plomberie' },
  { value: 'electricity', label: '⚡ Électricité' },
  { value: 'heating', label: '🔥 Chauffage' },
  { value: 'windows', label: '🪟 Fenêtres / Portes' },
  { value: 'mold', label: '🍄 Humidité / Moisissures' },
  { value: 'appliances', label: '🏠 Équipements' },
  { value: 'other', label: '📋 Autre' },
]

const URGENCY = [
  { value: 'low', label: 'Faible — pas urgent' },
  { value: 'medium', label: 'Moyen — dans la semaine' },
  { value: 'high', label: 'Urgent — dans 48h' },
  { value: 'critical', label: 'Critique — immédiatement' },
]

export default function TenantReportPage() {
  const [category, setCategory] = useState('')
  const [urgency, setUrgency] = useState('medium')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category) { setError('Veuillez choisir une catégorie.'); return }
    if (description.length < 10) { setError('Décrivez le problème en quelques mots.'); return }

    setLoading(true)
    setError(null)
    try {
      await api.post('/tenants/me/reports', { category, urgency, description })
      setSent(true)
    } catch {
      setError('Erreur lors de l\'envoi. Réessayez.')
    } finally {
      setLoading(false)
    }
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

        {sent ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontSize: 48, marginBottom: '1rem' }}>✅</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 300, color: '#1C0F06', marginBottom: '0.5rem' }}>Signalement envoyé</h2>
            <p style={{ fontSize: 13, color: 'rgba(80,35,8,0.55)', lineHeight: 1.6 }}>
              Votre propriétaire a été notifié. Vous recevrez une réponse rapidement.
            </p>
            <button
              onClick={() => router.push('/tenant')}
              style={{ marginTop: '2rem', padding: '10px 24px', borderRadius: 20, background: '#D4601A', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Retour à l&apos;accueil
            </button>
          </div>
        ) : (
          <>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 300, color: '#1C0F06', marginBottom: '0.5rem' }}>
              Signaler un problème
            </h1>
            <p style={{ fontSize: 12, color: 'rgba(80,35,8,0.45)', marginBottom: '2rem' }}>
              Votre propriétaire sera notifié immédiatement.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Catégorie */}
              <div>
                <p style={{ fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(80,35,8,0.45)', marginBottom: 8 }}>Catégorie</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      style={{ padding: '10px 8px', borderRadius: 12, border: `0.5px solid ${category === c.value ? '#D4601A' : 'rgba(212,96,26,0.2)'}`, background: category === c.value ? 'rgba(212,96,26,0.08)' : '#fff', color: 'rgba(80,35,8,0.7)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Urgence */}
              <div>
                <p style={{ fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(80,35,8,0.45)', marginBottom: 8 }}>Urgence</p>
                <select
                  value={urgency}
                  onChange={e => setUrgency(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '0.5px solid rgba(212,96,26,0.2)', background: '#fff', color: 'rgba(80,35,8,0.7)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                >
                  {URGENCY.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>

              {/* Description */}
              <div>
                <p style={{ fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(80,35,8,0.45)', marginBottom: 8 }}>Description</p>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Décrivez le problème en détail…"
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '0.5px solid rgba(212,96,26,0.2)', background: '#fff', color: '#1C0F06', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 12, color: '#A32D2D', background: 'rgba(163,45,45,0.08)', padding: '10px 12px', borderRadius: 8 }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ padding: '12px 0', borderRadius: 12, background: '#D4601A', border: 'none', color: '#fff', fontSize: 13, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit' }}
              >
                {loading ? 'Envoi…' : 'Envoyer le signalement'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
