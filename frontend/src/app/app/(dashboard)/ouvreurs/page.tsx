"use client";

import { useState, useMemo } from "react";
import { Search, Shield, Star, Users, Map } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AlthyMap, type AlthyMapMarker } from "@/components/map/AlthyMap";

// Coordonnées par canton/ville pour les ouvreurs
const CITY_COORDS: Record<string, [number, number]> = {
  "ge": [6.143, 46.204], "vd": [6.632, 46.519], "vs": [7.359, 46.233],
  "fr": [7.161, 46.806], "ne": [6.931, 46.992], "ju": [7.343, 47.362],
  "be": [7.447, 46.948], "zh": [8.541, 47.376], "bs": [7.589, 47.560],
};

const S = {
  bg:       "var(--cream)",
  surface:  "var(--background-card)",
  surface2: "var(--althy-surface-2)",
  border:   "var(--border-subtle)",
  text:     "var(--charcoal)",
  text2:    "var(--text-secondary)",
  text3:    "var(--text-tertiary)",
  orange:   "var(--terracotta-primary)",
  orangeBg: "var(--althy-orange-bg)",
  green:    "var(--althy-green)",
  greenBg:  "var(--althy-green-bg)",
  shadow:   "var(--althy-shadow)",
  shadowMd: "var(--althy-shadow-md)",
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Ouvreur {
  acteur_id:     string;
  prenom:        string;
  nom:           string;
  role:          string;
  photo_url:     string | null;
  note_moyenne:  number;
  nombre_notes:  number;
  badge_verifie: boolean;
  specialites:   string[];
  rayon_km:      number | null;
}

// ── Star display ──────────────────────────────────────────────────────────────

function Stars({ note, nb }: { note: number; nb: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ display: "flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <Star
            key={n}
            size={13}
            fill={note >= n ? S.orange : "none"}
            color={note >= n - 0.5 ? S.orange : S.border}
            strokeWidth={1.5}
          />
        ))}
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: S.text }}>{note > 0 ? note.toFixed(1) : "—"}</span>
      <span style={{ fontSize: 11, color: S.text3 }}>({nb} avis)</span>
    </div>
  );
}

// ── Ouvreur card ──────────────────────────────────────────────────────────────

function OuvreurCard({ o }: { o: Ouvreur }) {
  const initials = `${o.prenom?.[0] ?? ""}${o.nom?.[0] ?? ""}`.toUpperCase();

  return (
    <div
      style={{
        background: S.surface,
        border: `1px solid ${S.border}`,
        borderRadius: 16,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: S.shadow,
        transition: "box-shadow 0.18s, border-color 0.18s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = S.shadowMd;
        (e.currentTarget as HTMLDivElement).style.borderColor = S.orange;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = S.shadow;
        (e.currentTarget as HTMLDivElement).style.borderColor = S.border;
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {o.photo_url ? (
          <img src={o.photo_url} alt={o.prenom} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: S.orangeBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: S.orange, flexShrink: 0 }}>
            {initials}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: S.text }}>{o.prenom} {o.nom}</span>
            {o.badge_verifie && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 7px", borderRadius: 20, background: S.greenBg, color: S.green, fontSize: 10, fontWeight: 700 }}>
                <Shield size={9} strokeWidth={2.5} /> Vérifié Althy
              </span>
            )}
          </div>
          {o.rayon_km && (
            <span style={{ fontSize: 11, color: S.text3 }}>Zone d'intervention {o.rayon_km} km</span>
          )}
        </div>
      </div>

      {/* Types de missions */}
      {o.specialites.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {o.specialites.slice(0, 4).map(s => (
            <span key={s} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: S.surface2, color: S.text2, border: `1px solid ${S.border}` }}>
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Étoiles + avis */}
      <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 10 }}>
        {o.nombre_notes > 0 ? (
          <Stars note={o.note_moyenne} nb={o.nombre_notes} />
        ) : (
          <span style={{ fontSize: 11, color: S.text3 }}>Pas encore d'avis</span>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const CANTONS_CH = ["GE","VD","VS","FR","BE","ZH","BS","BL","AG","SO","TI","NE","JU"];

export default function OuvreursPage() {
  const [search,     setSearch]     = useState("");
  const [canton,     setCanton]     = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMap,    setShowMap]    = useState(true);

  const { data: ouvreurs = [], isLoading } = useQuery<Ouvreur[]>({
    queryKey: ["ouvreurs-classement", canton],
    queryFn: () => {
      const params: Record<string, string> = { role: "opener" };
      if (canton) params.canton = canton;
      return api.get("/notations/classement", { params }).then(r => r.data);
    },
    staleTime: 60_000,
    retry: false,
  });

  const filtered = ouvreurs.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.prenom?.toLowerCase().includes(q) ||
      o.nom?.toLowerCase().includes(q)
    );
  });

  // Markers carte — position par canton
  const mapMarkers = useMemo<AlthyMapMarker[]>(() => {
    return filtered
      .map((o, idx) => {
        const cantonKey = canton.toLowerCase() || "vd";
        const base = CITY_COORDS[cantonKey] ?? CITY_COORDS["vd"];
        // léger offset pour éviter la superposition
        const offset = idx * 0.015;
        return {
          id:       o.acteur_id,
          lng:      base[0] + (idx % 3 - 1) * 0.06 + offset,
          lat:      base[1] + Math.floor(idx / 3) * 0.04,
          label:    `${o.prenom} ${o.nom[0]}.`,
          sublabel: o.specialites[0] ?? "Ouvreur",
        };
      });
  }, [filtered, canton]);

  return (
    <div style={{ padding: "28px 24px", maxWidth: "100%", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: S.text, letterSpacing: "-0.02em" }}>
            Ouvreurs
          </h1>
          <p style={{ margin: 0, color: S.text3, fontSize: 13.5 }}>
            Classés par note · Visites et états des lieux · Vérifiés par Althy
          </p>
        </div>
        <button
          onClick={() => setShowMap(v => !v)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 16px", borderRadius: 10,
            background: showMap ? S.orangeBg : S.surface,
            color: showMap ? S.orange : S.text3,
            border: `1px solid ${showMap ? S.orange : S.border}`,
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          <Map size={14} /> Carte
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: S.text3, pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un ouvreur…"
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 13, background: S.surface, color: S.text, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        <select
          value={canton}
          onChange={e => setCanton(e.target.value)}
          style={{ padding: "9px 12px", border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 13, background: S.surface, color: S.text, outline: "none", fontFamily: "inherit" }}
        >
          <option value="">Tous cantons</option>
          {CANTONS_CH.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Layout split */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* Liste */}
        <div style={{ flex: showMap ? "0 0 420px" : "1 1 100%", minWidth: 0, maxHeight: showMap ? "calc(100vh - 250px)" : "none", overflowY: showMap ? "auto" : "visible" }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: S.text3, fontSize: 14 }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <Users size={36} color={S.border} style={{ marginBottom: 12 }} />
              <p style={{ margin: "8px 0 0", color: S.text3, fontSize: 14 }}>
                {ouvreurs.length === 0
                  ? "Aucun ouvreur noté pour le moment. Les ouvreurs apparaissent ici après leur première mission."
                  : "Aucun ouvreur ne correspond à votre recherche."}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {filtered.map(o => <OuvreurCard key={o.acteur_id} o={o} />)}
            </div>
          )}
        </div>

        {/* Carte sticky */}
        {showMap && (
          <div style={{
            flex: "1 1 0",
            position: "sticky",
            top: 20,
            height: "calc(100vh - 250px)",
            borderRadius: 16,
            overflow: "hidden",
            border: `1px solid ${S.border}`,
            boxShadow: "0 2px 16px rgba(26,22,18,0.07)",
          }}>
            <AlthyMap
              markers={mapMarkers}
              selectedId={selectedId}
              onMarkerClick={id => setSelectedId(id)}
              height="100%"
            />
          </div>
        )}
      </div>
    </div>
  );
}
