"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Building2, Home, MapPin, Search } from "lucide-react";
import { useProperties } from "@/lib/hooks/useProperties";
import type { Property } from "@/lib/types";

// ── Design tokens ─────────────────────────────────────────────────────────────

const S = {
  orange:   "var(--althy-orange)",
  orangeBg: "var(--althy-orange-bg, rgba(232,96,44,0.08))",
  surface:  "var(--althy-surface)",
  border:   "var(--althy-border)",
  text:     "var(--althy-text)",
  text3:    "var(--althy-text-3)",
  greenBg:  "var(--althy-green-bg, #EBF4E8)",
  green:    "var(--althy-green, #2E5E22)",
  blueBg:   "var(--althy-blue-bg, #EFF6FF)",
  blue:     "var(--althy-blue, #1D4ED8)",
  amberBg:  "var(--althy-amber-bg, #FEF3C7)",
  amber:    "var(--althy-amber, #B45309)",
  redBg:    "var(--althy-red-bg, #FDECEA)",
  red:      "var(--althy-red, #C0392B)",
};

const TYPE_LABEL: Record<string, string> = {
  appartement: "Appartement", maison: "Maison", studio: "Studio",
  villa: "Villa", commercial: "Commercial", garage: "Garage", autre: "Autre",
  apartment: "Appartement", house: "Maison", commercial_space: "Commercial",
};

const STATUT_MAP: Record<string, { label: string; bg: string; fg: string }> = {
  libre:     { label: "Libre",      bg: S.greenBg,  fg: S.green  },
  loue:      { label: "Loué",       bg: S.blueBg,   fg: S.blue   },
  a_vendre:  { label: "À vendre",   bg: S.amberBg,  fg: S.amber  },
  vendu:     { label: "Vendu",      bg: "var(--althy-border)", fg: S.text3 },
  renovation:{ label: "Rénovation", bg: S.redBg,    fg: S.red    },
  occupied:  { label: "Loué",       bg: S.blueBg,   fg: S.blue   },
  available: { label: "Libre",      bg: S.greenBg,  fg: S.green  },
  for_sale:  { label: "À vendre",   bg: S.amberBg,  fg: S.amber  },
};

function statutStyle(s?: string) {
  return s ? (STATUT_MAP[s] ?? { label: s, bg: "var(--althy-border)", fg: S.text3 }) : null;
}

// ── BienCard ──────────────────────────────────────────────────────────────────

function BienCard({ bien }: { bien: Property }) {
  const st = statutStyle(bien.statut ?? (bien as Record<string, unknown>).status as string);
  const cover = bien.images?.find(i => i.is_cover)?.url ?? bien.images?.[0]?.url;
  const adresse = bien.adresse ?? (bien as Record<string, unknown>).address as string ?? "";
  const ville = bien.ville ?? (bien as Record<string, unknown>).city as string ?? "";
  const surface = bien.surface_m2 ?? (bien as Record<string, unknown>).surface as number ?? null;
  const pieces = bien.nb_pieces ?? (bien as Record<string, unknown>).rooms as number ?? null;
  const loyer = bien.loyer_net ?? (bien as Record<string, unknown>).monthly_rent as number ?? null;

  return (
    <Link href={`/app/biens/${bien.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        style={{
          background: S.surface, borderRadius: 14,
          border: "1px solid var(--althy-border)",
          boxShadow: "0 1px 4px rgba(26,22,18,0.04)",
          overflow: "hidden", cursor: "pointer",
          transition: "box-shadow 0.18s, transform 0.18s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(26,22,18,0.1)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(26,22,18,0.04)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        }}
      >
        {/* Photo */}
        <div style={{ height: 140, background: "var(--althy-bg)", position: "relative", overflow: "hidden" }}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={adresse} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Home size={32} color="var(--althy-border)" />
            </div>
          )}
          {st && (
            <span style={{
              position: "absolute", top: 10, right: 10,
              padding: "3px 10px", borderRadius: 20,
              background: st.bg, color: st.fg,
              fontSize: 10, fontWeight: 700,
            }}>
              {st.label}
            </span>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "14px 16px" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: S.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {adresse || "Adresse non renseignée"}
          </p>
          {ville && (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: S.text3, display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={10} /> {ville}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {bien.type && <span style={{ fontSize: 11, color: S.text3 }}>{TYPE_LABEL[bien.type] ?? bien.type}</span>}
            {surface != null && <span style={{ fontSize: 11, color: S.text3 }}>· {surface} m²</span>}
            {pieces != null && <span style={{ fontSize: 11, color: S.text3 }}>· {pieces} p.</span>}
          </div>
          {loyer != null && (
            <p style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 700, color: S.orange }}>
              CHF {(loyer as number).toLocaleString("fr-CH")} / mois
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Filtre = "" | "libre" | "loue" | "a_vendre" | "renovation";

const FILTRES: { key: Filtre; label: string }[] = [
  { key: "",           label: "Tous"        },
  { key: "libre",      label: "Libres"      },
  { key: "loue",       label: "Loués"       },
  { key: "a_vendre",   label: "À vendre"    },
  { key: "renovation", label: "Rénovation"  },
];

export default function BiensPage() {
  const [filtre,  setFiltre]  = useState<Filtre>("");
  const [search,  setSearch]  = useState("");

  const { data, isLoading } = useProperties(filtre ? { statut: filtre } : {});

  // Support paginated { items } or flat array responses
  const biens: Property[] = Array.isArray(data)
    ? data
    : (data as { items?: Property[]; results?: Property[] } | undefined)?.items
      ?? (data as { items?: Property[]; results?: Property[] } | undefined)?.results
      ?? [];

  const filtered = biens.filter(b => {
    if (!search) return true;
    const addr  = ((b.adresse ?? (b as Record<string, unknown>).address as string) ?? "").toLowerCase();
    const ville = ((b.ville  ?? (b as Record<string, unknown>).city   as string) ?? "").toLowerCase();
    return addr.includes(search.toLowerCase()) || ville.includes(search.toLowerCase());
  });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Cormorant Garamond, serif", fontSize: 30, fontWeight: 300, color: S.text }}>
            Mes biens
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: S.text3 }}>
            {isLoading ? "Chargement…" : `${biens.length} bien${biens.length !== 1 ? "s" : ""} enregistré${biens.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/app/biens/nouveau"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, background: S.orange, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          <Plus size={14} /> Ajouter un bien
        </Link>
      </div>

      {/* ── Filters + Search ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTRES.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltre(f.key)}
              style={{
                padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                border: `1px solid ${filtre === f.key ? S.orange : "var(--althy-border)"}`,
                background: filtre === f.key ? S.orangeBg : S.surface,
                color: filtre === f.key ? S.orange : S.text3,
                fontSize: 12, fontWeight: 600,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: S.surface, border: "1px solid var(--althy-border)", borderRadius: 10, flex: 1, minWidth: 200 }}>
          <Search size={13} color="var(--althy-text-3)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par adresse ou ville…"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: S.text, fontFamily: "inherit" }}
          />
        </div>
      </div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 260, borderRadius: 14, background: "var(--althy-border)", opacity: 0.35 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: S.surface, border: "1px solid var(--althy-border)", borderRadius: 14, padding: "56px 24px", textAlign: "center" }}>
          <Building2 size={40} color="var(--althy-border)" style={{ margin: "0 auto 16px" }} />
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: S.text }}>
            {search ? "Aucun résultat" : "Aucun bien enregistré"}
          </h3>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: S.text3 }}>
            {search ? "Essayez un autre terme de recherche." : "Ajoutez votre premier bien pour commencer."}
          </p>
          {!search && (
            <Link href="/app/biens/nouveau" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 10, background: S.orange, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              <Plus size={14} /> Ajouter un bien
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filtered.map(b => <BienCard key={b.id} bien={b} />)}
        </div>
      )}
    </div>
  );
}
