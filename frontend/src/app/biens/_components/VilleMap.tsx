"use client";

/**
 * Carte Mapbox interactive centrée sur une ville.
 * Composant client léger — isolé pour préserver le SSR du parent VillePageShared.
 */

import { useEffect, useRef } from "react";
import type mapboxgl from "mapbox-gl";

interface VilleMapProps {
  lng: number;
  lat: number;
  zoom: number;
  label: string;
}

export function VilleMap({ lng, lat, zoom, label }: VilleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    // Dynamic import pour éviter le bundle côté serveur
    import("mapbox-gl").then((mod) => {
      const mapboxgl = mod.default;
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/light-v11",
        center: [lng, lat],
        zoom,
        attributionControl: false,
        scrollZoom: false,
      });

      // Marqueur orange Althy avec animation ping
      const el = document.createElement("div");
      el.setAttribute("aria-label", label);
      el.style.cssText = [
        "width:18px",
        "height:18px",
        "background:#E8602C",
        "border:3px solid #fff",
        "border-radius:50%",
        "box-shadow:0 2px 8px rgba(0,0,0,.35)",
        "position:relative",
      ].join(";");

      const ping = document.createElement("div");
      ping.style.cssText = [
        "position:absolute",
        "inset:-6px",
        "border-radius:50%",
        "background:rgba(232,96,44,0.35)",
        "animation:ping-ville 1.8s cubic-bezier(0,0,.2,1) infinite",
      ].join(";");
      el.appendChild(ping);

      // Inject keyframes once
      if (!document.getElementById("ville-map-ping-style")) {
        const style = document.createElement("style");
        style.id = "ville-map-ping-style";
        style.textContent =
          "@keyframes ping-ville{75%,100%{transform:scale(2.2);opacity:0}}";
        document.head.appendChild(style);
      }

      new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);

      map.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-right"
      );

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lng, lat, zoom, label]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: 280,
        borderRadius: 0,
        overflow: "hidden",
        background: "#f0ede8",
      }}
      aria-label={`Carte de ${label}`}
    />
  );
}
