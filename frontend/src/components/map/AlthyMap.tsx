"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";

// ── Constantes ────────────────────────────────────────────────────────────────

const ORANGE = "#E8602C";
const ACTIVE_CANTONS = ["Genève", "Vaud", "Valais", "Fribourg", "Neuchâtel", "Jura"];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AlthyMapMarker {
  id:        string;
  lng:       number;
  lat:       number;
  label:     string;   // texte principal du pin (ex: "CHF 2'200/mois" ou "Jean M.")
  sublabel?: string;   // texte secondaire optionnel
}

interface Props {
  markers:         AlthyMapMarker[];
  selectedId?:     string | null;
  onMarkerClick?:  (id: string | null) => void;
  height?:         string | number;
}

// ── CSS markers ───────────────────────────────────────────────────────────────

const MARKER_CSS = `
  .althy-map-pin {
    display: inline-flex;
    align-items: center;
    width: max-content;
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #1A1612;
    font-size: 11.5px;
    font-weight: 700;
    font-family: 'DM Sans', system-ui, sans-serif;
    padding: 4px 11px;
    border-radius: 20px;
    border: 1.5px solid rgba(255,255,255,0.65);
    box-shadow: 0 2px 10px rgba(0,0,0,0.13), inset 0 1px 0 rgba(255,255,255,0.5);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.18s ease;
    user-select: none;
    letter-spacing: 0.01em;
    position: relative;
  }
  .althy-map-pin::after {
    content: '';
    position: absolute;
    bottom: -6px; left: 50%;
    transform: translateX(-50%);
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid rgba(255,255,255,0.92);
  }
  .althy-map-pin:hover {
    background: rgba(232,96,44,0.90);
    color: #fff;
    border-color: rgba(255,255,255,0.3);
    transform: scale(1.07) translateY(-2px);
    box-shadow: 0 6px 18px rgba(232,96,44,0.38);
  }
  .althy-map-pin:hover::after { border-top-color: rgba(232,96,44,0.90); }
  .althy-map-pin.active {
    background: #E8602C;
    color: #fff;
    border-color: rgba(255,255,255,0.25);
    transform: scale(1.11) translateY(-3px);
    box-shadow: 0 8px 22px rgba(232,96,44,0.44);
  }
  .althy-map-pin.active::after { border-top-color: #E8602C; }
`;

// ── Composant ─────────────────────────────────────────────────────────────────

export function AlthyMap({ markers, selectedId, onMarkerClick, height = "100%" }: Props) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<any>(null);
  const pinElsRef       = useRef<Map<string, HTMLElement>>(new Map());
  const markerObjsRef   = useRef<any[]>([]);  // instances mapboxgl.Marker pour cleanup
  const mapLoadedRef    = useRef(false);
  const [, forceUpdate] = useState(0); // pour trigger re-render après load

  // ── Sync selected ──────────────────────────────────────────────────────────
  useEffect(() => {
    pinElsRef.current.forEach((el, id) => {
      el.classList.toggle("active", id === selectedId);
    });
  }, [selectedId]);

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let map: any;
    let ro: ResizeObserver | null = null;

    (async () => {
      if (!containerRef.current) return;
      const mapboxgl = (await import("mapbox-gl")).default;
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

      map = new mapboxgl.Map({
        container:          containerRef.current,
        style:              "mapbox://styles/mapbox/standard",
        center:             [7.0, 46.6],
        zoom:               7.8,
        minZoom:            5.5,
        maxZoom:            16,
        pitch:              30,
        bearing:            -5,
        antialias:          true,
        attributionControl: false,
      });

      mapRef.current = map;
      ro = new ResizeObserver(() => map.resize());
      if (containerRef.current) ro.observe(containerRef.current);

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "bottom-right");

      map.on("load", () => {
        // Cantons romands
        map.addSource("cantons", { type: "geojson", data: "/cantons-suisse.json" });
        map.addLayer({
          id: "romande-fill", type: "fill", source: "cantons",
          filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
          paint: { "fill-color": ORANGE, "fill-opacity": 0.10 },
        });
        map.addLayer({
          id: "romande-border-glow", type: "line", source: "cantons",
          filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
          paint: { "line-color": ORANGE, "line-width": 8, "line-opacity": 0.18, "line-blur": 6 },
        });
        map.addLayer({
          id: "romande-border", type: "line", source: "cantons",
          filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
          paint: { "line-color": ORANGE, "line-width": 2, "line-opacity": 0.85 },
        });

        mapLoadedRef.current = true;
        forceUpdate(n => n + 1); // déclenche l'effet d'ajout des markers
      });

      map.on("click", () => {
        pinElsRef.current.forEach(el => el.classList.remove("active"));
        onMarkerClick?.(null);
      });
    })();

    return () => {
      ro?.disconnect();
      map?.remove();
      mapRef.current    = null;
      mapLoadedRef.current = false;
      pinElsRef.current.clear();
      markerObjsRef.current = [];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ajout/MAJ des markers quand la map est prête ou markers changent ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    // Supprimer les anciens
    markerObjsRef.current.forEach(m => m.remove());
    markerObjsRef.current = [];
    pinElsRef.current.clear();

    // Ajouter les nouveaux
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      markers.forEach(m => {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;width:max-content;";

        const pin = document.createElement("div");
        pin.className = "althy-map-pin";
        if (m.id === selectedId) pin.classList.add("active");

        pin.textContent = m.label;
        if (m.sublabel) {
          pin.title = m.sublabel;
        }

        pin.addEventListener("click", e => {
          e.stopPropagation();
          pinElsRef.current.forEach((el, id) => el.classList.toggle("active", id === m.id));
          onMarkerClick?.(m.id);
        });

        wrapper.appendChild(pin);
        pinElsRef.current.set(m.id, pin);

        const markerObj = new mapboxgl.Marker({ element: wrapper, anchor: "bottom" })
          .setLngLat([m.lng, m.lat])
          .addTo(map);
        markerObjsRef.current.push(markerObj);
      });
    })();
  }, [markers, selectedId, onMarkerClick]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{MARKER_CSS}</style>
      <div ref={containerRef} style={{ width: "100%", height }} />
    </>
  );
}
