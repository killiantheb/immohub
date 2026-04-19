"use client";

import { useState } from "react";
import { Users, FileText, AlertCircle, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";

const S = {
  orange:   "var(--terracotta-primary)",
  orangeBg: "var(--althy-orange-bg, rgba(232,96,44,0.08))",
  surface:  "var(--background-card)",
  border:   "var(--border-subtle)",
  text:     "var(--charcoal)",
  text2:    "var(--text-secondary)",
  text3:    "var(--text-tertiary)",
  greenBg:  "var(--althy-green-bg)",
  green:    "var(--althy-green)",
  redBg:    "var(--althy-red-bg)",
  red:      "var(--althy-red)",
  amberBg:  "var(--althy-amber-bg)",
  amber:    "var(--althy-amber)",
} as const;

interface Locataire {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  bien_adresse?: string;
  bien_ville?: string;
  loyer_mensuel?: number;
  statut_loyer: "ok" | "retard" | "impaye";
  date_entree?: string;
}

const STATUT_STYLE = {
  ok:      { label: "Loyer à jour",  bg: S.greenBg, fg: S.green },
  retard:  { label: "En retard",     bg: S.amberBg, fg: S.amber },
  impaye:  { label: "Impayé",        bg: S.redBg,   fg: S.red   },
};

export default function LocatairePage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ items: Locataire[] }>({
    queryKey: ["locataires"],
    queryFn: async () => { const { data } = await api.get("/locataires"); return data; },
    staleTime: 30_000,
    retry: false,
  });

  const locataires = data?.items ?? [];
  const filtered = locataires.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${l.prenom} ${l.nom}`.toLowerCase().includes(q) ||
      (l.bien_adresse ?? "").toLowerCase().includes(q) ||
      (l.bien_ville ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Cormorant Garamond, serif", fontSize: 30, fontWeight: 300, color: S.text }}>
            Locataires
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: S.text3 }}>
            {isLoading ? "Chargement…" : `${locataires.length} locataire${locataires.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, marginBottom: 20 }}>
        <Users size={13} color="var(--text-tertiary)" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou adresse…"
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: S.text, fontFamily: "inherit" }}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 72, borderRadius: 12, background: "var(--border-subtle)", opacity: 0.3 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: "56px 24px", textAlign: "center" }}>
          <Users size={40} color="var(--border-subtle)" style={{ margin: "0 auto 16px" }} />
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: S.text }}>
            {search ? "Aucun résultat" : "Aucun locataire"}
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: S.text3 }}>
            {search ? "Essayez un autre terme." : "Vos locataires apparaîtront ici une fois vos biens loués."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(l => {
            const st = STATUT_STYLE[l.statut_loyer] ?? STATUT_STYLE.ok;
            return (
              <Link key={l.id} href={`/app/locataire/${l.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "box-shadow 0.15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(26,22,18,0.08)"}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = "none"}
                >
                  {/* Avatar */}
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: S.orangeBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: S.orange }}>
                      {l.prenom?.[0]}{l.nom?.[0]}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: S.text }}>
                      {l.prenom} {l.nom}
                    </p>
                    {l.bien_adresse && (
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: S.text3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {l.bien_adresse}{l.bien_ville ? `, ${l.bien_ville}` : ""}
                      </p>
                    )}
                  </div>

                  {/* Loyer */}
                  {l.loyer_mensuel != null && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: S.orange }}>
                        CHF {l.loyer_mensuel.toLocaleString("fr-CH")}
                      </p>
                      <p style={{ margin: 0, fontSize: 10, color: S.text3 }}>/ mois</p>
                    </div>
                  )}

                  {/* Statut */}
                  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: st.bg, color: st.fg, flexShrink: 0 }}>
                    {st.label}
                  </span>

                  <ChevronRight size={16} color="var(--text-tertiary)" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
