"use client";

/**
 * Mini-carte Mapbox pour la fiche bien (header hero).
 *
 * Affichage en 3 niveaux selon disponibilité :
 *   1. Photo de couverture si bien.images[is_cover] présente
 *      (géré par le parent — ce composant ne gère QUE map vs placeholder)
 *   2. Mini-map Mapbox light-v11 si lat/lng disponibles + token Mapbox
 *      avec marqueur Or Althy (#C9A961)
 *   3. Placeholder gradient Bleu de Prusse → Or si pas de coords
 *      ou pas de token Mapbox
 *
 * Pattern inspiré de frontend/src/app/biens/_components/VilleMap.tsx
 * (dynamic import mapbox-gl pour préserver le SSR).
 */

import { useEffect, useRef } from "react";
import { MapPin } from "lucide-react";
import type mapboxgl from "mapbox-gl";

interface MiniMapBienProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  ville: string;
  className?: string;
}

export function MiniMapBien({ lat, lng, ville, className }: MiniMapBienProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const hasCoords =
    typeof lat === "number" && typeof lng === "number" &&
    Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (!hasCoords || !containerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    import("mapbox-gl").then((mod) => {
      const mapboxgl = mod.default;
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/light-v11",
        center: [lng as number, lat as number],
        zoom: 14,
        attributionControl: false,
        interactive: false,
      });

      // Marqueur Or Althy (#C9A961) avec halo subtil
      const el = document.createElement("div");
      el.setAttribute("aria-label", ville);
      el.style.cssText = [
        "width:18px",
        "height:18px",
        "background:#C9A961",
        "border:3px solid #fff",
        "border-radius:50%",
        "box-shadow:0 2px 8px rgba(0,0,0,.35)",
      ].join(";");

      new mapboxgl.Marker({ element: el })
        .setLngLat([lng as number, lat as number])
        .addTo(map);

      mapRef.current = map;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [hasCoords, lat, lng, ville]);

  // Fallback : placeholder gradient si pas de coords ou pas de token
  if (!hasCoords) {
    return (
      <div
        className={className}
        style={{
          background:
            "linear-gradient(135deg, #0F2E4C 0%, #1A4975 60%, #C9A961 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.92)",
          width: "100%",
          height: "100%",
        }}
        aria-label={`Localisation ${ville}`}
      >
        <MapPin size={32} style={{ marginBottom: 6, opacity: 0.95 }} />
        <p style={{ fontSize: 12, fontWeight: 500, margin: 0, letterSpacing: "0.04em" }}>
          {ville}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
      aria-label={`Carte ${ville}`}
    />
  );
}
