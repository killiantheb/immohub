'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { X, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { baseURL } from '@/lib/api';
import { createClient } from '@/lib/supabase';

interface PendingAction {
  id: string;
  label: string;
  priority: 'urgent' | 'normal';
}

interface PendingCountResponse {
  count: number;
  actions?: PendingAction[];
}

export function SphereWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<PendingCountResponse>('/sphere/pending-count')
      .then(r => {
        setCount(r.data.count ?? 0);
        setActions(r.data.actions ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Remplacé par l'entrée "Althy IA" dans la sidebar — masqué partout
  return null;
  // eslint-disable-next-line no-unreachable
  if (pathname === '/app/sphere' || pathname === '/app/carte') return null;

  async function handleSend() {
    if (!input.trim() || sending) return;
    setSending(true);
    setReply(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const resp = await fetch(`${baseURL}/sphere/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: input, context: { page: 'widget' } }),
      });
      if (resp.ok && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') continue;
            try {
              const event = JSON.parse(raw) as { type?: string; text?: string };
              if (event.type === 'text' || event.text) {
                fullText += (event.text ?? '').replace(/\\n/g, '\n');
              }
            } catch { /* ignore */ }
          }
        }
        setReply(fullText || 'Votre demande a été traitée.');
      }
    } catch { /* ignore */ }
    finally {
      setSending(false);
      setInput('');
    }
  }

  return (
    <>
      {/* ── Mini widget panel ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 1000,
          width: 340, background: 'var(--althy-surface)',
          border: '1px solid var(--althy-border)',
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(26,22,18,0.14)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--althy-border)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--althy-text)' }}>Althy IA</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--althy-text-3)', padding: 2 }}>
              <X size={16} />
            </button>
          </div>

          {/* Urgent actions */}
          {actions.length > 0 && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--althy-border)' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--althy-text-3)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>
                Actions urgentes
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {actions.slice(0, 3).map(action => (
                  <div key={action.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: action.priority === 'urgent' ? 'var(--althy-red-bg, #FFF4F2)' : 'var(--althy-bg)', borderRadius: 8, border: `1px solid ${action.priority === 'urgent' ? 'rgba(220,53,69,0.15)' : 'var(--althy-border)'}` }}>
                    {action.priority === 'urgent' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC3545', flexShrink: 0 }} />}
                    <span style={{ fontSize: 12, color: 'var(--althy-text)', flex: 1 }}>{action.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reply area */}
          {reply && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--althy-border)', maxHeight: 120, overflowY: 'auto' }}>
              <p style={{ fontSize: 12, color: 'var(--althy-text)', lineHeight: 1.6, margin: 0 }}>{reply}</p>
            </div>
          )}

          {/* Quick input */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder='Posez une question rapide…'
                disabled={sending}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--althy-border)', background: 'var(--althy-bg)', fontSize: 12, color: 'var(--althy-text)', outline: 'none', fontFamily: 'inherit' }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--althy-orange)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sending || !input.trim() ? 0.5 : 1 }}
              >
                <Send size={14} color='#fff' />
              </button>
            </div>
            <Link
              href='/app/sphere'
              onClick={() => setOpen(false)}
              style={{ display: 'block', marginTop: 10, textAlign: 'center', fontSize: 12, color: 'var(--althy-orange)', textDecoration: 'none', fontWeight: 600 }}
            >
              Ouvrir Althy IA →
            </Link>
          </div>
        </div>
      )}

      {/* ── Floating button ── */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label='Ouvrir Althy IA'
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--althy-orange)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(15,46,76,0.4)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {/* Sphere icon */}
        <svg width='24' height='24' viewBox='0 0 24 24' fill='none'>
          <circle cx='12' cy='12' r='9' fill='rgba(255,255,255,0.25)' />
          <circle cx='12' cy='12' r='5' fill='rgba(255,255,255,0.9)' />
        </svg>

        {/* Badge */}
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 18, height: 18, borderRadius: 9,
            background: '#DC3545', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid #fff',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
    </>
  );
}
