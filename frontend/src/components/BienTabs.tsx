// src/components/BienTabs.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Tab { label: string; href: string; badge?: string }

const BIEN_TABS_BASE = (bienId: string): Tab[] => [
  { label: "Vue d'ensemble",  href: `/app/biens/${bienId}` },
  { label: "Locataire",       href: `/app/biens/${bienId}/locataire` },
  { label: "Documents",       href: `/app/biens/${bienId}/documents` },
  { label: "Finances",        href: `/app/biens/${bienId}/finances` },
  { label: "Interventions",   href: `/app/biens/${bienId}/interventions` },
  { label: "Historique",      href: `/app/biens/${bienId}/historique` },
];

interface Props { bienId: string }

export function BienTabs({ bienId }: Props) {
  const pathname = usePathname();
  const [hasChangement, setHasChangement] = useState(false);
  const base = `/app/biens/${bienId}`;

  useEffect(() => {
    api
      .get(`/biens/${bienId}/changement/actif`)
      .then((r) => setHasChangement(!!r.data))
      .catch(() => {});
  }, [bienId]);

  const tabs: Tab[] = [
    ...BIEN_TABS_BASE(bienId),
    ...(hasChangement
      ? [{ label: "Changement", href: `${base}/changement`, badge: "En cours" }]
      : [{ label: "Changement", href: `${base}/changement` }]),
  ];

  // Active tab: prefer deepest matching prefix; exact match for root
  const activeHref =
    [...tabs].reverse().find(t =>
      t.href === base
        ? pathname === base
        : pathname === t.href || pathname.startsWith(t.href + "/")
    )?.href ?? base;

  return (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid var(--althy-border)",
        marginBottom: "1.5rem",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "var(--althy-bg)",
        paddingTop: 2,
        scrollbarWidth: "none",
      }}
    >
      {tabs.map(tab => {
        const active = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              whiteSpace: "nowrap",
              textDecoration: "none",
              borderBottom: `2px solid ${active ? "var(--althy-orange)" : "transparent"}`,
              color: active ? "var(--althy-orange)" : "var(--althy-text-3)",
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              transition: "color 0.15s",
              flexShrink: 0,
            }}
          >
            {tab.label}
            {tab.badge && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 7px",
                  borderRadius: 20,
                  background: "var(--althy-orange)",
                  color: "#fff",
                  lineHeight: 1.6,
                  letterSpacing: 0.2,
                }}
              >
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
