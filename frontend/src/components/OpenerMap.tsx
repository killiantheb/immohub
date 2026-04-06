"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, Circle, Popup, TileLayer, useMap } from "react-leaflet";
import { useNearbyOpeners } from "@/lib/hooks/useOpeners";
import type { MissionType, OpenerWithDistance } from "@/lib/types";

// Fix Leaflet default icon missing in Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const propertyIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
  iconAnchor: [7, 7],
});

const openerIcon = (available: boolean) =>
  L.divIcon({
    className: "",
    html: `<div style="width:10px;height:10px;border-radius:50%;background:${available ? "#16a34a" : "#9ca3af"};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>`,
    iconAnchor: [5, 5],
  });

// Recenter map when center prop changes
function RecenterView({ center }: { center: [number, number] }) {
  const map = useMap();
  const prev = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!prev.current || prev.current[0] !== center[0] || prev.current[1] !== center[1]) {
      map.setView(center);
      prev.current = center;
    }
  }, [center, map]);
  return null;
}

interface OpenerMapProps {
  center: [number, number];
  radiusKm: number;
  missionType: MissionType;
}

export default function OpenerMap({ center, radiusKm, missionType }: OpenerMapProps) {
  const { data: openers, isLoading } = useNearbyOpeners({
    lat: center[0],
    lng: center[1],
    radius_km: radiusKm,
    mission_type: missionType,
  });

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterView center={center} />

        {/* Property location */}
        <Marker position={center} icon={propertyIcon}>
          <Popup>Point de référence</Popup>
        </Marker>

        {/* Search radius */}
        <Circle
          center={center}
          radius={radiusKm * 1000}
          pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.05, weight: 1.5, dashArray: "6 4" }}
        />

        {/* Opener markers */}
        {openers?.map((opener: OpenerWithDistance) =>
          opener.latitude != null && opener.longitude != null ? (
            <Marker
              key={opener.id}
              position={[opener.latitude, opener.longitude]}
              icon={openerIcon(opener.is_available)}
            >
              <Popup>
                <div className="min-w-[160px] text-sm">
                  <p className="font-semibold">Ouvreur</p>
                  <p className="text-gray-500 text-xs mt-0.5">{opener.id.slice(0, 8)}…</p>
                  <div className="mt-2 space-y-0.5 text-xs text-gray-600">
                    <p>Distance : {opener.distance_km.toFixed(1)} km</p>
                    {opener.rating != null && <p>Note : ⭐ {opener.rating}</p>}
                    <p>Missions : {opener.total_missions}</p>
                    <p>Rayon : {opener.radius_km ?? "?"} km</p>
                  </div>
                  <p className={`mt-2 text-xs font-medium ${opener.is_available ? "text-green-600" : "text-gray-400"}`}>
                    {opener.is_available ? "Disponible" : "Non disponible"}
                  </p>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-[1000]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] rounded-lg bg-white/90 shadow p-3 text-xs space-y-1.5">
        <p className="font-semibold text-gray-700 mb-1">Légende</p>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-blue-600 border-2 border-white shadow" />
          <span className="text-gray-600">Bien sélectionné</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600 border-2 border-white shadow" />
          <span className="text-gray-600">Ouvreur disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-400 border-2 border-white shadow" />
          <span className="text-gray-600">Ouvreur non disponible</span>
        </div>
      </div>

      {openers && (
        <div className="absolute top-4 right-4 z-[1000] rounded-lg bg-white/90 shadow px-3 py-2 text-xs text-gray-600">
          {openers.length} ouvreur{openers.length !== 1 ? "s" : ""} dans la zone
        </div>
      )}
    </div>
  );
}
