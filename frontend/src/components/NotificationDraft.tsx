'use client'
import { useState } from 'react'
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
      <div style={{ background: S.bg, borderRadius: 20, padding: '28px', maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-serif),\'Cormorant Garamond\',serif', fontSize: 18, fontWeight: 400, color: S.orange, margin: 0 }}>
            Notification — {recipientName}
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: S.text2 }}>×</button>
        </div>

        {/* Channel selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['email', 'whatsapp'] as const).map(ch => (
            <button
              key={ch}
              onClick={() => setChannel(ch)}
              style={{
                padding: '7px 16px', borderRadius: 10, border: `0.5px solid ${S.border}`,
                background: channel === ch ? S.orange : 'transparent',
                color: channel === ch ? '#fff' : S.text2,
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}
            >
              {ch === 'email' ? 'Email' : 'WhatsApp'}
            </button>
          ))}
        </div>

        {!draft ? (
          <>
            {context && (
              <div style={{ background: S.orangeBg, border: `0.5px solid ${S.orange}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                <p style={{ fontSize: 11, color: S.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 4 }}>Contexte</p>
                <p style={{ fontSize: 13, color: S.text2, margin: 0 }}>{context}</p>
              </div>
            )}
            <button
              onClick={generateDraft}
              disabled={loading}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: loading ? S.text3 : S.orange, color: '#fff', fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {loading ? 'Rédaction IA en cours…' : 'Générer le message'}
            </button>
          </>
        ) : (
          <>
            {channel === 'email' && draft.subject && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: S.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>Objet</p>
                <p style={{ fontSize: 13, color: S.text, padding: '8px 12px', background: S.surface, borderRadius: 8, border: `0.5px solid ${S.border}`, margin: 0 }}>{draft.subject}</p>
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: S.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>Message</p>
              <textarea
                value={message}
                readOnly
                rows={10}
                style={{ width: '100%', padding: '12px 14px', border: `0.5px solid ${S.border}`, borderRadius: 12, fontSize: 13, color: S.text, background: S.surface, outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={copy}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: copied ? S.green : S.orange, color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {copied ? 'Copié' : 'Copier le message'}
              </button>
              <button
                onClick={() => setDraft(null)}
                style={{ padding: '10px 14px', borderRadius: 10, border: `0.5px solid ${S.border}`, background: 'transparent', color: S.text2, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
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
                style={{ display: 'block', textAlign: 'center', marginTop: 10, padding: '10px', borderRadius: 10, background: S.text2, color: '#fff', fontSize: 13, textDecoration: 'none' }}
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
