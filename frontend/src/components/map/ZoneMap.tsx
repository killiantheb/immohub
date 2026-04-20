"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents,
} from "react-leaflet";
import { useNominatim } from "@/hooks/useNominatim";
import type { NominatimResult } from "@/hooks/useNominatim";

// ── Tiles ─────────────────────────────────────────────────────────────────────
const CARTO_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// ── Design tokens — Mapbox/Leaflet require hex, do not replace with CSS var ──
const PRUSSIAN = "#0F2E4C";
const PRUSSIAN_FILL = "#D6E0ED";
const PRUSSIAN_FILL_TEMP = "rgba(15,46,76,0.08)";
const PRUSSIAN_DASH_BORDER = "#0F2E4C";

// ── Custom icons ──────────────────────────────────────────────────────────────
function makePin(color: string, size = 36) {
  return L.divIcon({
    className: "",
    html: `<svg width="${size}" height="${Math.round(size * 1.25)}" viewBox="0 0 36 45" xmlns="http://www.w3.org/2000/svg">
      <filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25"/></filter>
      <path filter="url(#s)" d="M18 1C10.8 1 5 6.8 5 14c0 10.3 13 30 13 30S31 24.3 31 14C31 6.8 25.2 1 18 1z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="18" cy="14" r="5.5" fill="white"/>
    </svg>`,
    iconSize: [size, Math.round(size * 1.25)],
    iconAnchor: [size / 2, Math.round(size * 1.25)],
    popupAnchor: [0, -Math.round(size * 1.25)],
  });
}

const primaryPin = makePin(PRUSSIAN);
const tempPin = makePin("#7A7469", 28);

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ZoneLocation {
  lat: number;
  lng: number;
  address: string;
  radius_km: number;
}
export interface TempZone extends ZoneLocation {
  id: string;
  valid_from: string;
  valid_until: string;
}
export interface ZoneMapData {
  primary_location: ZoneLocation;
  temp_zones: TempZone[];
}

interface ZoneMapProps {
  mode?: "point" | "radius" | "polygon" | "search";
  initialCenter?: [number, number];
  initialRadius?: number;
  initialAddress?: string;
  onLocationChange?: (data: ZoneMapData) => void;
  readOnly?: boolean;
  height?: number;
  /** Pro tier: allows up to 3 zones */
  multiZone?: boolean;
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function RecenterView({ center }: { center: [number, number] }) {
  const map = useMap();
  const prev = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!prev.current || prev.current[0] !== center[0] || prev.current[1] !== center[1]) {
      map.flyTo(center, Math.max(map.getZoom(), 11), { duration: 0.8 });
      prev.current = center;
    }
  }, [center, map]);
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onMapClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

// ── Approximate communes count (Swiss density ~1 commune / 15 km²) ────────────
function estimateCommunes(radiusKm: number) {
  const area = Math.PI * radiusKm ** 2;
  return Math.max(1, Math.round(area / 15));
}

// ── Search Dropdown ───────────────────────────────────────────────────────────
interface SearchBarProps {
  placeholder: string;
  onSelect: (r: NominatimResult) => void;
}
function SearchBar({ placeholder, onSelect }: SearchBarProps) {
  const { search, results, loading, clear } = useNominatim();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={q}
          onChange={e => { setQ(e.target.value); search(e.target.value); setOpen(true); }}
          placeholder={placeholder}
          style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid #E8E4DC", fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff" }}
        />
        {loading && (
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#7A7469" }}>…</div>
        )}
      </div>
      {open && results.length > 0 && (
        <ul style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #E8E4DC", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 1000, listStyle: "none", padding: "4px 0", margin: 0, maxHeight: 220, overflowY: "auto" }}>
          {results.map(r => (
            <li key={r.place_id}>
              <button
                onClick={() => { onSelect(r); setQ(r.display_name.split(",").slice(0, 3).join(", ")); setOpen(false); clear(); }}
                style={{ width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#3D3830", lineHeight: 1.4 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#D6E0ED")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ZoneMap({
  mode = "radius",
  initialCenter = [46.2044, 6.1432],  // Genève
  initialRadius = 20,
  initialAddress = "",
  onLocationChange,
  readOnly = false,
  height = 360,
  multiZone = false,
}: ZoneMapProps) {
  const [center, setCenter] = useState<[number, number]>(initialCenter);
  const [address, setAddress] = useState(initialAddress);
  const [radius, setRadius] = useState(initialRadius);
  const [tempZones, setTempZones] = useState<TempZone[]>([]);
  const [showTempForm, setShowTempForm] = useState(false);
  const [tempDraft, setTempDraft] = useState({ address: "", lat: 0, lng: 0, radius_km: 10, valid_from: "", valid_until: "" });
  const [pendingTempSearch, setPendingTempSearch] = useState(false);
  const tempSearchRef = useRef<typeof import("@/hooks/useNominatim")["useNominatim"]>();

  // Extra zones (Pro multi-zone)
  const [extraZones, setExtraZones] = useState<Array<ZoneLocation & { id: string }>>([]);

  const notify = useCallback(() => {
    onLocationChange?.({
      primary_location: { lat: center[0], lng: center[1], address, radius_km: radius },
      temp_zones: tempZones,
    });
  }, [center, address, radius, tempZones, onLocationChange]);

  useEffect(() => { notify(); }, [notify]);

  function handleNominatimSelect(r: NominatimResult) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    setCenter([lat, lng]);
    setAddress(r.display_name);
  }

  function handleMapClick(lat: number, lng: number) {
    if (readOnly) return;
    setCenter([lat, lng]);
  }

  function addTempZone() {
    if (!tempDraft.lat && !tempDraft.lng) return;
    const zone: TempZone = {
      id: Date.now().toString(),
      lat: tempDraft.lat, lng: tempDraft.lng,
      address: tempDraft.address,
      radius_km: tempDraft.radius_km,
      valid_from: tempDraft.valid_from,
      valid_until: tempDraft.valid_until,
    };
    setTempZones(prev => [...prev, zone]);
    setTempDraft({ address: "", lat: 0, lng: 0, radius_km: 10, valid_from: "", valid_until: "" });
    setShowTempForm(false);
  }

  function removeTempZone(id: string) {
    setTempZones(prev => prev.filter(z => z.id !== id));
  }

  const communes = estimateCommunes(radius);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Search bar */}
      {!readOnly && (
        <SearchBar
          placeholder="Entrez votre adresse principale…"
          onSelect={handleNominatimSelect}
        />
      )}

      {/* Map */}
      <div style={{ height, borderRadius: 14, overflow: "hidden", border: "1px solid #E8E4DC", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", position: "relative" }}>
        <MapContainer
          center={initialCenter}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={!readOnly}
          zoomControl
        >
          <TileLayer url={CARTO_TILES} attribution={CARTO_ATTR} maxZoom={19} />
          <RecenterView center={center} />
          {!readOnly && <MapClickHandler onMapClick={handleMapClick} />}

          {/* Primary marker */}
          <Marker
            position={center}
            icon={primaryPin}
            draggable={!readOnly}
            eventHandlers={{
              dragend: e => {
                const pos = (e.target as L.Marker).getLatLng();
                setCenter([pos.lat, pos.lng]);
              },
            }}
          >
            <Popup>
              <div style={{ minWidth: 160, fontSize: 12 }}>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>Zone principale</p>
                <p style={{ color: "#7A7469" }}>Rayon : {radius} km</p>
                <p style={{ color: "#7A7469" }}>~{communes} communes</p>
              </div>
            </Popup>
          </Marker>

          {/* Primary radius circle */}
          {mode === "radius" && (
            <Circle
              center={center}
              radius={radius * 1000}
              pathOptions={{ color: PRUSSIAN, fillColor: PRUSSIAN_FILL, fillOpacity: 0.35, weight: 2 }}
            />
          )}

          {/* Temp zones */}
          {tempZones.map(z => (
            z.lat && z.lng ? (
              <React.Fragment key={z.id}>
                <Marker position={[z.lat, z.lng]} icon={tempPin}>
                  <Popup>
                    <div style={{ fontSize: 12 }}>
                      <p style={{ fontWeight: 700 }}>Zone temporaire</p>
                      <p style={{ color: "#7A7469" }}>{z.valid_from} → {z.valid_until}</p>
                      <p style={{ color: "#7A7469" }}>Rayon : {z.radius_km} km</p>
                    </div>
                  </Popup>
                </Marker>
                <Circle
                  center={[z.lat, z.lng]}
                  radius={z.radius_km * 1000}
                  pathOptions={{ color: PRUSSIAN_DASH_BORDER, fillColor: PRUSSIAN_FILL_TEMP, fillOpacity: 0.25, weight: 1.5, dashArray: "6 5" }}
                />
              </React.Fragment>
            ) : null
          ))}

          {/* Extra zones (multi-zone Pro) */}
          {extraZones.map(z => (
            <React.Fragment key={z.id}>
              <Marker position={[z.lat, z.lng]} icon={makePin("#7A7469", 30)}>
                <Popup><div style={{ fontSize: 12 }}><p style={{ fontWeight: 700 }}>Zone secondaire</p><p style={{ color: "#7A7469" }}>Rayon : {z.radius_km} km</p></div></Popup>
              </Marker>
              <Circle center={[z.lat, z.lng]} radius={z.radius_km * 1000} pathOptions={{ color: "#7A7469", fillColor: "#E8E4DC", fillOpacity: 0.25, weight: 1.5 }} />
            </React.Fragment>
          ))}
        </MapContainer>

        {/* Info badge (bottom-left) */}
        <div style={{ position: "absolute", bottom: 10, left: 10, zIndex: 999, background: "rgba(255,255,255,0.92)", borderRadius: 10, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: PRUSSIAN, backdropFilter: "blur(4px)", border: "1px solid #D6E0ED", pointerEvents: "none" }}>
          {radius} km · ~{communes} communes
        </div>
      </div>

      {/* Radius slider */}
      {mode === "radius" && !readOnly && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: "#7A7469" }}>Rayon d'intervention</label>
            <span style={{ fontSize: 12, fontWeight: 700, color: PRUSSIAN }}>{radius} km</span>
          </div>
          <input
            type="range" min={1} max={50} step={1} value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            style={{ width: "100%", accentColor: PRUSSIAN, cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#7A7469", marginTop: 2 }}>
            <span>1 km</span><span>50 km</span>
          </div>
        </div>
      )}

      {/* Temp zones list */}
      {tempZones.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tempZones.map(z => (
            <div key={z.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#FAFAF8", borderRadius: 10, border: "1px solid #E8E4DC", fontSize: 12 }}>
              <div>
                <span style={{ fontWeight: 600, color: "#3D3830" }}>{z.address.split(",")[0]}</span>
                <span style={{ color: "#7A7469", marginLeft: 8 }}>{z.valid_from} → {z.valid_until} · {z.radius_km} km</span>
              </div>
              {!readOnly && (
                <button onClick={() => removeTempZone(z.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#7A7469", padding: 2 }}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add temp zone */}
      {!readOnly && (
        <>
          {!showTempForm ? (
            <button
              onClick={() => setShowTempForm(true)}
              style={{ padding: "9px 14px", borderRadius: 10, background: "none", border: "1px dashed #0F2E4C", color: PRUSSIAN, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              + Ajouter une zone temporaire
            </button>
          ) : (
            <div style={{ padding: "1rem", background: "#FAFAF8", borderRadius: 12, border: "1px solid #E8E4DC", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#3D3830", marginBottom: 2 }}>Zone temporaire (ex: "Je serai à Lausanne du 15 au 20 avril")</p>
              <SearchBar
                placeholder="Ville ou adresse temporaire…"
                onSelect={r => setTempDraft(prev => ({ ...prev, lat: parseFloat(r.lat), lng: parseFloat(r.lon), address: r.display_name }))}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#7A7469", display: "block", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Du</label>
                  <input type="date" value={tempDraft.valid_from} onChange={e => setTempDraft(prev => ({ ...prev, valid_from: e.target.value }))} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #E8E4DC", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#7A7469", display: "block", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Au</label>
                  <input type="date" value={tempDraft.valid_until} onChange={e => setTempDraft(prev => ({ ...prev, valid_until: e.target.value }))} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #E8E4DC", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }} />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#7A7469", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Rayon</label>
                  <span style={{ fontSize: 12, fontWeight: 700, color: PRUSSIAN }}>{tempDraft.radius_km} km</span>
                </div>
                <input type="range" min={5} max={50} step={5} value={tempDraft.radius_km} onChange={e => setTempDraft(prev => ({ ...prev, radius_km: Number(e.target.value) }))} style={{ width: "100%", accentColor: PRUSSIAN }} />
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button onClick={addTempZone} disabled={!tempDraft.lat} style={{ flex: 1, padding: "9px", borderRadius: 10, background: tempDraft.lat ? PRUSSIAN : "#E8E4DC", border: "none", color: tempDraft.lat ? "#fff" : "#7A7469", fontSize: 13, fontWeight: 600, cursor: tempDraft.lat ? "pointer" : "not-allowed" }}>
                  Ajouter
                </button>
                <button onClick={() => setShowTempForm(false)} style={{ padding: "9px 14px", borderRadius: 10, background: "none", border: "1px solid #E8E4DC", color: "#7A7469", fontSize: 13, cursor: "pointer" }}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Multi-zone (Pro) */}
      {multiZone && !readOnly && extraZones.length < 2 && (
        <button
          onClick={() => {
            setExtraZones(prev => [...prev, { id: Date.now().toString(), lat: center[0] + 0.05, lng: center[1] + 0.05, address: "Zone secondaire", radius_km: 10 }]);
          }}
          style={{ padding: "9px 14px", borderRadius: 10, background: "none", border: "1px dashed #7A7469", color: "#7A7469", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          + Ajouter une zone secondaire (Pro)
        </button>
      )}
    </div>
  );
}

// Need React for JSX in Fragment
import React from "react";
