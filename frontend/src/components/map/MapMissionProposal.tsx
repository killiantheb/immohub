"use client";

/**
 * MapMissionProposal — matching opener pour une mission.
 *
 * - Marker terracotta = le bien (point de mission)
 * - Markers verts = openers disponibles à cette date
 * - Ligne pointillée = distance opener → bien
 * - Distance Haversine calculée côté frontend pour affichage immédiat
 * - Tri : par distance / par note / par tarif
 */

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Tiles ─────────────────────────────────────────────────────────────────────
const CARTO_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// ── Icons ─────────────────────────────────────────────────────────────────────
const missionPin = L.divIcon({
  className: "",
  html: `<svg width="36" height="45" viewBox="0 0 36 45" xmlns="http://www.w3.org/2000/svg">
    <filter id="ms"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/></filter>
    <path filter="url(#ms)" d="M18 1C10.8 1 5 6.8 5 14c0 10.3 13 30 13 30S31 24.3 31 14C31 6.8 25.2 1 18 1z" fill="#E8602C" stroke="white" stroke-width="1.5"/>
    <circle cx="18" cy="14" r="6" fill="white"/>
    <text x="18" y="18" text-anchor="middle" font-size="9" fill="#E8602C" font-weight="bold">M</text>
  </svg>`,
  iconSize: [36, 45],
  iconAnchor: [18, 45],
  popupAnchor: [0, -45],
});

function openerPin(available: boolean, rank: number) {
  const color = available ? "#16A34A" : "#9CA3AF";
  return L.divIcon({
    className: "",
    html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;">
      <span style="font-size:12px;font-weight:700;color:white">${rank}</span>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

// ── Haversine distance ─────────────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface OpenerCandidate {
  id: string;
  first_name?: string;
  rating?: number;
  radius_km: number;
  hourly_rate?: number;
  latitude: number;
  longitude: number;
  is_available: boolean;
  total_missions: number;
}

type SortKey = "distance" | "rating" | "tarif";

interface MapMissionProposalProps {
  missionLat: number;
  missionLng: number;
  missionAddress?: string;
  missionDate?: string;
  missionType?: string;
  radiusKm?: number;
  height?: number;
  onSelect?: (openerId: string) => void;
  selectedOpenerId?: string;
}

export default function MapMissionProposal({
  missionLat,
  missionLng,
  missionAddress,
  missionDate,
  missionType,
  radiusKm = 15,
  height = 400,
  onSelect,
  selectedOpenerId,
}: MapMissionProposalProps) {
  const [sortBy, setSortBy] = useState<SortKey>("distance");
  const center: [number, number] = [missionLat, missionLng];

  const { data, isLoading } = useQuery<{ items: OpenerCandidate[] }>({
    queryKey: ["openers-nearby", missionLat, missionLng, radiusKm, missionDate, missionType],
    queryFn: async () => {
      const { data } = await api.get("/openers", {
        params: { lat: missionLat, lng: missionLng, radius_km: radiusKm, mission_type: missionType },
      });
      return data;
    },
    staleTime: 30_000,
    retry: false,
  });

  const sorted = useMemo(() => {
    const openers = data?.items ?? [];
    const withDist = openers
      .filter(o => o.latitude && o.longitude)
      .map(o => ({ ...o, dist: haversine(missionLat, missionLng, o.latitude, o.longitude) }));

    if (sortBy === "distance") return withDist.sort((a, b) => a.dist - b.dist);
    if (sortBy === "rating") return withDist.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (sortBy === "tarif") return withDist.sort((a, b) => (a.hourly_rate ?? 999) - (b.hourly_rate ?? 999));
    return withDist;
  }, [data, sortBy, missionLat, missionLng]);

  // Show top 10 on map, highlight top 3 in list
  const mapOpeners = sorted.slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Sort controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#7A7469", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Trier par</span>
        {([["distance", "Distance"], ["rating", "Note"], ["tarif", "Tarif"]] as [SortKey, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setSortBy(k)} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${sortBy === k ? "#E8602C" : "#E8E4DC"}`, background: sortBy === k ? "#FAE4D6" : "#fff", color: sortBy === k ? "#E8602C" : "#7A7469" }}>
            {l}
          </button>
        ))}
      </div>

      {/* Map */}
      <div style={{ height, borderRadius: 14, overflow: "hidden", border: "1px solid #E8E4DC", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", position: "relative" }}>
        <MapContainer center={center} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer url={CARTO_TILES} attribution={CARTO_ATTR} maxZoom={19} />

          {/* Mission marker */}
          <Marker position={center} icon={missionPin}>
            <Popup>
              <div style={{ fontSize: 12 }}>
                <p style={{ fontWeight: 700, color: "#E8602C" }}>Point de mission</p>
                {missionAddress && <p style={{ color: "#7A7469", marginTop: 4 }}>{missionAddress}</p>}
                {missionDate && <p style={{ color: "#7A7469" }}>Le {missionDate}</p>}
              </div>
            </Popup>
          </Marker>

          {/* Opener markers + dashed lines */}
          {mapOpeners.map((o, idx) => (
            <React.Fragment key={o.id}>
              <Marker
                position={[o.latitude, o.longitude]}
                icon={openerPin(o.is_available, idx + 1)}
                eventHandlers={{ click: () => onSelect?.(o.id) }}
              >
                <Popup>
                  <div style={{ fontSize: 12, minWidth: 160 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <p style={{ fontWeight: 700, color: "#3D3830" }}>Ouvreur #{idx + 1}</p>
                      <span style={{ fontWeight: 700, color: o.is_available ? "#16A34A" : "#9CA3AF", fontSize: 11 }}>
                        {o.is_available ? "Disponible" : "Indisponible"}
                      </span>
                    </div>
                    <p style={{ color: "#7A7469" }}>Distance : <strong>{o.dist.toFixed(1)} km</strong></p>
                    {o.rating != null && <p style={{ color: "#7A7469" }}>Note : ⭐ {o.rating.toFixed(1)}</p>}
                    {o.hourly_rate && <p style={{ color: "#7A7469" }}>Tarif : CHF {o.hourly_rate}/h</p>}
                    <p style={{ color: "#7A7469" }}>Missions : {o.total_missions}</p>
                    {onSelect && (
                      <button onClick={() => onSelect(o.id)} style={{ marginTop: 8, width: "100%", padding: "6px 0", borderRadius: 8, background: "#E8602C", border: "none", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        Proposer la mission
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>

              {/* Dashed line: opener → mission */}
              <Polyline
                positions={[[o.latitude, o.longitude], center]}
                pathOptions={{
                  color: o.id === selectedOpenerId ? "#E8602C" : o.is_available ? "#16A34A" : "#D1D5DB",
                  weight: o.id === selectedOpenerId ? 2 : 1,
                  dashArray: "5 6",
                  opacity: o.id === selectedOpenerId ? 0.9 : 0.4,
                }}
              />
            </React.Fragment>
          ))}
        </MapContainer>

        {isLoading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
            <div style={{ padding: "10px 20px", background: "#fff", borderRadius: 10, fontSize: 12, color: "#7A7469", border: "1px solid #E8E4DC" }}>Recherche d'ouvreurs…</div>
          </div>
        )}

        {/* Legend */}
        <div style={{ position: "absolute", bottom: 10, left: 10, zIndex: 999, background: "rgba(255,255,255,0.92)", borderRadius: 10, padding: "8px 12px", fontSize: 11, backdropFilter: "blur(4px)", border: "1px solid #E8E4DC" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#E8602C", display: "inline-block" }} />
            <span style={{ color: "#3D3830" }}>Point de mission</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#16A34A", display: "inline-block" }} />
            <span style={{ color: "#3D3830" }}>Ouvreur disponible</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#9CA3AF", display: "inline-block" }} />
            <span style={{ color: "#3D3830" }}>Ouvreur indisponible</span>
          </div>
        </div>

        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 999, background: "rgba(255,255,255,0.92)", borderRadius: 10, padding: "5px 12px", fontSize: 11, fontWeight: 600, color: "#3D3830", backdropFilter: "blur(4px)", border: "1px solid #E8E4DC" }}>
          {sorted.length} ouvreur{sorted.length !== 1 ? "s" : ""} trouvé{sorted.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Top 3 list */}
      {sorted.slice(0, 3).map((o, idx) => (
        <button
          key={o.id}
          onClick={() => onSelect?.(o.id)}
          style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "12px 14px", borderRadius: 12, background: selectedOpenerId === o.id ? "#FAE4D6" : "#FAFAF8", border: `1.5px solid ${selectedOpenerId === o.id ? "#E8602C" : "#E8E4DC"}`, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
        >
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: o.is_available ? "#16A34A" : "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>#{idx + 1}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#3D3830", margin: 0 }}>{o.first_name ?? `Ouvreur ${o.id.slice(0, 6)}`}</p>
              {o.rating != null && <span style={{ fontSize: 12, color: "#D97706" }}>⭐ {o.rating.toFixed(1)}</span>}
            </div>
            <p style={{ fontSize: 11, color: "#7A7469", margin: "2px 0 0" }}>
              {o.dist.toFixed(1)} km · {o.total_missions} missions{o.hourly_rate ? ` · CHF ${o.hourly_rate}/h` : ""}
            </p>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: o.is_available ? "#16A34A" : "#9CA3AF" }}>
            {o.is_available ? "Disponible" : "Indispo."}
          </div>
        </button>
      ))}
    </div>
  );
}

import React from "react";
