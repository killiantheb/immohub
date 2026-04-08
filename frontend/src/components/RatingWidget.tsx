'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const S = {
  bg: "var(--althy-bg)",
  surface: "var(--althy-surface)",
  surface2: "var(--althy-surface-2)",
  border: "var(--althy-border)",
  text: "var(--althy-text)",
  text2: "var(--althy-text-2)",
  text3: "var(--althy-text-3)",
  orange: "var(--althy-orange)",
  orangeBg: "var(--althy-orange-bg)",
  green: "var(--althy-green)",
  greenBg: "var(--althy-green-bg)",
  red: "var(--althy-red)",
  redBg: "var(--althy-red-bg)",
  amber: "var(--althy-amber)",
  amberBg: "var(--althy-amber-bg)",
  blue: "var(--althy-blue)",
  blueBg: "var(--althy-blue-bg)",
  shadow: "var(--althy-shadow)",
  shadowMd: "var(--althy-shadow-md)",
} as const;

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
            color: n <= (hover || score) ? S.amber : S.border,
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
        <span style={{ fontSize: 12, color: S.text2 }}>
          {summary?.avg_score?.toFixed(1) ?? '—'} ({summary?.count ?? 0})
        </span>
      </span>
    )
  }

  return (
    <div style={{ background: S.surface, borderRadius: 16, padding: '20px', border: `0.5px solid ${S.border}`, marginTop: 12 }}>
      {title && (
        <p style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: S.text2, marginBottom: 14 }}>
          {title}
        </p>
      )}

      {/* Summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 32, fontWeight: 700, color: S.text, lineHeight: 1 }}>
            {summary?.avg_score?.toFixed(1) ?? '—'}
          </p>
          <Stars score={Math.round(summary?.avg_score ?? 0)} />
          <p style={{ fontSize: 11, color: S.text3, marginTop: 4 }}>{summary?.count ?? 0} avis</p>
        </div>
        <div style={{ flex: 1 }}>
          {[5, 4, 3, 2, 1].map(n => {
            const count = summary?.ratings?.filter(r => r.score === n).length ?? 0
            const total = summary?.count ?? 1
            const pct = total > 0 ? (count / total) * 100 : 0
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: S.text2, width: 8 }}>{n}</span>
                <span style={{ fontSize: 12, color: S.amber }}>★</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: S.surface2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: S.orange, borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 10, color: S.text3, width: 20, textAlign: 'right' }}>{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add rating button */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          style={{ fontSize: 12, padding: '7px 14px', borderRadius: 10, border: `0.5px solid ${S.border}`, background: 'transparent', color: S.text2, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          + Laisser un avis
        </button>
      ) : (
        <div style={{ borderTop: `0.5px solid ${S.border}`, paddingTop: 16 }}>
          <p style={{ fontSize: 12, color: S.text2, marginBottom: 10 }}>Votre note</p>
          <Stars score={myScore} interactive onRate={setMyScore} />
          <textarea
            value={myComment}
            onChange={e => setMyComment(e.target.value)}
            placeholder="Commentaire (optionnel)…"
            rows={3}
            style={{ width: '100%', marginTop: 12, padding: '9px 13px', border: `0.5px solid ${S.border}`, borderRadius: 10, fontSize: 13, color: S.text, background: S.bg, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
          />
          {error && <p style={{ fontSize: 12, color: S.red, marginTop: 6 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={submit}
              disabled={!myScore || submitting}
              style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: !myScore ? S.text3 : S.orange, color: '#fff', fontSize: 13, cursor: !myScore ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {submitting ? 'Envoi…' : 'Publier'}
            </button>
            <button
              onClick={() => { setShowForm(false); setMyScore(0); setMyComment(''); setError('') }}
              style={{ padding: '8px 14px', borderRadius: 10, border: `0.5px solid ${S.border}`, background: 'transparent', color: S.text2, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Recent ratings */}
      {summary && summary.ratings.length > 0 && (
        <div style={{ marginTop: 20, borderTop: `0.5px solid ${S.border}`, paddingTop: 16 }}>
          <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: S.text3, marginBottom: 12 }}>Avis récents</p>
          {summary.ratings.slice(0, 5).map(r => (
            <div key={r.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `0.5px solid ${S.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Stars score={r.score} />
                <span style={{ fontSize: 11, color: S.text3, textTransform: 'capitalize' }}>{r.rater_role}</span>
                <span style={{ fontSize: 10, color: S.text3, marginLeft: 'auto' }}>
                  {new Date(r.created_at).toLocaleDateString('fr-CH')}
                </span>
              </div>
              {r.comment && <p style={{ fontSize: 13, color: S.text2, lineHeight: 1.5, margin: 0 }}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
