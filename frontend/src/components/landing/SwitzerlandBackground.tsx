"use client";

import { useEffect, useState } from "react";
import { feature } from "topojson-client";
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";

/**
 * SwitzerlandBackground — fond hero v2.
 *
 * Contour national de la Suisse en or sur fond Bleu de Prusse.
 * Charge world-atlas (topojson niveau pays), filtre la Suisse,
 * projette en Mercator, dessine en SVG avec animation stroke-dasharray.
 *
 * 5 villes pulsées (Genève / Lausanne / Berne / Zurich / Bâle), halos
 * staggered 0/0.6/1.2/1.8/2.4s. Topographie 5% + gradient overlay.
 *
 * Zéro Mapbox, zéro tile externe — pur SVG, GPU-friendly.
 */

const PRUSSIAN = "#0F2E4C";
const GOLD     = "#C9A961";

const VB = { width: 1200, height: 720 };

type CityKey = "geneva" | "lausanne" | "bern" | "zurich" | "basel";
const CITIES: { key: CityKey; name: string; lon: number; lat: number; delay: number }[] = [
  { key: "geneva",   name: "Genève",   lon: 6.143, lat: 46.204, delay: 0.0 },
  { key: "lausanne", name: "Lausanne", lon: 6.632, lat: 46.519, delay: 0.6 },
  { key: "bern",     name: "Berne",    lon: 7.447, lat: 46.948, delay: 1.2 },
  { key: "zurich",   name: "Zurich",   lon: 8.541, lat: 47.376, delay: 1.8 },
  { key: "basel",    name: "Bâle",     lon: 7.588, lat: 47.560, delay: 2.4 },
];

export function SwitzerlandBackground() {
  const [path, setPath] = useState<string>("");
  const [cityCoords, setCityCoords] = useState<Record<CityKey, [number, number]>>(
    {} as Record<CityKey, [number, number]>,
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const topo: any = await import("world-atlas/countries-50m.json").then((m) => m.default ?? m);
        if (!alive) return;
        const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>;
        const ch = fc.features.find((f) => f.properties?.name === "Switzerland");
        if (!ch) return;

        const projection = geoMercator().fitExtent(
          [[40, 60], [VB.width - 40, VB.height - 60]],
          ch as any,
        );
        const pathGen = geoPath(projection);
        const d = pathGen(ch as any) ?? "";

        const coords: Record<string, [number, number]> = {};
        for (const c of CITIES) {
          const p = projection([c.lon, c.lat]);
          if (p) coords[c.key] = p;
        }
        setPath(d);
        setCityCoords(coords as Record<CityKey, [number, number]>);
      } catch {
        // fallback : laisse vide, le fond reste propre
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: PRUSSIAN,
        pointerEvents: "none",
      }}
    >
      {/* Topographie subtile */}
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, opacity: 0.05 }}
      >
        <defs>
          <pattern id="topo" width="120" height="120" patternUnits="userSpaceOnUse">
            <path d="M0 60 Q30 40 60 60 T120 60" stroke={GOLD} strokeWidth="0.5" fill="none" />
            <path d="M0 80 Q30 60 60 80 T120 80" stroke={GOLD} strokeWidth="0.5" fill="none" />
            <path d="M0 40 Q30 20 60 40 T120 40" stroke={GOLD} strokeWidth="0.5" fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#topo)" />
      </svg>

      {/* Contour national + villes */}
      <svg
        viewBox={`0 0 ${VB.width} ${VB.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {path && (
          <>
            {/* Halo glow autour du contour */}
            <path
              d={path}
              fill="none"
              stroke={GOLD}
              strokeWidth={6}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.18}
              style={{ filter: "blur(8px)" }}
            />
            {/* Contour principal — animation reveal */}
            <path
              d={path}
              fill="none"
              stroke={GOLD}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={0.85}
              style={{
                strokeDasharray: 4000,
                strokeDashoffset: 4000,
                animation: "sb-draw 1.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards",
                filter: "drop-shadow(0 0 12px rgba(201,169,97,0.4))",
              }}
            />
          </>
        )}

        {/* Villes — halos pulsés + points */}
        {CITIES.map((c) => {
          const xy = cityCoords[c.key];
          if (!xy) return null;
          const [x, y] = xy;
          return (
            <g key={c.key}>
              <circle
                cx={x}
                cy={y}
                r={14}
                fill={GOLD}
                opacity={0}
                style={{ animation: `sb-pulse 3s ease-in-out ${c.delay + 1.6}s infinite` }}
              />
              <circle
                cx={x}
                cy={y}
                r={6}
                fill={GOLD}
                opacity={0}
                style={{
                  animation: `sb-fade-in 0.6s ease-out ${c.delay + 1.6}s forwards`,
                  filter: "drop-shadow(0 0 4px rgba(201,169,97,0.6))",
                }}
              />
              <text
                x={x + 12}
                y={y + 4}
                fontFamily="var(--font-sans)"
                fontSize={12}
                fontWeight={500}
                fill={GOLD}
                opacity={0}
                style={{
                  animation: `sb-fade-in 0.6s ease-out ${c.delay + 1.9}s forwards`,
                  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                }}
              >
                {c.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Gradient overlay pour readability du contenu hero */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, rgba(15,46,76,0) 0%, rgba(15,46,76,0.35) 70%, rgba(15,46,76,0.7) 100%)",
        }}
      />

      <style>{`
        @keyframes sb-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes sb-pulse {
          0%, 100% { opacity: 0;    transform-origin: center; transform: scale(1);   }
          50%      { opacity: 0.45; transform: scale(2.2); }
        }
        @keyframes sb-fade-in {
          to { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
