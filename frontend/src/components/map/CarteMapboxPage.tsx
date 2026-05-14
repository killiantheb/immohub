"use client";

/**
 * /app/carte — Carte des biens du propriétaire connecté.
 *
 * Doctrine §B.15 (CLAUDE.md) : Phase 1.0 = gestion pure. La marketplace publique
 * (stats "204 biens · 5 villes · 4.7 ★", recherche Sphère IA cross-locale,
 * CTA "Voir les biens disponibles") est code dormant Phase 2 (cf
 * docs/2-ROADMAP.md §2.4.5).
 *
 * Cette page affiche désormais uniquement les biens du user connecté
 * (GET /biens via useBiensList), avec un pin par ville (fallback CITY_LOOKUP).
 * Chaque pin cliquable mène vers /app/biens/{id}.
 */

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { useBiensList } from "@/lib/hooks/useBiens";
import type { BienListItem } from "@/lib/types";
import { C } from "@/lib/design-tokens";

// ── Constantes ────────────────────────────────────────────────────────────────
// Mapbox GL requires hex — do not replace with CSS var
const PRUSSIAN = "#0F2E4C";
const ACTIVE_CANTONS = ["Genève", "Vaud", "Valais", "Fribourg", "Neuchâtel", "Jura"];

/** Fallback local pour géolocaliser un bien à partir de sa ville. */
const CITY_LOOKUP: Record<string, [number, number]> = {
  "genève":    [6.143, 46.204], "geneve":    [6.143, 46.204], "geneva":    [6.143, 46.204],
  "lausanne":  [6.632, 46.519],
  "fribourg":  [7.161, 46.806],
  "neuchâtel": [6.931, 46.992], "neuchatel": [6.931, 46.992],
  "sion":      [7.359, 46.233],
  "berne":     [7.447, 46.948], "bern":      [7.447, 46.948],
  "zürich":    [8.541, 47.376], "zurich":    [8.541, 47.376],
  "bâle":      [7.589, 47.560], "bale":      [7.589, 47.560], "basel":     [7.589, 47.560],
  "lugano":    [8.951, 46.004], "lucerne":   [8.307, 47.050],
  "montreux":  [6.911, 46.433], "nyon":      [6.239, 46.383],
  "morges":    [6.499, 46.512], "verbier":   [7.225, 46.097],
  "vevey":     [6.844, 46.461], "yverdon":   [6.641, 46.778],
  "renens":    [6.589, 46.537], "carouge":   [6.140, 46.185],
  "meyrin":    [6.079, 46.233], "crans-montana": [7.482, 46.310],
};

function cityCoords(city: string | null | undefined): [number, number] | null {
  if (!city) return null;
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const direct = CITY_LOOKUP[city.toLowerCase()];
  if (direct) return direct;
  const targetKey = norm(city);
  for (const [k, v] of Object.entries(CITY_LOOKUP)) {
    if (norm(k) === targetKey) return v;
  }
  return null;
}

// ── CSS injecté ───────────────────────────────────────────────────────────────

const STYLES = `
  .althy-carte-wrap {
    position: relative; overflow: hidden;
    margin: -2.5rem -2.5rem -4rem;
    height: 100vh;
  }
  @media (max-width: 768px) {
    .althy-carte-wrap { margin: -70px -16px -3rem; height: calc(100vh - 54px); }
  }
  @media (max-width: 480px) {
    .althy-carte-wrap { margin: -66px -12px -2.5rem; height: calc(100vh - 54px); }
  }

  /* ── Pin bien (Prussian, §B.4) ── */
  .althy-pin-bien { position: relative; width: 32px; height: 32px; cursor: pointer; transition: transform 0.18s; }
  .althy-pin-bien:hover { transform: scale(1.12); }
  .althy-pin-bien__dot { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 14px; height: 14px; border-radius: 50%; background: #0F2E4C; border: 2.5px solid #fff; box-shadow: 0 2px 10px rgba(15,46,76,0.45); }

  .mapboxgl-popup-content { border-radius: 14px !important; padding: 14px !important; box-shadow: 0 6px 24px rgba(0,0,0,0.11) !important; border: 1px solid #EAE3D9 !important; font-family: Inter, DM Sans, sans-serif !important; }
  .mapboxgl-popup-tip { border-top-color: #fff !important; }
`;

// ── Composant ─────────────────────────────────────────────────────────────────

export default function CarteMapboxPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const { data, isLoading } = useBiensList({ size: 200 });
  const biens: BienListItem[] = useMemo(() => data?.items ?? [], [data]);

  // Init Mapbox (une seule fois)
  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [7.5, 46.8],
      zoom: 7.2,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("cantons", { type: "geojson", data: "/cantons-suisse.json" });
      map.addLayer({
        id: "cantons-fill", type: "fill", source: "cantons",
        filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
        paint: { "fill-color": PRUSSIAN, "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "cantons-line", type: "line", source: "cantons",
        filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
        paint: { "line-color": PRUSSIAN, "line-width": 1.5 },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync markers avec les biens
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Cleanup markers précédents
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    biens.forEach((bien) => {
      const coords = cityCoords(bien.ville);
      if (!coords) return;

      const el = document.createElement("div");
      el.className = "althy-pin-bien";
      el.innerHTML = `<div class="althy-pin-bien__dot"></div>`;

      const popup = new mapboxgl.Popup({ offset: 18, closeButton: false, maxWidth: "240px" })
        .setHTML(`
          <div>
            <p style="font-weight:700;font-size:14px;color:#1A1612;margin:0 0 4px">
              ${escapeHtml(bien.adresse || "Adresse non renseignée")}
            </p>
            <p style="font-size:12px;color:#8A7A6A;margin:0 0 10px">
              ${escapeHtml(bien.ville ?? "")}${bien.loyer ? ` · CHF ${bien.loyer.toLocaleString("fr-CH")}/mois` : ""}
            </p>
            <a href="/app/biens/${bien.id}" style="display:block;background:#0F2E4C;color:#fff;text-align:center;padding:7px 14px;border-radius:9px;font-size:12px;font-weight:600;text-decoration:none;">
              Voir le bien →
            </a>
          </div>
        `);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Centre la vue sur les biens (si au moins 1)
    if (biens.length > 0) {
      const validCoords = biens
        .map((b) => cityCoords(b.ville))
        .filter((c): c is [number, number] => c !== null);
      if (validCoords.length === 1) {
        map.flyTo({ center: validCoords[0], zoom: 11, duration: 1200 });
      } else if (validCoords.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        validCoords.forEach((c) => bounds.extend(c));
        map.fitBounds(bounds, { padding: 80, maxZoom: 11, duration: 1200 });
      }
    }
  }, [biens]);

  const nbBiensCarte = biens.filter((b) => cityCoords(b.ville) !== null).length;
  const nbBiensTotal = biens.length;
  const hasBiens = nbBiensTotal > 0;

  return (
    <>
      <style>{STYLES}</style>

      <div className="althy-carte-wrap">
        {/* Fond carte */}
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

        {/* Header overlay (titre + counter) */}
        <header
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            background: "rgba(250,248,245,0.92)",
            backdropFilter: "blur(14px)",
            borderBottom: "1px solid var(--althy-border, #EAE3D9)",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                fontWeight: 300,
                color: C.text,
                letterSpacing: "-0.01em",
              }}
            >
              Mes biens — Carte
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: C.text3 }}>
              {isLoading
                ? "Chargement…"
                : `${nbBiensCarte} bien${nbBiensCarte !== 1 ? "s" : ""} affiché${nbBiensCarte !== 1 ? "s" : ""}${
                    nbBiensTotal > nbBiensCarte
                      ? ` (${nbBiensTotal - nbBiensCarte} sans ville reconnue)`
                      : ""
                  }`}
            </p>
          </div>

          <Link
            href="/app/biens"
            style={{
              flexShrink: 0,
              padding: "8px 16px",
              borderRadius: 9,
              background: C.surface,
              border: `1px solid ${C.border}`,
              color: C.text2,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Liste des biens
          </Link>
        </header>

        {/* EmptyState centré (uniquement si pas de biens) */}
        {!isLoading && !hasBiens && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 10,
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(12px)",
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: "32px 28px",
              textAlign: "center",
              maxWidth: 360,
              boxShadow: "0 8px 32px rgba(15,46,76,0.12)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: C.prussianBg,
                border: `1px solid ${C.prussianBorder}`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <MapPin size={22} color={C.prussian} />
            </div>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: 16,
                fontWeight: 700,
                color: C.text,
              }}
            >
              Aucun bien à afficher
            </p>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: C.text3, lineHeight: 1.5 }}>
              Ajoutez votre premier bien pour le voir apparaître sur la carte.
            </p>
            <Link
              href="/app/biens/nouveau"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 20px",
                borderRadius: 9,
                background: C.prussian,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Ajouter un bien
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
