'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Home, RefreshCw } from 'lucide-react';

export default function BienError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to monitoring without crashing
    console.error('[BienError]', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '40vh', gap: 16, padding: 32, textAlign: 'center',
    }}>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 360 }}>
        Ce bien est introuvable ou a été supprimé.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={reset}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 10, cursor: 'pointer',
            background: 'var(--background-card)', border: '1px solid var(--border-subtle)',
            fontSize: 13, color: 'var(--charcoal)',
          }}
        >
          <RefreshCw size={13} /> Réessayer
        </button>
        <Link
          href="/app/biens"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 10,
            background: 'var(--terracotta-primary)', color: '#fff',
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}
        >
          <Home size={13} /> Retour aux biens
        </Link>
      </div>
    </div>
  );
}
