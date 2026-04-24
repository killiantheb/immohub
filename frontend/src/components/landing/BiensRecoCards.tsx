"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Home } from "lucide-react";
import { C } from "@/lib/design-tokens";
import type { LandingEntities } from "./InlineChat";

const sans = "var(--font-sans)";
const API  = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type Bien = {
  id: string;
  titre: string;
  prix: number | null;
  ville: string;
  pieces: number | null;
  surface: number | null;
  cover: string | null;
  type_label: string;
};

// Normalisation types chat → valeurs enum FR backend (biens.type strict FR post-0029).
// Alias EN→FR conservés comme filet de sécurité parse LLM (Claude varie parfois EN).
const TYPE_MAP: Record<string, string> = {
  appartement: "appartement",
  apartment:   "appartement",   // alias EN (LLM variations)
  maison:      "maison",
  house:       "maison",        // alias EN
  studio:      "studio",
  villa:       "villa",
};

function parseBudget(budget?: string): number | undefined {
  if (!budget) return undefined;
  const digits = budget.replace(/[^\d]/g, "");
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function BiensRecoCards({ entities }: { entities: LandingEntities }) {
  const [items, setItems] = useState<Bien[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ limit: "3" });
    if (entities.ville) params.set("ville", entities.ville);
    const typeKey = entities.type?.toLowerCase();
    if (typeKey && TYPE_MAP[typeKey]) params.set("type", TYPE_MAP[typeKey]);
    const max = parseBudget(entities.budget);
    if (max) params.set("prix_max", String(max));

    setLoading(true);
    fetch(`${API}/marketplace/biens?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : { items: [], total: 0 }))
      .then((data) => {
        if (!alive) return;
        setItems((data.items ?? []).slice(0, 3));
        setTotal(data.total ?? 0);
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [entities.ville, entities.type, entities.budget]);

  if (loading) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <Home size={14} style={{ color: C.prussian }} />
          <span>Recherche en cours…</span>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <Home size={14} style={{ color: C.prussian }} />
          <span>Aucun bien ne correspond encore</span>
        </div>
        <p style={{ margin: "8px 0 12px", fontSize: 13, color: C.text, lineHeight: 1.5 }}>
          Élargissez votre recherche sur la marketplace complète.
        </p>
        <Link href="/biens?source=landing_chat" style={ctaLink}>
          Voir tous les biens <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <Home size={14} style={{ color: C.prussian }} />
        <span>
          {total} bien{total > 1 ? "s" : ""} correspondant{total > 1 ? "s" : ""}
          {entities.ville ? ` à ${entities.ville}` : ""}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {items.map((b) => (
          <Link
            key={b.id}
            href={`/biens/${b.id}?source=landing_chat`}
            style={cardStyle}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 10,
                background: b.cover ? `url(${b.cover}) center/cover` : C.glacier,
                flexShrink: 0,
                border: `1px solid ${C.border}`,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: sans,
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {b.titre}
              </div>
              <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>
                {[
                  b.pieces ? `${b.pieces} pièces` : null,
                  b.surface ? `${b.surface} m²` : null,
                  b.ville,
                ].filter(Boolean).join(" · ")}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.prussian, marginTop: 2 }}>
                {b.prix ? `CHF ${Math.round(b.prix).toLocaleString("fr-CH")}` : "Sur demande"}
              </div>
            </div>
            <ArrowRight size={14} style={{ color: C.text3, flexShrink: 0 }} />
          </Link>
        ))}
      </div>

      {total > 3 && (
        <Link
          href={`/biens?source=landing_chat${entities.ville ? `&ville=${encodeURIComponent(entities.ville)}` : ""}`}
          style={{ ...ctaLink, marginTop: 10 }}
        >
          Voir les {total} biens <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  marginTop: 8,
  padding: 14,
  borderRadius: 14,
  background: "#fff",
  border: `1px solid ${C.border}`,
  boxShadow: "0 1px 2px rgba(15,46,76,0.06)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontFamily: sans,
  fontSize: 12,
  fontWeight: 600,
  color: C.text2,
  letterSpacing: "0.02em",
};

const cardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 8,
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: C.glacier,
  textDecoration: "none",
  transition: "background 0.15s, border-color 0.15s",
};

const ctaLink: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontFamily: sans,
  fontSize: 12,
  fontWeight: 600,
  color: C.prussian,
  textDecoration: "none",
};
