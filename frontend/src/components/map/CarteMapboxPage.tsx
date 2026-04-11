"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { Loader2, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { AlthySphereCore } from "@/components/sphere/AlthySphereCore";
import { useAuthStore } from "@/lib/store/authStore";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParseResult {
  ville: string;
  lng: number;
  lat: number;
  filtres: {
    type_bien?: string;
    budget_max?: number;
    nb_pieces?: number;
    type_transaction?: string;
  };
}

// ── Constantes ────────────────────────────────────────────────────────────────

const ORANGE = "#E8602C";
const ACTIVE_CANTONS = ["Genève", "Vaud", "Valais", "Fribourg", "Neuchâtel", "Jura"];

const ACTIVE_CITIES = [
  { id: "geneve",    name: "Genève",    lng: 6.143, lat: 46.204, biens: 47 },
  { id: "lausanne",  name: "Lausanne",  lng: 6.632, lat: 46.519, biens: 83 },
  { id: "fribourg",  name: "Fribourg",  lng: 7.161, lat: 46.806, biens: 31 },
  { id: "neuchatel", name: "Neuchâtel", lng: 6.931, lat: 46.992, biens: 24 },
  { id: "sion",      name: "Sion",      lng: 7.359, lat: 46.233, biens: 19 },
] as const;

const INACTIVE_CITIES = [
  { id: "berne",  name: "Berne",  lng: 7.447, lat: 46.948 },
  { id: "zurich", name: "Zürich", lng: 8.541, lat: 47.376 },
  { id: "bale",   name: "Bâle",   lng: 7.589, lat: 47.560 },
] as const;

/** Fallback local si l'API échoue */
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
};

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

  /* ── Marker actif ── */
  .althy-pin-active { position: relative; width: 36px; height: 36px; cursor: pointer; transition: transform 0.3s, opacity 0.3s; }
  .althy-pin-active__pulse { position: absolute; inset: 0; border-radius: 50%; background: rgba(232,96,44,0.28); animation: althy-ping 2.2s ease-out infinite; }
  .althy-pin-active__dot { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 15px; height: 15px; border-radius: 50%; background: #E8602C; border: 2.5px solid #fff; box-shadow: 0 2px 10px rgba(232,96,44,0.55); transition: width 0.3s, height 0.3s, box-shadow 0.3s; }
  @keyframes althy-ping { 0% { transform: scale(0.7); opacity: 0.7; } 70% { transform: scale(2.4); opacity: 0; } 100% { transform: scale(0.7); opacity: 0; } }

  /* ── States filtres ── */
  .althy-pin-active.pin-dimmed { opacity: 0.25; pointer-events: none; }
  .althy-pin-active.pin-selected { transform: scale(1.4); }
  .althy-pin-active.pin-selected .althy-pin-active__dot { width: 18px; height: 18px; box-shadow: 0 0 0 4px rgba(232,96,44,0.25), 0 2px 12px rgba(232,96,44,0.6); }

  /* ── Marker inactif ── */
  .althy-pin-inactive { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
  .althy-pin-inactive__dot { width: 11px; height: 11px; border-radius: 50%; background: #BDB5AB; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.14); }

  /* ── Popup ── */
  .mapboxgl-popup-content { border-radius: 14px !important; padding: 14px !important; box-shadow: 0 6px 24px rgba(0,0,0,0.11) !important; border: 1px solid #EAE3D9 !important; font-family: Inter, DM Sans, sans-serif !important; }
  .mapboxgl-popup-tip { border-top-color: #fff !important; }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function filtresToLabel(filtres: ParseResult["filtres"]): string[] {
  const labels: string[] = [];
  if (filtres.type_transaction) labels.push(
    filtres.type_transaction === "location" ? "Location" :
    filtres.type_transaction === "vente" ? "Vente" : "Saisonnier"
  );
  if (filtres.type_bien) labels.push(
    filtres.type_bien.charAt(0).toUpperCase() + filtres.type_bien.slice(1)
  );
  if (filtres.nb_pieces) labels.push(`${filtres.nb_pieces} pièce${filtres.nb_pieces > 1 ? "s" : ""}`);
  if (filtres.budget_max) labels.push(
    `≤ CHF ${filtres.budget_max.toLocaleString("fr-CH")}`
  );
  return labels;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function CarteMapboxPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const pinElsRef    = useRef<Map<string, HTMLElement>>(new Map());

  const [search, setSearch]       = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError]   = useState(false);
  const [result, setResult]       = useState<ParseResult | null>(null);

  const { user } = useAuthStore();
  const initials = (user?.user_metadata?.full_name as string | undefined)
    ?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    ?? "?";

  // Stats dérivées des données ACTIVE_CITIES
  const totalBiens  = ACTIVE_CITIES.reduce((s, c) => s + c.biens, 0);
  const nbVilles    = ACTIVE_CITIES.length;

  // ── Initialisation Mapbox ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     "mapbox://styles/mapbox/light-v11",
      center:    [7.5, 46.8],
      zoom:      7.2,
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
        paint: { "fill-color": ORANGE, "fill-opacity": 0.10 },
      });
      map.addLayer({
        id: "cantons-line", type: "line", source: "cantons",
        filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
        paint: { "line-color": ORANGE, "line-width": 2 },
      });

      // Punaises actives — on stocke la ref DOM pour pouvoir les animer
      ACTIVE_CITIES.forEach(city => {
        const el = document.createElement("div");
        el.className = "althy-pin-active";
        el.dataset.cityId = city.id;
        el.innerHTML = `<div class="althy-pin-active__pulse"></div><div class="althy-pin-active__dot"></div>`;
        pinElsRef.current.set(city.id, el);

        const popup = new mapboxgl.Popup({ offset: 20, closeButton: false, maxWidth: "230px" })
          .setHTML(`
            <div>
              <p style="font-weight:700;font-size:14px;color:#1A1612;margin:0 0 4px">${city.name}</p>
              <p style="font-size:12px;color:#8A7A6A;margin:0 0 10px">${city.biens} biens disponibles</p>
              <a href="/app/biens?ville=${city.id}" style="display:block;background:#E8602C;color:#fff;text-align:center;padding:7px 14px;border-radius:9px;font-size:12px;font-weight:600;text-decoration:none;">
                Voir les biens →
              </a>
            </div>
          `);

        new mapboxgl.Marker({ element: el })
          .setLngLat([city.lng, city.lat])
          .setPopup(popup)
          .addTo(map);
      });

      // Punaises inactives
      INACTIVE_CITIES.forEach(city => {
        const el = document.createElement("div");
        el.className = "althy-pin-inactive";
        el.innerHTML = `<div class="althy-pin-inactive__dot" title="${city.name} — bientôt disponible"></div>`;
        new mapboxgl.Marker({ element: el }).setLngLat([city.lng, city.lat]).addTo(map);
      });
    });

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Application des filtres sur les punaises ─────────────────────────────
  const applyPinFilters = useCallback((villeResult: string | null) => {
    if (!villeResult) {
      // Reset : toutes les punaises normales
      pinElsRef.current.forEach(el => {
        el.classList.remove("pin-dimmed", "pin-selected");
      });
      return;
    }

    const matchedId = ACTIVE_CITIES.find(
      c => c.name.toLowerCase() === villeResult.toLowerCase() ||
           c.id === villeResult.toLowerCase()
    )?.id ?? null;

    pinElsRef.current.forEach((el, id) => {
      el.classList.remove("pin-dimmed", "pin-selected");
      if (matchedId) {
        if (id === matchedId) {
          el.classList.add("pin-selected");
        } else {
          el.classList.add("pin-dimmed");
        }
      }
    });
  }, []);

  // ── Soumission de la recherche ────────────────────────────────────────────
  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const query = search.trim();
    if (!query) return;

    setIsLoading(true);
    setApiError(false);

    try {
      const { data } = await api.post<ParseResult>(
        "/sphere/parse-location",
        { query }
      );

      setResult(data);

      // flyTo vers les coordonnées retournées par Claude
      if (mapRef.current) {
        mapRef.current.flyTo({
          center:   [data.lng, data.lat],
          zoom:     12,
          duration: 1800,
          essential: true,
        });
      }

      // Highlight punaise de la ville trouvée
      applyPinFilters(data.ville);

    } catch {
      // Fallback local si l'API est indisponible
      setApiError(true);
      const key = query.toLowerCase();
      const coords = CITY_LOOKUP[key];
      if (coords && mapRef.current) {
        mapRef.current.flyTo({ center: coords, zoom: 12, duration: 1800, essential: true });
      }
      setTimeout(() => setApiError(false), 3000);
    } finally {
      setIsLoading(false);
    }
  }, [search, applyPinFilters]);

  // ── Reset des filtres ─────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setResult(null);
    setSearch("");
    applyPinFilters(null);
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [7.5, 46.8], zoom: 7.2, duration: 1600, essential: true });
    }
  }, [applyPinFilters]);

  // ── Render ────────────────────────────────────────────────────────────────
  const filterLabels = result ? filtresToLabel(result.filtres) : [];

  return (
    <>
      <style>{STYLES}</style>

      <div className="althy-carte-wrap">
        {/* ── Fond carte ─────────────────────────────────────────────── */}
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

        {/* ── Topbar overlay ─────────────────────────────────────────── */}
        <header style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
          background: "rgba(250,248,245,0.90)", backdropFilter: "blur(14px)",
          borderBottom: "1px solid var(--althy-border, #EAE3D9)",
          display: "flex", alignItems: "center", gap: 16, padding: "10px 20px",
        }}>
          {/* Logo */}
          <Link href="/" style={{
            flexShrink: 0, textDecoration: "none",
            fontFamily: "var(--font-serif, Cormorant Garamond, serif)",
            fontWeight: 300, fontSize: 22, letterSpacing: "5px",
            color: "var(--althy-orange)",
          }}>
            ALTHY
          </Link>

          {/* Barre de recherche connectée à la Sphère IA */}
          <form
            onSubmit={handleSearch}
            style={{ flex: 1, maxWidth: 460, margin: "0 auto", position: "relative" }}
          >
            {isLoading ? (
              <Loader2
                size={15}
                style={{
                  position: "absolute", left: 12, top: "50%",
                  transform: "translateY(-50%)",
                  color: ORANGE, animation: "spin 1s linear infinite",
                  pointerEvents: "none",
                }}
              />
            ) : (
              <Search
                size={15}
                style={{
                  position: "absolute", left: 12, top: "50%",
                  transform: "translateY(-50%)",
                  color: apiError ? "#DC2626" : "var(--althy-text-3, #8A7A6A)",
                  pointerEvents: "none",
                }}
              />
            )}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Ex : studio Lausanne moins de 1500 CHF"
              disabled={isLoading}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "9px 16px 9px 34px",
                borderRadius: 24,
                border: `1.5px solid ${apiError ? "#DC2626" : "var(--althy-border, #EAE3D9)"}`,
                background: "#fff",
                fontSize: 13, color: "var(--althy-text, #1A1612)",
                outline: "none", transition: "border-color 0.2s",
                opacity: isLoading ? 0.7 : 1,
              }}
            />
            {apiError && (
              <span style={{
                position: "absolute", right: 12, top: "50%",
                transform: "translateY(-50%)",
                fontSize: 11, color: "#DC2626",
              }}>
                Indisponible
              </span>
            )}
          </form>

          {/* Bouton Sphère IA */}
          <Link href="/app/sphere" style={{
            flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
            padding: "7px 16px", borderRadius: 20,
            background: "var(--althy-orange-bg)",
            color: "var(--althy-orange)",
            border: "1px solid rgba(232,96,44,0.25)",
            textDecoration: "none",
            fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
          }}>
            <AlthySphereCore state="idle" size={16} />
            Sphère IA
          </Link>

          {/* Avatar utilisateur */}
          <div style={{
            flexShrink: 0, width: 34, height: 34, borderRadius: "50%",
            background: "var(--althy-orange)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#fff",
            cursor: "default",
          }}>
            {initials}
          </div>
        </header>

        {/* ── Bandeau résultat IA ─────────────────────────────────────── */}
        {result && (
          <div style={{
            position: "absolute", top: 56, left: 0, right: 0, zIndex: 19,
            background: "rgba(250,248,245,0.88)", backdropFilter: "blur(10px)",
            borderBottom: "1px solid var(--althy-border, #EAE3D9)",
            padding: "6px 20px",
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 12, color: ORANGE, fontWeight: 700 }}>
              Sphère IA
            </span>
            <span style={{ fontSize: 12, color: "#8A7A6A" }}>
              {result.ville}
            </span>
            {filterLabels.map(label => (
              <span key={label} style={{
                fontSize: 11, fontWeight: 600, padding: "2px 8px",
                borderRadius: 10, background: `${ORANGE}14`, color: ORANGE,
                border: `1px solid ${ORANGE}28`,
              }}>
                {label}
              </span>
            ))}
            <button
              onClick={handleReset}
              style={{
                marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer",
                fontSize: 11, color: "#8A7A6A", padding: 4,
              }}
            >
              <X size={12} />
              Réinitialiser
            </button>
          </div>
        )}

        {/* ── Stats flottantes haut gauche ───────────────────────────── */}
        <div style={{
          position: "absolute",
          top: result ? 100 : 74,
          left: 20, zIndex: 10,
          transition: "top 0.3s",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          border: "0.5px solid var(--althy-border)",
          borderRadius: 12,
          padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 20,
        }}>
          {[
            { valeur: String(totalBiens), label: "Biens" },
            { valeur: String(nbVilles),   label: "Villes actives" },
            { valeur: "4.7 ★",           label: "Note moyenne" },
          ].map((stat, i) => (
            <div key={stat.label} style={{ display: "flex", alignItems: "center", gap: i < 2 ? 20 : 0 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--althy-orange)", lineHeight: 1 }}>
                  {stat.valeur}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--althy-text-3)", marginTop: 2 }}>
                  {stat.label}
                </div>
              </div>
              {i < 2 && (
                <div style={{ width: 1, height: 28, background: "var(--althy-border)", flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>

        {/* ── CTA bas centré ─────────────────────────────────────────── */}
        <div style={{
          position: "absolute", bottom: 32,
          left: "50%", transform: "translateX(-50%)", zIndex: 10,
        }}>
          <Link href="/app/biens" style={{
            display: "inline-flex", flexDirection: "column", alignItems: "center",
            background: "#1A1612", color: "#FAFAF8",
            padding: "14px 32px", borderRadius: 32,
            textDecoration: "none",
            boxShadow: "0 8px 32px rgba(26,22,18,0.22)",
            whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Voir les biens disponibles →</span>
            <span style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
              {totalBiens} biens · Prix dès CHF 850/mois
            </span>
          </Link>
        </div>
      </div>
    </>
  );
}
