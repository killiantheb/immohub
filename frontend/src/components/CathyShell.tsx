'use client'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CathySphere } from '@/components/CathySphere'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useAuthStore } from '@/lib/store/authStore'

const BG = '#FAF5EB'
const O  = '#D4601A'
const T  = '#1C0F06'
const T5 = 'rgba(80,35,8,0.55)'
const T3 = 'rgba(80,35,8,0.30)'

const NAV_LINKS = [
  { href: '/dashboard',    label: 'Accueil' },
  { href: '/properties',   label: 'Biens' },
  { href: '/contracts',    label: 'Contrats' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/openers',      label: 'Missions' },
  { href: '/rfqs',         label: 'Appels d\'offre' },
  { href: '/overview',     label: 'Vue d\'ensemble' },
  { href: '/profile',      label: 'Profil' },
]

const QUICK_LINKS = [
  { href: '/properties',   label: 'Biens',           icon: '🏠' },
  { href: '/contracts',    label: 'Contrats',        icon: '📄' },
  { href: '/transactions', label: 'Transactions',    icon: '💶' },
  { href: '/openers',      label: 'Missions',        icon: '📍' },
  { href: '/rfqs',         label: 'Appels d\'offre', icon: '🔨' },
  { href: '/overview',     label: 'Vue d\'ensemble', icon: '📊' },
]

export function CathyShell({ children }: { children: React.ReactNode }) {
  const [showDashboard, setShowDashboard] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [status, setStatus] = useState('à votre écoute')
  const [input, setInput] = useState('')
  const sessionIdRef = useRef<string>(crypto.randomUUID())
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()
  const { user } = useAuthStore()

  // Guard onboarding — dans un useEffect pour éviter la boucle infinie
  useEffect(() => {
    if (user && !user.user_metadata?.onboarding_completed && pathname !== '/onboarding') {
      router.push('/onboarding')
    }
  }, [user, pathname, router])

  async function handleLogout() {
    await signOut()
    router.push('/login')
  }

  async function handleSend() {
    if (!input.trim()) return
    const msg = input.trim()
    setInput('')
    setSpeaking(true)
    setStatus('Althy analyse…')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(`${apiUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, context: { session_id: sessionIdRef.current } }),
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

  // ── Sphere view ──────────────────────────────────────────────────────────────
  if (!showDashboard) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', fontFamily: 'var(--font-sans)', padding: '2rem 1.2rem' }}>

        {/* Top-right: tableau de bord */}
        <button
          onClick={() => setShowDashboard(true)}
          style={{ position: 'absolute', top: 16, right: 16, padding: '6px 14px', borderRadius: 20, border: `0.5px solid rgba(212,96,26,0.25)`, background: 'rgba(212,96,26,0.07)', color: O, fontSize: 11, letterSpacing: '0.5px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Tableau de bord →
        </button>

        {/* Title */}
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 11, fontWeight: 300, letterSpacing: '8px', color: 'rgba(180,80,20,0.45)', textTransform: 'uppercase', marginBottom: '2rem' }}>Althy</p>

        {/* Sphere */}
        <div style={{ marginBottom: '1.8rem', animation: 'althyFloat 5.5s ease-in-out infinite' }} suppressHydrationWarning>
          <CathySphere size={200} speaking={speaking} />
        </div>

        {/* Status */}
        <p style={{ fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', color: T5, marginBottom: '1.6rem', textAlign: 'center', minHeight: 16 }}>{status}</p>

        {/* Mic button */}
        <button
          onClick={() => setSpeaking(!speaking)}
          style={{ width: 48, height: 48, borderRadius: '50%', border: `1px solid ${speaking ? O : 'rgba(212,96,26,0.25)'}`, background: speaking ? 'rgba(212,96,26,0.10)' : 'rgba(212,96,26,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '1.2rem' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={speaking ? O : T5} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3"/>
            <path d="M5 10a7 7 0 0014 0"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="9" y1="22" x2="15" y2="22"/>
          </svg>
        </button>

        {/* Text input */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fff', borderRadius: 28, padding: '8px 8px 8px 18px', border: `0.5px solid rgba(212,96,26,0.2)`, width: '100%', maxWidth: 340, marginBottom: '2rem' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ou écris ici…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: T, fontFamily: 'inherit' }}
          />
          <button
            onClick={handleSend}
            style={{ width: 32, height: 32, borderRadius: '50%', background: O, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        {/* Quick access shortcuts */}
        <div style={{ width: '100%', maxWidth: 360 }}>
          <p style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T3, marginBottom: '0.8rem', textAlign: 'center' }}>Accès rapide</p>
          <div className="ql-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {QUICK_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '12px 8px', borderRadius: 14, background: '#fff', border: `0.5px solid rgba(212,96,26,0.15)`, textDecoration: 'none' }}
              >
                <span style={{ fontSize: 20 }}>{link.icon}</span>
                <span style={{ fontSize: 11, color: T5, letterSpacing: '0.3px' }}>{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{ marginTop: '2rem', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T3, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}
        >
          Déconnexion
        </button>
      </div>
    )
  }

  // ── Dashboard view ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: `0.5px solid rgba(160,92,40,0.12)`, padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 300, color: O, letterSpacing: '3px' }}>Althy</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowDashboard(false)}
            style={{ padding: '6px 14px', borderRadius: 20, border: `0.5px solid rgba(160,92,40,0.2)`, background: 'transparent', cursor: 'pointer', fontSize: 12, color: T5, fontFamily: 'inherit' }}
          >
            ← Althy
          </button>
          <button
            onClick={handleLogout}
            style={{ padding: '6px 14px', borderRadius: 20, border: `0.5px solid rgba(160,92,40,0.2)`, background: 'transparent', cursor: 'pointer', fontSize: 12, color: T5, fontFamily: 'inherit' }}
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: `0.5px solid rgba(160,92,40,0.08)`, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        <div style={{ display: 'flex', padding: '0 1.5rem', gap: 2, minWidth: 'max-content' }}>
          {NAV_LINKS.map(link => {
            const active = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{ padding: '10px 14px', fontSize: 13, color: active ? O : T5, fontWeight: active ? 500 : 400, borderBottom: active ? `2px solid ${O}` : '2px solid transparent', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color 0.15s', display: 'block' }}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Content */}
      <main style={{ padding: '1.5rem' }}>
        {children}
      </main>
    </div>
  )
}
