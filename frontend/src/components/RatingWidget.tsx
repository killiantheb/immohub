'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const O = '#D4601A'
const T = '#1C0F06'
const T5 = 'rgba(80,35,8,0.55)'
const T3 = 'rgba(80,35,8,0.30)'
const border = '0.5px solid rgba(160,92,40,0.2)'

interface Rating {
  id: string
  rater_id: string
  rater_role: string
  entity_type: string
  entity_id: string
  score: number
  comment: string | null
  created_at: string
}

interface RatingSummary {
  entity_type: string
  entity_id: string
  avg_score: number
  count: number
  ratings: Rating[]
}

interface Props {
  entityType: string   // "user" | "company" | "property" | "mission"
  entityId: string
  title?: string
  compact?: boolean    // Affichage compact — juste la moyenne + étoiles
}

function Stars({ score, interactive = false, onRate }: { score: number; interactive?: boolean; onRate?: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onMouseEnter={() => interactive && setHover(n)}
          onMouseLeave={() => interactive && setHover(0)}
          onClick={() => onRate?.(n)}
          style={{
            fontSize: 18,
            cursor: interactive ? 'pointer' : 'default',
            color: n <= (hover || score) ? '#F59E0B' : '#D1D5DB',
            transition: 'color 0.1s',
          }}
        >
          ★
        </span>
      ))}
    </span>
  )
}

export function RatingWidget({ entityType, entityId, title, compact = false }: Props) {
  const [summary, setSummary] = useState<RatingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [myScore, setMyScore] = useState(0)
  const [myComment, setMyComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const r = await api.get(`/ratings/${entityType}/${entityId}`)
      setSummary(r.data)
    } catch {
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [entityType, entityId])

  async function submit() {
    if (!myScore) return
    setSubmitting(true)
    setError('')
    try {
      await api.post('/ratings/', {
        entity_type: entityType,
        entity_id: entityId,
        score: myScore,
        comment: myComment || null,
      })
      setShowForm(false)
      setMyScore(0)
      setMyComment('')
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Erreur lors de la notation')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

  if (compact) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Stars score={Math.round(summary?.avg_score ?? 0)} />
        <span style={{ fontSize: 12, color: T5 }}>
          {summary?.avg_score?.toFixed(1) ?? '—'} ({summary?.count ?? 0})
        </span>
      </span>
    )
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border, marginTop: 12 }}>
      {title && (
        <p style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T5, marginBottom: 14 }}>
          {title}
        </p>
      )}

      {/* Summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 32, fontWeight: 700, color: T, lineHeight: 1 }}>
            {summary?.avg_score?.toFixed(1) ?? '—'}
          </p>
          <Stars score={Math.round(summary?.avg_score ?? 0)} />
          <p style={{ fontSize: 11, color: T3, marginTop: 4 }}>{summary?.count ?? 0} avis</p>
        </div>
        <div style={{ flex: 1 }}>
          {[5, 4, 3, 2, 1].map(n => {
            const count = summary?.ratings?.filter(r => r.score === n).length ?? 0
            const total = summary?.count ?? 1
            const pct = total > 0 ? (count / total) * 100 : 0
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: T5, width: 8 }}>{n}</span>
                <span style={{ fontSize: 12, color: '#F59E0B' }}>★</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(160,92,40,0.1)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: O, borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 10, color: T3, width: 20, textAlign: 'right' }}>{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add rating button */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          style={{ fontSize: 12, padding: '7px 14px', borderRadius: 10, border, background: 'transparent', color: T5, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          + Laisser un avis
        </button>
      ) : (
        <div style={{ borderTop: border, paddingTop: 16 }}>
          <p style={{ fontSize: 12, color: T5, marginBottom: 10 }}>Votre note</p>
          <Stars score={myScore} interactive onRate={setMyScore} />
          <textarea
            value={myComment}
            onChange={e => setMyComment(e.target.value)}
            placeholder="Commentaire (optionnel)…"
            rows={3}
            style={{ width: '100%', marginTop: 12, padding: '9px 13px', border, borderRadius: 10, fontSize: 13, color: T, background: '#fafafa', outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
          />
          {error && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={submit}
              disabled={!myScore || submitting}
              style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: !myScore ? 'rgba(212,96,26,0.4)' : O, color: '#fff', fontSize: 13, cursor: !myScore ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {submitting ? 'Envoi…' : 'Publier'}
            </button>
            <button
              onClick={() => { setShowForm(false); setMyScore(0); setMyComment(''); setError('') }}
              style={{ padding: '8px 14px', borderRadius: 10, border, background: 'transparent', color: T5, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Recent ratings */}
      {summary && summary.ratings.length > 0 && (
        <div style={{ marginTop: 20, borderTop: border, paddingTop: 16 }}>
          <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3, marginBottom: 12 }}>Avis récents</p>
          {summary.ratings.slice(0, 5).map(r => (
            <div key={r.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '0.5px solid rgba(160,92,40,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Stars score={r.score} />
                <span style={{ fontSize: 11, color: T3, textTransform: 'capitalize' }}>{r.rater_role}</span>
                <span style={{ fontSize: 10, color: T3, marginLeft: 'auto' }}>
                  {new Date(r.created_at).toLocaleDateString('fr-CH')}
                </span>
              </div>
              {r.comment && <p style={{ fontSize: 13, color: T5, lineHeight: 1.5, margin: 0 }}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
