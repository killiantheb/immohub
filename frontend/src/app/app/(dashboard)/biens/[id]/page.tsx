// src/app/app/(dashboard)/biens/[id]/page.tsx
// Vue d'ensemble — hub de navigation entre les sections du bien
"use client";

import { Suspense, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Clock, FileText, Sparkles, TrendingUp, User, Wrench } from "lucide-react";
import { S, Card } from "./_shared";

// ── Tab deep-link redirect (PROMPT 12 compat) ─────────────────────────────────
const TAB_TO_PATH: Record<string, string> = {
  locataire:     "locataire",
  historique:    "historique",
  documents:     "documents",
  interventions: "interventions",
  finances:      "finances",
  potentiel:     "potentiel",
};

function BienOverview() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Redirige ?tab=xxx → sous-page canonique (deep-links depuis la Sphère IA)
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && TAB_TO_PATH[tab]) {
      router.replace(`/app/biens/${id}/${TAB_TO_PATH[tab]}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sections = [
    {
      label: "Locataire",
      sub: "Bail, paiements et scoring",
      icon: User,
      color: S.orange,
      bg: S.orangeBg,
      href: `/app/biens/${id}/locataire`,
    },
    {
      label: "Documents",
      sub: "Bail, EDL, quittances",
      icon: FileText,
      color: S.blue,
      bg: S.blueBg,
      href: `/app/biens/${id}/documents`,
    },
    {
      label: "Finances",
      sub: "Loyers encaissés, charges",
      icon: TrendingUp,
      color: S.green,
      bg: S.greenBg,
      href: `/app/biens/${id}/finances`,
    },
    {
      label: "Interventions",
      sub: "Travaux et incidents",
      icon: Wrench,
      color: S.amber,
      bg: S.amberBg,
      href: `/app/biens/${id}/interventions`,
    },
    {
      label: "Historique",
      sub: "Anciens locataires",
      icon: Clock,
      color: S.text2,
      bg: S.border,
      href: `/app/biens/${id}/historique`,
    },
    {
      label: "Potentiel IA",
      sub: "Analyse et rendement",
      icon: Sparkles,
      color: S.orange,
      bg: S.orangeBg,
      href: `/app/biens/${id}/potentiel`,
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
      {sections.map(sec => {
        const Icon = sec.icon;
        return (
          <Link key={sec.href} href={sec.href} style={{ textDecoration: "none" }}>
            <Card style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "box-shadow 0.15s" }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                background: sec.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={18} style={{ color: sec.color }} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: S.text, margin: 0 }}>{sec.label}</p>
                <p style={{ fontSize: 12, color: S.text3, margin: 0 }}>{sec.sub}</p>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export default function BienDetailPage() {
  return (
    <Suspense>
      <BienOverview />
    </Suspense>
  );
}
