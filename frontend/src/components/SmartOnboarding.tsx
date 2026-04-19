'use client'
import { useState, useEffect, useRef } from 'react'
import { AlthySphere } from '@/components/AlthySphere'
import { baseURL } from '@/lib/api'
import { C } from "@/lib/design-tokens";

// SpeechRecognition n'est pas exposé comme type global dans tous les lib.dom — on le déclare ici
interface ISpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  onresult: ((e: ISpeechRecognitionEvent) => void) | null
}
interface ISpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number }
}
interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition
}

type Role = 'owner' | 'agency' | 'company' | 'opener' | 'tenant'
type Mode = 'choice' | 'buttons' | 'voice' | 'form' | 'searching' | 'review'

interface Props {
  onComplete: (role: string, data: Record<string, unknown>) => void
}

const ROLES: { id: Role; label: string; desc: string }[] = [
  { id: 'owner',   label: 'Propriétaire',        desc: 'Je possède des biens' },
  { id: 'agency',  label: 'Agence immobilière',   desc: 'Je gère des portefeuilles' },
  { id: 'company', label: 'Artisan / Entreprise',  desc: 'Je fais des travaux' },
  { id: 'opener',  label: 'Ouvreur de porte',     desc: 'Je fais des visites' },
  { id: 'tenant',  label: 'Locataire',            desc: 'Je loue un logement' },
]

export function SmartOnboarding({ onComplete }: Props) {
  const [mode, setMode] = useState<Mode>('choice')
  const [speaking, setSpeaking] = useState(false)
  const [micActive, setMicActive] = useState(false)
  const [status, setStatus] = useState('Bonjour — je suis Althy')
  const [role, setRole] = useState<Role | null>(null)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [voiceInput, setVoiceInput] = useState('')
  const [form, setForm] = useState({ name: '', website: '', location: '', email: '', phone: '', uid: '' })
  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  // Althy parle en premier
  useEffect(() => {
    setSpeaking(true)
    const timer = setTimeout(() => {
      setSpeaking(false)
      setStatus('Comment voulez-vous commencer ?')
    }, 2500)
    return () => clearTimeout(timer)
  }, [])

  // ── RECONNAISSANCE VOCALE ─────────────────────────────────────────────────────

  function startMic() {
    const w = window as Window & { SpeechRecognition?: ISpeechRecognitionConstructor; webkitSpeechRecognition?: ISpeechRecognitionConstructor }
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) {
      setStatus('Votre navigateur ne supporte pas la reconnaissance vocale — utilisez le texte ci-dessous')
      return
    }
    const rec = new SR()
    rec.lang = 'fr-CH'
    rec.continuous = false
    rec.interimResults = true
    rec.onstart = () => { setMicActive(true); setSpeaking(true); setStatus('Je vous écoute…') }
    rec.onresult = (e: ISpeechRecognitionEvent) => {
      const parts: string[] = []
      for (let i = 0; i < e.results.length; i++) parts.push(e.results[i][0].transcript)
      const t = parts.join('')
      setVoiceInput(t)
      setStatus(`"${t.substring(0, 55)}${t.length > 55 ? '…' : ''}"`)
    }
    rec.onend = () => { setMicActive(false); setSpeaking(false) }
    rec.onerror = () => { setMicActive(false); setSpeaking(false); setStatus('Utilisez le champ texte ci-dessous') }
    recognitionRef.current = rec
    rec.start()
  }

  function stopMic() { recognitionRef.current?.stop(); setMicActive(false); setSpeaking(false) }

  // ── STREAM SSE ────────────────────────────────────────────────────────────────

  async function launchSearch(endpoint: string, body: Record<string, unknown>) {
    setMode('searching')
    setSpeaking(true)
    setProgress(5)

    try {
      const res = await fetch(`${baseURL}/smart-onboarding/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.body) throw new Error('No stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>
            if (typeof data.message === 'string') setStatus(data.message)
            if (typeof data.progress === 'number') setProgress(data.progress)
            if (data.step === 'detected' && data.profile && typeof (data.profile as Record<string, unknown>).role === 'string') {
              setRole((data.profile as Record<string, unknown>).role as Role)
            }
            if (data.step === 'need_more') { setSpeaking(false); setMode('voice') }
            if (data.step === 'complete') {
              setResult(data.result as Record<string, unknown>)
              if (typeof data.role === 'string') setRole(data.role as Role)
              setSpeaking(false)
              setMode('review')
            }
          } catch { /* skip malformed chunks */ }
        }
      }
    } catch {
      setSpeaking(false)
      setStatus('Réessayez dans un moment.')
      setMode('choice')
    }
  }

  function submitVoice() {
    const text = voiceInput.trim()
    if (!text) return
    launchSearch('from-speech', { transcript: text })
  }

  function submitForm() {
    if (!form.name.trim() || !role) return
    launchSearch('from-manual', {
      role,
      name: form.name,
      website: form.website || null,
      uid_number: form.uid || null,
      location: form.location || null,
      email: form.email || null,
      phone: form.phone || null,
    })
  }

  // ── RENDU ─────────────────────────────────────────────────────────────────────

  return (
    <div style={overlay}>
      <div style={{ background: C.bg, borderRadius: '20px', padding: '1.8rem', width: '100%', maxWidth: '420px', fontFamily: 'var(--font-sans)', maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Bulle Althy */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.4rem' }}>
          <div style={{ animation: speaking ? 'pulse 0.6s ease-in-out infinite alternate' : 'float 5s ease-in-out infinite' }}>
            <style>{`
              @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
              @keyframes pulse{0%{transform:scale(1)}100%{transform:scale(1.05)}}
            `}</style>
            <AlthySphere size={100} speaking={speaking} />
          </div>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '10px', letterSpacing: '6px', color: C.orange, textTransform: 'uppercase', marginTop: '0.6rem' }}>Althy</span>
        </div>

        {/* Bulle de status */}
        <div style={{ background: C.surface, borderRadius: '12px', padding: '12px 16px', border: `0.5px solid ${C.border}`, marginBottom: '1.4rem', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: C.text, lineHeight: 1.5, margin: 0 }}>{status}</p>
        </div>

        {/* Barre de progression */}
        {mode === 'searching' && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ height: '3px', background: C.surface2, borderRadius: '2px' }}>
              <div style={{ height: '3px', background: C.orange, borderRadius: '2px', width: `${progress}%`, transition: 'width 0.6s ease' }} />
            </div>
            <p style={{ fontSize: '10px', color: C.text3, marginTop: '5px', textAlign: 'center', margin: '5px 0 0' }}>{progress}%</p>
          </div>
        )}

        {/* ── MODE CHOICE ── */}
        {mode === 'choice' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button onClick={() => { setMode('buttons'); setStatus('Qui êtes-vous ?') }} style={{ padding: '16px 12px', borderRadius: '12px', border: `0.5px solid ${C.border}`, background: C.surface, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}>
              <strong style={{ fontSize: '13px', color: C.text, display: 'block', marginBottom: '4px' }}>Boutons</strong>
              <span style={{ fontSize: '11px', color: C.text3 }}>Je préfère cliquer</span>
            </button>
            <button onClick={() => { setMode('voice'); setStatus('Dites-moi qui vous êtes') }} style={{ padding: '16px 12px', borderRadius: '12px', border: `0.5px solid ${C.border}`, background: C.surface, cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}>
              <strong style={{ fontSize: '13px', color: C.text, display: 'block', marginBottom: '4px' }}>Oral</strong>
              <span style={{ fontSize: '11px', color: C.text3 }}>Je préfère parler</span>
            </button>
          </div>
        )}

        {/* ── MODE BUTTONS ── */}
        {mode === 'buttons' && !role && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ROLES.map(r => (
              <button
                key={r.id}
                onClick={() => { setRole(r.id); setMode('form'); setStatus(`Parfait — dites-moi en plus sur votre ${r.label.toLowerCase()}`) }}
                style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 14px', borderRadius: '10px', border: `0.5px solid ${C.border}`, background: C.surface, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', width: '100%' }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: C.text }}>{r.label}</div>
                  <div style={{ fontSize: '11px', color: C.text3 }}>{r.desc}</div>
                </div>
              </button>
            ))}
            <button onClick={() => setMode('choice')} style={{ padding: '10px 16px', borderRadius: '24px', border: `0.5px solid ${C.border}`, background: 'transparent', color: C.text2, fontFamily: 'inherit', fontSize: '12px', cursor: 'pointer' }}>← Retour</button>
          </div>
        )}

        {/* ── MODE FORM ── */}
        {mode === 'form' && role && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ padding: '8px 12px', background: C.orangeBg, borderRadius: '8px', border: `0.5px solid ${C.orange}`, fontSize: '12px', color: C.orange }}>
              {ROLES.find(r => r.id === role)?.label}
            </div>

            <input
              placeholder={role === 'agency' ? "Nom de l'agence *" : role === 'company' ? "Nom de l'entreprise *" : 'Votre nom complet *'}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ width: '100%', padding: '11px 14px', border: `0.5px solid ${C.border}`, borderRadius: '8px', background: C.surface, fontFamily: 'inherit', fontSize: '13px', color: C.text, outline: 'none', boxSizing: 'border-box' }}
            />

            {(role === 'agency' || role === 'company') && (
              <>
                <input placeholder='Site web — ex: www.votreagence.ch' value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} style={{ width: '100%', padding: '11px 14px', border: `0.5px solid ${C.border}`, borderRadius: '8px', background: C.surface, fontFamily: 'inherit', fontSize: '13px', color: C.text, outline: 'none', boxSizing: 'border-box' }} />
                <input placeholder='Numéro UID / TVA (optionnel) — CHE-xxx.xxx.xxx' value={form.uid} onChange={e => setForm(f => ({ ...f, uid: e.target.value }))} style={{ width: '100%', padding: '11px 14px', border: `0.5px solid ${C.border}`, borderRadius: '8px', background: C.surface, fontFamily: 'inherit', fontSize: '13px', color: C.text, outline: 'none', boxSizing: 'border-box' }} />
              </>
            )}

            <input placeholder='Ville / Canton — ex: Genève, Lausanne, Zurich' value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={{ width: '100%', padding: '11px 14px', border: `0.5px solid ${C.border}`, borderRadius: '8px', background: C.surface, fontFamily: 'inherit', fontSize: '13px', color: C.text, outline: 'none', boxSizing: 'border-box' }} />

            {role === 'owner' && (
              <input placeholder='Email (optionnel)' value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ width: '100%', padding: '11px 14px', border: `0.5px solid ${C.border}`, borderRadius: '8px', background: C.surface, fontFamily: 'inherit', fontSize: '13px', color: C.text, outline: 'none', boxSizing: 'border-box' }} />
            )}
            {role === 'opener' && (
              <input placeholder='Téléphone (optionnel)' value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={{ width: '100%', padding: '11px 14px', border: `0.5px solid ${C.border}`, borderRadius: '8px', background: C.surface, fontFamily: 'inherit', fontSize: '13px', color: C.text, outline: 'none', boxSizing: 'border-box' }} />
            )}

            <p style={{ fontSize: '10px', color: C.text3, textAlign: 'center', margin: 0 }}>
              Althy cherche le reste automatiquement sur le web
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setRole(null); setMode('buttons') }} style={{ padding: '10px 16px', borderRadius: '24px', border: `0.5px solid ${C.border}`, background: 'transparent', color: C.text2, fontFamily: 'inherit', fontSize: '12px', cursor: 'pointer' }}>← Retour</button>
              <button
                onClick={submitForm}
                disabled={!form.name.trim()}
                style={{ flex: 1, padding: '12px', borderRadius: '24px', background: !form.name.trim() ? C.text3 : C.orange, border: 'none', color: '#fff', fontFamily: 'inherit', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', cursor: !form.name.trim() ? 'not-allowed' : 'pointer' }}
              >
                Althy cherche tout →
              </button>
            </div>
          </div>
        )}

        {/* ── MODE VOICE ── */}
        {mode === 'voice' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={micActive ? stopMic : startMic}
              style={{
                width: '64px', height: '64px', borderRadius: '50%',
                border: `2px solid ${micActive ? C.orange : C.border}`,
                background: micActive ? C.orangeBg : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.25s',
                boxShadow: micActive ? `0 0 0 10px ${C.orangeBg}` : 'none',
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={micActive ? C.orange : C.text3} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3"/>
                <path d="M5 10a7 7 0 0014 0"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
                <line x1="9" y1="22" x2="15" y2="22"/>
              </svg>
            </button>

            <p style={{ fontSize: '11px', color: C.text3, letterSpacing: '0.5px', margin: 0 }}>
              {micActive ? 'Je vous écoute — cliquez pour arrêter' : 'Appuyez pour parler'}
            </p>

            <p style={{ fontSize: '11px', color: C.text3, textAlign: 'center', fontStyle: 'italic', margin: 0 }}>
              Ex: &quot;Je suis Marc, directeur de l&apos;agence Immo Léman à Genève&quot;
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
              <div style={{ flex: 1, height: '0.5px', background: C.border }} />
              <span style={{ fontSize: '10px', color: C.text3, letterSpacing: '1px' }}>ou tapez</span>
              <div style={{ flex: 1, height: '0.5px', background: C.border }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <input
                value={voiceInput}
                onChange={e => setVoiceInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitVoice()}
                placeholder="Décrivez-vous en quelques mots…"
                style={{ flex: 1, padding: '11px 14px', border: `0.5px solid ${C.border}`, borderRadius: '8px', background: C.surface, fontFamily: 'inherit', fontSize: '13px', color: C.text, outline: 'none', boxSizing: 'border-box' }}
              />
              <button
                onClick={submitVoice}
                style={{ width: '44px', height: '44px', borderRadius: '50%', background: C.orange, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>

            <button onClick={() => setMode('choice')} style={{ padding: '10px 16px', borderRadius: '24px', border: `0.5px solid ${C.border}`, background: 'transparent', color: C.text2, fontFamily: 'inherit', fontSize: '12px', cursor: 'pointer' }}>← Retour</button>
          </div>
        )}

        {/* ── MODE REVIEW ── */}
        {mode === 'review' && result && (
          <div>
            {role && (
              <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', background: C.orangeBg, border: `0.5px solid ${C.orange}`, fontSize: '11px', color: C.orange, marginBottom: '1rem' }}>
                {ROLES.find(r => r.id === role)?.label}
              </div>
            )}

            <div style={{ background: C.surface, borderRadius: '10px', padding: '10px', border: `0.5px solid ${C.border}`, maxHeight: '220px', overflowY: 'auto', marginBottom: '1rem' }}>
              {Object.entries(result)
                .filter(([k, v]) =>
                  !['notes', 'confidence_score', 'sources_found'].includes(k) &&
                  v !== null && v !== '' &&
                  !(Array.isArray(v) && v.length === 0)
                )
                .map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `0.5px solid ${C.border}`, gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: C.text3, textTransform: 'uppercase', letterSpacing: '0.3px', flexShrink: 0 }}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '12px', color: C.text, fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>
                      {Array.isArray(val) ? (val as unknown[]).map(String).join(', ') : String(val)}
                    </span>
                  </div>
                ))
              }
            </div>

            {Boolean(result.notes) && (
              <p style={{ fontSize: '10px', color: C.text3, marginBottom: '1rem', fontStyle: 'italic' }}>
                {String(result.notes)}
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setMode('choice'); setResult(null); setRole(null); setStatus('Comment voulez-vous commencer ?') }}
                style={{ padding: '10px 16px', borderRadius: '24px', border: `0.5px solid ${C.border}`, background: 'transparent', color: C.text2, fontFamily: 'inherit', fontSize: '12px', cursor: 'pointer' }}
              >
                Recommencer
              </button>
              <button
                onClick={() => onComplete(role!, result)}
                style={{ flex: 1, padding: '12px', borderRadius: '24px', background: C.orange, border: 'none', color: '#fff', fontFamily: 'inherit', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}
              >
                Valider →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(28,15,6,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '1rem',
}
