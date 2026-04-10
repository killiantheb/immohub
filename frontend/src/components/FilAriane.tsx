'use client';
import Link from 'next/link';

interface Item { label: string; href?: string; }

export function FilAriane({ items }: { items: Item[] }) {
  return (
    <nav style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '20px' }}>
      {items.map(function(it, i) {
        return (
          <span key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {i > 0 && <span style={{ color: 'var(--althy-text-3)', fontSize: '12px' }}>/</span>}
            {it.href
              ? <Link href={it.href} style={{ fontSize: '13px', color: i === items.length - 1 ? 'var(--althy-text)' : 'var(--althy-text-3)', textDecoration: 'none', fontWeight: i === items.length - 1 ? 600 : 400 }}>{it.label}</Link>
              : <span style={{ fontSize: '13px', color: 'var(--althy-text)', fontWeight: 600 }}>{it.label}</span>}
          </span>
        );
      })}
    </nav>
  );
}
