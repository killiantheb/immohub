'use client'
import { useState } from 'react'
import { CathySphere } from '@/components/CathySphere'
import { createClient } from '@/lib/supabase'

export function CathyShell({ children }: { children: React.ReactNode }) {
  const [showDashboard, setShowDashboard] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [status, setStatus] = useState('en attente de votre voix')
  const [input, setInput] = useState('')

  async function handleSend() {
    if (!input.trim()) return
    const msg = input.trim()
    setInput('')
    setSpeaking(true)
    setStatus('Cathy analyse…')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(`${apiUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, context: {} }),
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let reply = ''
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          for (const line of chunk.split('\n')) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const parsed = JSON.parse(line.slice(6))
                if (parsed.text) reply += parsed.text
                if (reply.length > 80) break
              } catch { /* ignore */ }
            }
          }
          if (reply.length > 80) break
        }
        reader.cancel()
      }
      const short = reply.trim() || 'Je traite votre demande.'
      setStatus(short.length > 80 ? short.substring(0, 80) + '…' : short)
    } catch {
      setStatus('Réessayez dans un moment.')
    } finally {
      setSpeaking(false)
    }
  }

  if (!showDashboard) {
    return (
      <div style={{ minHeight: '100vh', background: '#060402', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', fontFamily: 'var(--font-sans)' }}>
        <button onClick={() => setShowDashboard(true)} style={{ position: 'absolute', top: 16, right: 16, padding: '6px 14px', borderRadius: 20, border: '0.5px solid rgba(212,96,26,0.2)', background: 'rgba(255,255,255,0.03)', color: 'rgba(200,95,25,0.5)', fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer' }}>
          Tableau de bord
        </button>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 11, fontWeight: 300, letterSpacing: '8px', color: 'rgba(200,95,25,0.38)', textTransform: 'uppercase', marginBottom: '2rem' }}>Cathy</p>
        <div style={{ marginBottom: '2rem', filter: 'drop-shadow(0 16px 48px rgba(212,96,26,0.22))', animation: 'cathyFloat 5.5s ease-in-out infinite' }}>
          <style>{`@keyframes cathyFloat{0%,100%{transform:translateY(0)}40%{transform:translateY(-10px)}70%{transform:translateY(-5px)}}`}</style>
          <CathySphere size={240} speaking={speaking} />
        </div>
        <p style={{ fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'rgba(200,95,25,0.5)', marginBottom: '1.6rem', textAlign: 'center', minHeight: 16 }}>{status}</p>
        <button onClick={() => setSpeaking(!speaking)} style={{ width: 48, height: 48, borderRadius: '50%', border: `1px solid ${speaking ? '#D4601A' : 'rgba(212,96,26,0.2)'}`, background: speaking ? 'rgba(212,96,26,0.1)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '1rem' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={speaking ? '#D4601A' : 'rgba(200,95,25,0.75)'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0014 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="9" y1="22" x2="15" y2="22"/></svg>
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 28, padding: '8px 8px 8px 18px', border: '0.5px solid rgba(212,96,26,0.15)', width: 300 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Ou écris ici…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'rgba(255,195,140,0.85)', fontFamily: 'inherit' }} />
          <button onClick={handleSend} style={{ width: 32, height: 32, borderRadius: '50%', background: '#D4601A', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <header style={{ background: '#fff', borderBottom: '0.5px solid rgba(160,92,40,0.1)', padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 300, color: '#D4601A', letterSpacing: '3px' }}>Cathy</span>
        <button onClick={() => setShowDashboard(false)} style={{ padding: '7px 16px', borderRadius: 20, border: '0.5px solid rgba(160,92,40,0.2)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#A05C28', fontFamily: 'inherit' }}>← Retour à Cathy</button>
      </header>
      {children}
    </div>
  )
}
