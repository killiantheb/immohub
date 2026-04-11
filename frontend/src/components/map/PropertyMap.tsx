"use client";

/**
 * PropertyMap — carte fiche bien.
 *
 * - Géocode automatiquement l'adresse prop
 * - Marker draggable pour ajustement précis (lat/lng sauvegardé)
 * - Couche POI (transports, écoles, commerces) via Overpass API
 * - Slider rayon POI : 500m / 1km / 2km
 * - Zoom par défaut niveau quartier (15)
 */

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { geocodeSingle } from "@/hooks/useNominatim";

// ── Tiles ──────────────────────────────────────────────────────────────────────
const CARTO_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// ── Icons ─────────────────────────────────────────────────────────────────────
const propertyPin = L.divIcon({
  className: "",
  html: `<svg width="36" height="45" viewBox="0 0 36 45" xmlns="http://www.w3.org/2000/svg">
    <filter id="ps"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.25"/></filter>
    <path filter="url(#ps)" d="M18 1C10.8 1 5 6.8 5 14c0 10.3 13 30 13 30S31 24.3 31 14C31 6.8 25.2 1 18 1z" fill="#E8602C" stroke="white" stroke-width="1.5"/>
    <path d="M13 17l5-5 5 5v7h-4v-4h-2v4h-4z" fill="white"/>
  </svg>`,
  iconSize: [36, 45],
  iconAnchor: [18, 45],
  popupAnchor: [0, -45],
});

// ── POI category styles ────────────────────────────────────────────────────────
const POI_STYLES: Record<string, { color: string; label: string }> = {
  bus_stop:     { color: "#2563EB", label: "Bus" },
  tram_stop:    { color: "#7C3AED", label: "Tram" },
  subway:       { color: "#DB2777", label: "Métro" },
  train:        { color: "#1D4ED8", label: "Gare" },
  school:       { color: "#D97706", label: "École" },
  supermarket:  { color: "#16A34A", label: "Supermarché" },
  convenience:  { color: "#15803D", label: "Commerce" },
  pharmacy:     { color: "#DC2626", label: "Pharmacie" },
  restaurant:   { color: "#EA580C", label: "Restaurant" },
  cafe:         { color: "#92400E", label: "Café" },
};

interface POIFeature {
  id: number;
  lat: number;
  lon: number;
  type: string;
  tags: Record<string, string>;
}

async function fetchPOI(lat: number, lng: number, radiusM: number): Promise<POIFeature[]> {
  const query = `[out:json][timeout:15];
(
  node["public_transport"="stop_position"](around:${radiusM},${lat},${lng});
  node["highway"="bus_stop"](around:${radiusM},${lat},${lng});
  node["railway"="tram_stop"](around:${radiusM},${lat},${lng});
  node["railway"="subway_entrance"](around:${radiusM},${lat},${lng});
  node["railway"="station"](around:${radiusM},${lat},${lng});
  node["amenity"="school"](around:${radiusM},${lat},${lng});
  node["shop"="supermarket"](around:${radiusM},${lat},${lng});
  node["shop"="convenience"](around:${radiusM},${lat},${lng});
  node["amenity"="pharmacy"](around:${radiusM},${lat},${lng});
);
out body;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const data = await res.json();
    return (data.elements ?? []).map((el: Record<string, unknown>) => {
      const tags = (el.tags as Record<string, string>) ?? {};
      let type = "other";
      if (tags["highway"] === "bus_stop" || tags["public_transport"] === "stop_position") type = "bus_stop";
      else if (tags["railway"] === "tram_stop") type = "tram_stop";
      else if (tags["railway"] === "subway_entrance") type = "subway";
      else if (tags["railway"] === "station") type = "train";
      else if (tags["amenity"] === "school") type = "school";
      else if (tags["shop"] === "supermarket") type = "supermarket";
      else if (tags["shop"] === "convenience") type = "convenience";
      else if (tags["amenity"] === "pharmacy") type = "pharmacy";
      return { id: el.id as number, lat: el.lat as number, lon: el.lon as number, type, tags };
    });
  } catch {
    return [];
  }
}

// ── Internal: fly to position ──────────────────────────────────────────────────
function FlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  const prev = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!prev.current || prev.current[0] !== center[0] || prev.current[1] !== center[1]) {
      map.setView(center, 15);
      prev.current = center;
    }
  }, [center, map]);
  return null;
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface PropertyMapProps {
  address?: string;
  initialLat?: number;
  initialLng?: number;
  onPositionChange?: (lat: number, lng: number) => void;
  readOnly?: boolean;
  height?: number;
  showPOI?: boolean;
}

const POI_RADIUS_OPTIONS = [
  { label: "500m", value: 500 },
  { label: "1km",  value: 1000 },
  { label: "2km",  value: 2000 },
];

export default function PropertyMap({
  address,
  initialLat,
  initialLng,
  onPositionChange,
  readOnly = false,
  height = 320,
  showPOI = true,
}: PropertyMapProps) {
  const defaultCenter: [number, number] = [initialLat ?? 46.2044, initialLng ?? 6.1432];
  const [center, setCenter] = useState<[number, number]>(defaultCenter);
  const [geocoding, setGeocoding] = useState(false);
  const [poi, setPOI] = useState<POIFeature[]>([]);
  const [poiRadius, setPoiRadius] = useState(500);
  const [poiFilter, setPoiFilter] = useState<Record<string, boolean>>({
    bus_stop: true, tram_stop: true, subway: true, train: true,
    school: true, supermarket: true, convenience: false, pharmacy: true,
  });
  const [loadingPOI, setLoadingPOI] = useState(false);
  const hasFetched = useRef<string>("");

  // Geocode address on mount / change.
  // Intentionally omits initialLat/initialLng/onPositionChange — we only want
  // to geocode when the address string itself changes, not when parent re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!address || (initialLat && initialLng)) return;
    setGeocoding(true);
    geocodeSingle(address).then(coords => {
      if (coords) { setCenter(coords); onPositionChange?.(coords[0], coords[1]); }
      setGeocoding(false);
    });
  }, [address]);

  // Fetch POI when center or radius changes
  useEffect(() => {
    if (!showPOI) return;
    const key = `${center[0].toFixed(4)},${center[1].toFixed(4)},${poiRadius}`;
    if (hasFetched.current === key) return;
    hasFetched.current = key;
    setLoadingPOI(true);
    fetchPOI(center[0], center[1], poiRadius).then(data => {
      setPOI(data);
      setLoadingPOI(false);
    });
  }, [center, poiRadius, showPOI]);

  const visiblePOI = poi.filter(p => poiFilter[p.type] !== false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Map */}
      <div style={{ height, borderRadius: 14, overflow: "hidden", border: "1px solid #E8E4DC", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", position: "relative" }}>
        <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer url={CARTO_TILES} attribution={CARTO_ATTR} maxZoom={19} />
          <FlyTo center={center} />

          {/* Property marker (draggable) */}
          <Marker
            position={center}
            icon={propertyPin}
            draggable={!readOnly}
            eventHandlers={{
              dragend: e => {
                const { lat, lng } = (e.target as L.Marker).getLatLng();
                setCenter([lat, lng]);
                onPositionChange?.(lat, lng);
              },
            }}
          >
            <Popup>
              <div style={{ fontSize: 12 }}>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>Votre bien</p>
                <p style={{ color: "#7A7469" }}>{address ?? `${center[0].toFixed(5)}, ${center[1].toFixed(5)}`}</p>
                {!readOnly && <p style={{ color: "#E8602C", marginTop: 4 }}>Glissez pour ajuster</p>}
              </div>
            </Popup>
          </Marker>

          {/* POI markers */}
          {visiblePOI.map(p => {
            const style = POI_STYLES[p.type] ?? { color: "#7A7469", label: "Autre" };
            return (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lon]}
                radius={6}
                pathOptions={{ color: style.color, fillColor: style.color, fillOpacity: 0.85, weight: 1.5 }}
              >
                <Popup>
                  <div style={{ fontSize: 12 }}>
                    <p style={{ fontWeight: 600, color: style.color }}>{style.label}</p>
                    <p style={{ color: "#7A7469", marginTop: 2 }}>{p.tags.name ?? "—"}</p>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Loading overlay */}
        {(geocoding || loadingPOI) && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
            <div style={{ padding: "8px 16px", background: "#fff", borderRadius: 10, fontSize: 12, color: "#7A7469", border: "1px solid #E8E4DC" }}>
              {geocoding ? "Géolocalisation…" : "Chargement POI…"}
            </div>
          </div>
        )}

        {!readOnly && (
          <div style={{ position: "absolute", bottom: 10, right: 10, zIndex: 999, background: "rgba(255,255,255,0.92)", borderRadius: 8, padding: "4px 8px", fontSize: 10, color: "#7A7469", pointerEvents: "none" }}>
            Glissez le marqueur pour ajuster
          </div>
        )}
      </div>

      {/* POI controls */}
      {showPOI && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {/* Radius picker */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#7A7469", textTransform: "uppercase" as const, letterSpacing: "0.06em", minWidth: 80 }}>Points d'intérêt</span>
            {POI_RADIUS_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setPoiRadius(o.value)} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${poiRadius === o.value ? "#E8602C" : "#E8E4DC"}`, background: poiRadius === o.value ? "#FAE4D6" : "#fff", color: poiRadius === o.value ? "#E8602C" : "#7A7469" }}>
                {o.label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {Object.entries(POI_STYLES).slice(0, 8).map(([key, { color, label }]) => {
              const active = poiFilter[key] !== false;
              return (
                <button key={key} onClick={() => setPoiFilter(prev => ({ ...prev, [key]: !active }))} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, cursor: "pointer", border: `1px solid ${active ? color : "#E8E4DC"}`, background: active ? `${color}18` : "#fff", color: active ? color : "#9CA3AF" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? color : "#D1D5DB", flexShrink: 0, display: "inline-block" }} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
