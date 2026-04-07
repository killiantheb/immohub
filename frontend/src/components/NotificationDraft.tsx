'use client'
import { useState } from 'react'
import { api } from '@/lib/api'

const O = '#D4601A'
const T = '#1C0F06'
const T5 = 'rgba(80,35,8,0.55)'
const T3 = 'rgba(80,35,8,0.30)'
const border = '0.5px solid rgba(160,92,40,0.2)'

interface Props {
  recipientName: string
  recipientPhone?: string
  recipientEmail?: string
  context?: string  // ex: "loyer en retard de 15 jours, montant 1500 CHF"
  onClose: () => void
}

interface DraftResult {
  email: string
  whatsapp: string
  subject: string
}

export function NotificationDraft({ recipientName, recipientPhone, recipientEmail, context, onClose }: Props) {
  const [channel, setChannel] = useState<'email' | 'whatsapp'>('email')
  const [draft, setDraft] = useState<DraftResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generateDraft() {
    setLoading(true)
    try {
      const r = await api.post('/ai/draft-notification', {
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        recipient_email: recipientEmail,
        context: context ?? '',
        channels: ['email', 'whatsapp'],
      })
      setDraft(r.data)
    } catch {
      setDraft({
        email: `Objet : Rappel\n\nBonjour ${recipientName},\n\n${context ?? ''}\n\nCordialement,`,
        whatsapp: `Bonjour ${recipientName}, ${context ?? ''} N'hésitez pas à nous contacter.`,
        subject: 'Rappel',
      })
    } finally {
      setLoading(false)
    }
  }

  function copy() {
    const text = channel === 'email' ? (draft?.email ?? '') : (draft?.whatsapp ?? '')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const message = channel === 'email' ? draft?.email : draft?.whatsapp

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,15,6,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#FAF5EB', borderRadius: 20, padding: '28px', maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 300, color: O, margin: 0 }}>
            Notification — {recipientName}
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: T5 }}>×</button>
        </div>

        {/* Channel selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['email', 'whatsapp'] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setChannel(ch)}
              style={{
                padding: '7px 16px', borderRadius: 10, border,
                background: channel === ch ? O : 'transparent',
                color: channel === ch ? '#fff' : T5,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}
            >
              {ch === 'email' ? '✉️ Email' : '💬 WhatsApp'}
            </button>
          ))}
        </div>

        {!draft ? (
          <>
            {context && (
              <div style={{ background: 'rgba(212,96,26,0.05)', border: '0.5px solid rgba(212,96,26,0.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: T3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>Contexte</p>
                <p style={{ fontSize: 13, color: T5 }}>{context}</p>
              </div>
            )}
            <button
              onClick={generateDraft}
              disabled={loading}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: loading ? 'rgba(212,96,26,0.5)' : O, color: '#fff', fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {loading ? 'Rédaction IA en cours…' : 'Générer le message'}
            </button>
          </>
        ) : (
          <>
            {channel === 'email' && draft.subject && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: T3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>Objet</p>
                <p style={{ fontSize: 13, color: T, padding: '8px 12px', background: '#fff', borderRadius: 8, border }}>{draft.subject}</p>
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: T3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>Message</p>
              <textarea
                value={message}
                readOnly
                rows={10}
                style={{ width: '100%', padding: '12px 14px', border, borderRadius: 12, fontSize: 13, color: T, background: '#fff', outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={copy}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: copied ? '#16a34a' : O, color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {copied ? 'Copié ✓' : 'Copier le message'}
              </button>
              <button
                onClick={() => setDraft(null)}
                style={{ padding: '10px 14px', borderRadius: 10, border, background: 'transparent', color: T5, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Regénérer
              </button>
            </div>
            {recipientPhone && channel === 'whatsapp' && (
              <a
                href={`https://wa.me/${recipientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message ?? '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', textAlign: 'center', marginTop: 10, padding: '10px', borderRadius: 10, background: '#25D366', color: '#fff', fontSize: 13, textDecoration: 'none' }}
              >
                Ouvrir WhatsApp
              </a>
            )}
            {recipientEmail && channel === 'email' && (
              <a
                href={`mailto:${recipientEmail}?subject=${encodeURIComponent(draft.subject ?? '')}&body=${encodeURIComponent(draft.email ?? '')}`}
                style={{ display: 'block', textAlign: 'center', marginTop: 10, padding: '10px', borderRadius: 10, background: '#4B5563', color: '#fff', fontSize: 13, textDecoration: 'none' }}
              >
                Ouvrir dans le client mail
              </a>
            )}
          </>
        )}
      </div>
    </div>
  )
}
