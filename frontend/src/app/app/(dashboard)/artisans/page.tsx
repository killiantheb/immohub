"use client";

import { useState, useMemo } from "react";
import { Search, Shield, Star, Wrench, Map } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AlthyMap, type AlthyMapMarker } from "@/components/map/AlthyMap";
import { C } from "@/lib/design-tokens";

const CITY_COORDS: Record<string, [number, number]> = {
  "ge": [6.143, 46.204], "vd": [6.632, 46.519], "vs": [7.359, 46.233],
  "fr": [7.161, 46.806], "ne": [6.931, 46.992], "ju": [7.343, 47.362],
  "be": [7.447, 46.948], "zh": [8.541, 47.376], "bs": [7.589, 47.560],
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Artisan {
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
  assurance_rc:  boolean;
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
            fill={note >= n ? C.orange : "none"}
            color={note >= n - 0.5 ? C.orange : C.border}
            strokeWidth={1.5}
          />
        ))}
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{note > 0 ? note.toFixed(1) : "—"}</span>
      <span style={{ fontSize: 11, color: C.text3 }}>({nb} avis)</span>
    </div>
  );
}

// ── Artisan card ──────────────────────────────────────────────────────────────

function ArtisanCard({ a }: { a: Artisan }) {
  const initials = `${a.prenom?.[0] ?? ""}${a.nom?.[0] ?? ""}`.toUpperCase();

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: C.shadow,
        transition: "box-shadow 0.18s, border-color 0.18s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = C.shadowMd;
        (e.currentTarget as HTMLDivElement).style.borderColor = C.orange;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = C.shadow;
        (e.currentTarget as HTMLDivElement).style.borderColor = C.border;
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {a.photo_url ? (
          <img src={a.photo_url} alt={a.prenom} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.orangeBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: C.orange, flexShrink: 0 }}>
            {initials}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{a.prenom} {a.nom}</span>
            {a.badge_verifie && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 7px", borderRadius: 20, background: C.greenBg, color: C.green, fontSize: 10, fontWeight: 700 }}>
                <Shield size={9} strokeWidth={2.5} /> Vérifié Althy
              </span>
            )}
          </div>
          {a.rayon_km && (
            <span style={{ fontSize: 11, color: C.text3 }}>Rayon {a.rayon_km} km</span>
          )}
        </div>
        {a.assurance_rc && (
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--althy-blue)", background: "rgba(59,130,246,0.08)", padding: "2px 7px", borderRadius: 6, whiteSpace: "nowrap", flexShrink: 0 }}>
            RC Pro
          </span>
        )}
      </div>

      {/* Spécialités */}
      {a.specialites.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {a.specialites.slice(0, 4).map(s => (
            <span key={s} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: C.surface2, color: C.text2, border: `1px solid ${C.border}` }}>
              {s}
            </span>
          ))}
          {a.specialites.length > 4 && (
            <span style={{ fontSize: 11, color: C.text3 }}>+{a.specialites.length - 4}</span>
          )}
        </div>
      )}

      {/* Étoiles + avis */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        {a.nombre_notes > 0 ? (
          <Stars note={a.note_moyenne} nb={a.nombre_notes} />
        ) : (
          <span style={{ fontSize: 11, color: C.text3 }}>Pas encore d'avis</span>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const SPECIALITES_COURANTES = [
  "plomberie", "électricité", "peinture", "chauffage",
  "menuiserie", "toiture", "carrelage", "jardinage",
];

const CANTONS_CH = ["GE","VD","VS","FR","BE","ZH","BS","BL","AG","SO","TI","NE","JU"];

export default function ArtisansPage() {
  const [search,     setSearch]     = useState("");
  const [canton,     setCanton]     = useState("");
  const [specialite, setSpecialite] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMap,    setShowMap]    = useState(true);

  const { data: artisans = [], isLoading } = useQuery<Artisan[]>({
    queryKey: ["artisans-classement", canton, specialite],
    queryFn: () => {
      const params: Record<string, string> = { role: "artisan" };
      if (canton)     params.canton    = canton;
      if (specialite) params.specialite = specialite;
      return api.get("/notations/classement", { params }).then(r => r.data);
    },
    staleTime: 60_000,
    retry: false,
  });

  const filtered = artisans.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.prenom?.toLowerCase().includes(q) ||
      a.nom?.toLowerCase().includes(q) ||
      a.specialites.some(s => s.toLowerCase().includes(q))
    );
  });

  const mapMarkers = useMemo<AlthyMapMarker[]>(() => {
    return filtered.map((a, idx) => {
      const cantonKey = canton.toLowerCase() || "vd";
      const base = CITY_COORDS[cantonKey] ?? CITY_COORDS["vd"];
      return {
        id:       a.acteur_id,
        lng:      base[0] + (idx % 3 - 1) * 0.06,
        lat:      base[1] + Math.floor(idx / 3) * 0.04,
        label:    `${a.prenom} ${a.nom[0]}.`,
        sublabel: a.specialites[0] ?? "Artisan",
      };
    });
  }, [filtered, canton]);

  return (
    <div style={{ padding: "28px 24px", maxWidth: "100%", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>
            Artisans
          </h1>
          <p style={{ margin: 0, color: C.text3, fontSize: 13.5 }}>
            Classés par note · Vérifiés par Althy · Assurance RC Pro
          </p>
        </div>
        <button
          onClick={() => setShowMap(v => !v)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 16px", borderRadius: 10,
            background: showMap ? C.orangeBg : C.surface,
            color: showMap ? C.orange : C.text3,
            border: `1px solid ${showMap ? C.orange : C.border}`,
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          <Map size={14} /> Carte
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.text3, pointerEvents: "none" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un artisan…"
            style={{ width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, background: C.surface, color: C.text, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          />
        </div>

        <select
          value={canton}
          onChange={e => setCanton(e.target.value)}
          style={{ padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, background: C.surface, color: C.text, outline: "none", fontFamily: "inherit" }}
        >
          <option value="">Tous cantons</option>
          {CANTONS_CH.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={specialite}
          onChange={e => setSpecialite(e.target.value)}
          style={{ padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, background: C.surface, color: C.text, outline: "none", fontFamily: "inherit" }}
        >
          <option value="">Toutes spécialités</option>
          {SPECIALITES_COURANTES.map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Layout split */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* Liste */}
        <div style={{ flex: showMap ? "0 0 420px" : "1 1 100%", minWidth: 0, maxHeight: showMap ? "calc(100vh - 260px)" : "none", overflowY: showMap ? "auto" : "visible" }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: C.text3, fontSize: 14 }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <Wrench size={36} color={C.border} style={{ marginBottom: 12 }} />
              <p style={{ margin: "8px 0 0", color: C.text3, fontSize: 14 }}>
                {artisans.length === 0
                  ? "Aucun artisan noté pour le moment. Les artisans apparaissent ici après leur première mission."
                  : "Aucun artisan ne correspond à votre recherche."}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {filtered.map(a => <ArtisanCard key={a.acteur_id} a={a} />)}
            </div>
          )}
        </div>

        {/* Carte sticky */}
        {showMap && (
          <div style={{
            flex: "1 1 0",
            position: "sticky",
            top: 20,
            height: "calc(100vh - 260px)",
            borderRadius: 16,
            overflow: "hidden",
            border: `1px solid ${C.border}`,
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
