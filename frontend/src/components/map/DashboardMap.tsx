"use client";

/**
 * DashboardMap — vue globale des biens (admin / agence).
 *
 * Markers colorés par statut :
 *   Vert  → loué + loyer reçu
 *   Orange → loué + loyer en attente
 *   Rouge  → vacant
 *   Bleu   → en vente
 *
 * Filtres en overlay. Click marker → popup avec actions rapides.
 */

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Tiles ─────────────────────────────────────────────────────────────────────
const CARTO_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// ── Status config ──────────────────────────────────────────────────────────────
type BienStatus = "loue_ok" | "loue_retard" | "vacant" | "vente";

const STATUS_CONFIG: Record<BienStatus, { color: string; label: string; dot: string }> = {
  loue_ok:     { color: "#16A34A", label: "Loué — loyer reçu",    dot: "#16A34A" },
  loue_retard: { color: "#D97706", label: "Loué — loyer en attente", dot: "#D97706" },
  vacant:      { color: "#DC2626", label: "Vacant",               dot: "#DC2626" },
  vente:       { color: "#2563EB", label: "En vente",             dot: "#2563EB" },
};

function makeStatusPin(status: BienStatus) {
  const { color } = STATUS_CONFIG[status];
  return L.divIcon({
    className: "",
    html: `<svg width="28" height="35" viewBox="0 0 28 35" xmlns="http://www.w3.org/2000/svg">
      <filter id="ds${status}"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.3"/></filter>
      <path filter="url(#ds${status})" d="M14 1C8.5 1 4 5.5 4 11c0 8 10 23 10 23S24 19 24 11C24 5.5 19.5 1 14 1z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="14" cy="11" r="4" fill="white"/>
    </svg>`,
    iconSize: [28, 35],
    iconAnchor: [14, 35],
    popupAnchor: [0, -35],
  });
}

// Cache icons
const PIN_CACHE: Partial<Record<BienStatus, L.DivIcon>> = {};
function getPin(status: BienStatus) {
  if (!PIN_CACHE[status]) PIN_CACHE[status] = makeStatusPin(status);
  return PIN_CACHE[status]!;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface BienGeo {
  id: string;
  nom: string;
  adresse: string;
  ville: string;
  lat: number;
  lng: number;
  status: BienStatus;
  loyer?: number;
  locataire?: string;
  type?: string;
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface DashboardMapProps {
  height?: number;
  onBienClick?: (id: string) => void;
}

export default function DashboardMap({ height = 500, onBienClick }: DashboardMapProps) {
  const [filters, setFilters] = useState<Record<BienStatus, boolean>>({
    loue_ok: true, loue_retard: true, vacant: true, vente: true,
  });
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<{ items: BienGeo[] }>({
    queryKey: ["biens-geo"],
    queryFn: async () => { const { data } = await api.get("/biens?with_geo=true"); return data; },
    staleTime: 60_000,
    retry: false,
  });

  const biens = useMemo(() => data?.items ?? [], [data]);

  // Default center: weighted average or Geneva
  const defaultCenter = useMemo((): [number, number] => {
    const geoItems = biens.filter(b => b.lat && b.lng);
    if (!geoItems.length) return [46.2044, 6.1432];
    const avgLat = geoItems.reduce((s, b) => s + b.lat, 0) / geoItems.length;
    const avgLng = geoItems.reduce((s, b) => s + b.lng, 0) / geoItems.length;
    return [avgLat, avgLng];
  }, [biens]);

  const visible = biens.filter(b =>
    b.lat && b.lng &&
    filters[b.status] &&
    (typeFilter === "all" || b.type === typeFilter)
  );

  const stats = {
    loue_ok:     biens.filter(b => b.status === "loue_ok").length,
    loue_retard: biens.filter(b => b.status === "loue_retard").length,
    vacant:      biens.filter(b => b.status === "vacant").length,
    vente:       biens.filter(b => b.status === "vente").length,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Filter bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        {(Object.entries(STATUS_CONFIG) as [BienStatus, typeof STATUS_CONFIG[BienStatus]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilters(prev => ({ ...prev, [key]: !prev[key] }))}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${filters[key] ? cfg.color : "#E8E4DC"}`, background: filters[key] ? `${cfg.color}18` : "#fff", color: filters[key] ? cfg.color : "#9CA3AF", transition: "all 0.15s" }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: filters[key] ? cfg.color : "#D1D5DB", flexShrink: 0, display: "inline-block" }} />
            {cfg.label}
            <span style={{ fontWeight: 700, background: filters[key] ? cfg.color : "#E8E4DC", color: filters[key] ? "#fff" : "#9CA3AF", borderRadius: 10, padding: "1px 6px", fontSize: 10 }}>
              {stats[key]}
            </span>
          </button>
        ))}
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: "5px 10px", borderRadius: 20, border: "1px solid #E8E4DC", fontSize: 12, background: "#fff", color: "#3D3830", cursor: "pointer", outline: "none" }}
        >
          <option value="all">Tous types</option>
          <option value="appartement">Appartement</option>
          <option value="maison">Maison</option>
          <option value="local">Local commercial</option>
          <option value="terrain">Terrain</option>
        </select>
      </div>

      {/* Map */}
      <div style={{ height, borderRadius: 14, overflow: "hidden", border: "1px solid #E8E4DC", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", position: "relative" }}>
        <MapContainer center={defaultCenter} zoom={10} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer url={CARTO_TILES} attribution={CARTO_ATTR} maxZoom={19} />

          {visible.map(b => (
            <Marker key={b.id} position={[b.lat, b.lng]} icon={getPin(b.status)}>
              <Popup maxWidth={240}>
                <div style={{ fontFamily: "inherit", minWidth: 180 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_CONFIG[b.status].color, flexShrink: 0, display: "inline-block" }} />
                    <p style={{ fontWeight: 700, fontSize: 13, color: "#3D3830", margin: 0 }}>{b.nom}</p>
                  </div>
                  <p style={{ fontSize: 11, color: "#7A7469", margin: "0 0 4px" }}>{b.adresse}, {b.ville}</p>
                  {b.loyer && <p style={{ fontSize: 12, color: "#0F2E4C", fontWeight: 600, margin: "4px 0" }}>CHF {b.loyer.toLocaleString("fr-CH")}/mois</p>}
                  {b.locataire && <p style={{ fontSize: 11, color: "#7A7469", margin: "2px 0" }}>Locataire : {b.locataire}</p>}
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button
                      onClick={() => onBienClick?.(b.id)}
                      style={{ flex: 1, padding: "6px 0", borderRadius: 8, background: "#0F2E4C", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      Voir la fiche
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {isLoading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
            <div style={{ padding: "10px 20px", background: "#fff", borderRadius: 10, fontSize: 13, color: "#7A7469", border: "1px solid #E8E4DC" }}>Chargement…</div>
          </div>
        )}

        {/* Counter badge */}
        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 999, background: "rgba(255,255,255,0.92)", borderRadius: 10, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "#3D3830", backdropFilter: "blur(4px)", border: "1px solid #E8E4DC" }}>
          {visible.length} / {biens.length} biens
        </div>
      </div>
    </div>
  );
}
