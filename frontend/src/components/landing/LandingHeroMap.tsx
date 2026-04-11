"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Search } from "lucide-react";

// ── Constantes ────────────────────────────────────────────────────────────────

const ORANGE = "#E8602C";
const ACTIVE_CANTONS = ["Genève", "Vaud", "Valais", "Fribourg", "Neuchâtel", "Jura"];

const ACTIVE_CITIES = [
  { lng: 6.143, lat: 46.204 }, // Genève
  { lng: 6.632, lat: 46.519 }, // Lausanne
  { lng: 7.161, lat: 46.806 }, // Fribourg
  { lng: 6.931, lat: 46.992 }, // Neuchâtel
  { lng: 7.359, lat: 46.233 }, // Sion
];

const INACTIVE_CITIES = [
  { lng: 7.447, lat: 46.948 }, // Berne
  { lng: 8.541, lat: 47.376 }, // Zürich
  { lng: 7.589, lat: 47.560 }, // Bâle
];

const CITY_FLYTO: Record<string, [number, number]> = {
  "genève": [6.143, 46.204], "geneve": [6.143, 46.204], "geneva": [6.143, 46.204],
  "lausanne": [6.632, 46.519],
  "fribourg": [7.161, 46.806],
  "neuchâtel": [6.931, 46.992], "neuchatel": [6.931, 46.992],
  "sion": [7.359, 46.233], "valais": [7.359, 46.233],
  "berne": [7.447, 46.948], "bern": [7.447, 46.948],
  "zürich": [8.541, 47.376], "zurich": [8.541, 47.376],
  "bâle": [7.589, 47.560], "bale": [7.589, 47.560], "basel": [7.589, 47.560],
  "nyon": [6.239, 46.383], "montreux": [6.911, 46.433], "morges": [6.499, 46.512],
  "vevey": [6.844, 46.461], "yverdon": [6.641, 46.778],
};

const MARKER_CSS = `
  .lhm-pin-active {
    position: relative; width: 28px; height: 28px;
  }
  .lhm-pin-active__pulse {
    position: absolute; inset: 0; border-radius: 50%;
    background: rgba(232,96,44,0.22);
    animation: lhm-ping 2.4s ease-out infinite;
  }
  .lhm-pin-active__dot {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%,-50%);
    width: 12px; height: 12px; border-radius: 50%;
    background: #E8602C; border: 2px solid #fff;
    box-shadow: 0 1px 8px rgba(232,96,44,0.45);
  }
  @keyframes lhm-ping {
    0%   { transform: scale(0.7); opacity: 0.7; }
    70%  { transform: scale(2.5); opacity: 0; }
    100% { transform: scale(0.7); opacity: 0; }
  }
  .lhm-pin-inactive {
    width: 18px; height: 18px;
    display: flex; align-items: center; justify-content: center;
  }
  .lhm-pin-inactive__dot {
    width: 9px; height: 9px; border-radius: 50%;
    background: #C4BAB0; border: 2px solid #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.10);
  }
`;

// ── Composant ─────────────────────────────────────────────────────────────────

export default function LandingHeroMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [query, setQuery] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [7.5, 46.8],
      zoom: 7.2,
      interactive: false,       // lecture seule sur la landing
      attributionControl: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      map.addSource("cantons", { type: "geojson", data: "/cantons-suisse.json" });

      map.addLayer({
        id: "cantons-fill",
        type: "fill",
        source: "cantons",
        filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
        paint: { "fill-color": ORANGE, "fill-opacity": 0.09 },
      });

      map.addLayer({
        id: "cantons-line",
        type: "line",
        source: "cantons",
        filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
        paint: { "line-color": ORANGE, "line-width": 1.5 },
      });

      ACTIVE_CITIES.forEach(city => {
        const el = document.createElement("div");
        el.className = "lhm-pin-active";
        el.innerHTML = `<div class="lhm-pin-active__pulse"></div><div class="lhm-pin-active__dot"></div>`;
        new mapboxgl.Marker({ element: el }).setLngLat([city.lng, city.lat]).addTo(map);
      });

      INACTIVE_CITIES.forEach(city => {
        const el = document.createElement("div");
        el.className = "lhm-pin-inactive";
        el.innerHTML = `<div class="lhm-pin-inactive__dot"></div>`;
        new mapboxgl.Marker({ element: el }).setLngLat([city.lng, city.lat]).addTo(map);
      });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const key = query.trim().toLowerCase();
    const coords = CITY_FLYTO[key];
    if (coords && mapRef.current) {
      setErr(false);
      mapRef.current.flyTo({ center: coords, zoom: 11, duration: 1600, essential: true });
    } else {
      setErr(true);
      setTimeout(() => setErr(false), 2000);
    }
  }, [query]);

  return (
    <>
      <style>{MARKER_CSS}</style>

      {/* Carte */}
      <div
        ref={containerRef}
        style={{
          height: 420,
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid rgba(26,22,18,0.07)",
          boxShadow: "0 8px 40px rgba(26,22,18,0.08)",
        }}
      />

      {/* Barre de recherche sous la carte */}
      <form
        onSubmit={handleSearch}
        style={{ marginTop: 14, position: "relative", maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}
      >
        <Search
          size={15}
          style={{
            position: "absolute", left: 14, top: "50%",
            transform: "translateY(-50%)",
            color: "#6B5E52", pointerEvents: "none",
          }}
        />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher une ville suisse…"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "11px 130px 11px 38px",
            borderRadius: 30,
            border: `1.5px solid ${err ? "#DC2626" : "rgba(26,22,18,0.12)"}`,
            background: "#fff",
            fontSize: 14, color: "#1A1612",
            outline: "none",
            boxShadow: "0 2px 12px rgba(26,22,18,0.05)",
            transition: "border-color 0.2s",
          }}
        />
        <button
          type="submit"
          style={{
            position: "absolute", right: 5, top: "50%",
            transform: "translateY(-50%)",
            padding: "6px 18px",
            borderRadius: 22,
            background: "#E8602C", color: "#fff",
            border: "none", fontSize: 13, fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Rechercher
        </button>
      </form>
    </>
  );
}
