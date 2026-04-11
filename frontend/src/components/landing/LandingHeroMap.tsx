"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Search } from "lucide-react";

// ── Constantes ────────────────────────────────────────────────────────────────

const ORANGE = "#E8602C";
const MAP_H  = 420;
const CARD_W = 170;
const CARD_H = 118; // photo 72px + content ~46px

const ACTIVE_CANTONS = ["Genève", "Vaud", "Valais", "Fribourg", "Neuchâtel", "Jura"];

// Ordre important — pinIdx dans CARDS fait référence à cet index
const PINS_ACTIVE = [
  { id: "geneve",    lng: 6.143, lat: 46.204 }, // 0
  { id: "lausanne",  lng: 6.632, lat: 46.519 }, // 1
  { id: "fribourg",  lng: 7.161, lat: 46.806 }, // 2
  { id: "neuchatel", lng: 6.931, lat: 46.992 }, // 3
  { id: "sion",      lng: 7.359, lat: 46.233 }, // 4
];

const PINS_INACTIVE = [
  { lng: 7.447, lat: 46.948 },
  { lng: 8.541, lat: 47.376 },
  { lng: 7.589, lat: 47.560 },
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

// ── Cards biens ───────────────────────────────────────────────────────────────

interface CardData {
  id:       string;
  pinIdx:   number;                   // index dans PINS_ACTIVE
  lng:      number;
  lat:      number;
  posStyle: React.CSSProperties;      // CSS absolu sur le wrapper
  posRaw: {                           // valeurs % pour calcul SVG
    top?:    number;
    left?:   number;
    right?:  number;
    bottom?: number;
  };
  anchor:   "right" | "left";         // côté de la card d'où part la ligne
  price:    string;
  address:  string;
  tags:     string[];
  gradient: string;
}

const CARDS: CardData[] = [
  {
    id: "geneve",   pinIdx: 0, lng: 6.143, lat: 46.204,
    posStyle: { top: "8%",   left: "4%"  },
    posRaw:   { top: 8,      left: 4     },
    anchor: "right",
    price:   "CHF 2 200/mois",
    address: "Rue de Rive 14 · Genève",
    tags: ["3p", "75m²"],
    gradient: "linear-gradient(135deg, #A09080 0%, #7A6858 100%)",
  },
  {
    id: "lausanne", pinIdx: 1, lng: 6.632, lat: 46.519,
    posStyle: { top: "42%",  right: "4%" },
    posRaw:   { top: 42,     right: 4    },
    anchor: "left",
    price:   "CHF 1 350/mois",
    address: "Av. de la Gare 8 · Lausanne",
    tags: ["Studio", "32m²"],
    gradient: "linear-gradient(135deg, #7A8A9A 0%, #5A6A7A 100%)",
  },
  {
    id: "sion",     pinIdx: 4, lng: 7.359, lat: 46.233,
    posStyle: { bottom: "18%", left: "6%" },
    posRaw:   { bottom: 18,    left: 6   },
    anchor: "right",
    price:   "CHF 980/mois",
    address: "Pl. du Marché 3 · Sion",
    tags: ["2p", "48m²"],
    gradient: "linear-gradient(135deg, #8A9A7A 0%, #6A7A5A 100%)",
  },
];

// ── CSS markers ───────────────────────────────────────────────────────────────

const MARKER_CSS = `
  .lhm-pin-active {
    position: relative; width: 28px; height: 28px;
    transition: transform 0.2s ease;
  }
  .lhm-pin-active.pin-hovered { transform: scale(1.3); }
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

interface SvgLine { x1: number; y1: number; x2: number; y2: number }

export default function LandingHeroMap() {
  const containerRef = useRef<HTMLDivElement>(null); // mapbox canvas
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const pinRefs      = useRef<(HTMLElement | null)[]>([]); // indexed by pinIdx

  const [lines, setLines]   = useState<SvgLine[]>([]);
  const [svgW,  setSvgW]    = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [query, setQuery]   = useState("");
  const [err, setErr]       = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

    const map = new mapboxgl.Map({
      container:        containerRef.current,
      style:            "mapbox://styles/mapbox/light-v11",
      center:           [7.5, 46.8],
      zoom:             7.2,
      interactive:      false,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      // ── Cantons ──────────────────────────────────────────────────────────
      map.addSource("cantons", { type: "geojson", data: "/cantons-suisse.json" });
      map.addLayer({
        id: "cantons-fill", type: "fill", source: "cantons",
        filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
        paint: { "fill-color": ORANGE, "fill-opacity": 0.09 },
      });
      map.addLayer({
        id: "cantons-line", type: "line", source: "cantons",
        filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
        paint: { "line-color": ORANGE, "line-width": 1.5 },
      });

      // ── Pins actifs ───────────────────────────────────────────────────────
      PINS_ACTIVE.forEach((pin, idx) => {
        const el = document.createElement("div");
        el.className = "lhm-pin-active";
        el.innerHTML = `<div class="lhm-pin-active__pulse"></div><div class="lhm-pin-active__dot"></div>`;
        pinRefs.current[idx] = el;
        new mapboxgl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(map);
      });

      // ── Pins inactifs ─────────────────────────────────────────────────────
      PINS_INACTIVE.forEach(pin => {
        const el = document.createElement("div");
        el.className = "lhm-pin-inactive";
        el.innerHTML = `<div class="lhm-pin-inactive__dot"></div>`;
        new mapboxgl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(map);
      });

      // ── Calcul des lignes SVG ─────────────────────────────────────────────
      const w = containerRef.current?.offsetWidth ?? 600;
      setSvgW(w);

      const computed: SvgLine[] = CARDS.map(card => {
        const pin = map.project([card.lng, card.lat]); // px relatifs au container

        // Position top-left de la card en px
        const raw = card.posRaw;
        const cardLeft =
          raw.left !== undefined
            ? (raw.left / 100) * w
            : w - (raw.right! / 100) * w - CARD_W;
        const cardTop =
          raw.top !== undefined
            ? (raw.top / 100) * MAP_H
            : MAP_H - (raw.bottom! / 100) * MAP_H - CARD_H;

        // Point d'ancrage de la card (milieu du côté vers la punaise)
        const x1 = card.anchor === "right" ? cardLeft + CARD_W + 4 : cardLeft - 4;
        const y1 = cardTop + CARD_H / 2;

        return { x1, y1, x2: pin.x, y2: pin.y };
      });

      setLines(computed);
    });

    return () => { map.remove(); mapRef.current = null; pinRefs.current = []; };
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

  function onCardClick(card: CardData) {
    mapRef.current?.flyTo({ center: [card.lng, card.lat], zoom: 13, speed: 1.2, curve: 1.4, essential: true });
  }

  function onCardEnter(card: CardData) {
    setHovered(card.id);
    pinRefs.current[card.pinIdx]?.classList.add("pin-hovered");
  }

  function onCardLeave(card: CardData) {
    setHovered(null);
    pinRefs.current[card.pinIdx]?.classList.remove("pin-hovered");
  }

  return (
    <>
      <style>{MARKER_CSS}</style>

      {/* ── Wrapper : map + cards + svg ─────────────────────────────────── */}
      <div style={{
        position: "relative",
        height: MAP_H,
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(26,22,18,0.07)",
        boxShadow: "0 8px 40px rgba(26,22,18,0.08)",
      }}>

        {/* Mapbox canvas */}
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

        {/* SVG connecteurs pointillés */}
        {svgW > 0 && lines.length > 0 && (
          <svg
            style={{
              position: "absolute", inset: 0,
              pointerEvents: "none", zIndex: 4,
            }}
            width={svgW}
            height={MAP_H}
          >
            {lines.map((ln, i) => (
              <line
                key={i}
                x1={ln.x1} y1={ln.y1}
                x2={ln.x2} y2={ln.y2}
                stroke={ORANGE}
                strokeDasharray="5,4"
                strokeWidth={1}
                opacity={0.5}
              />
            ))}
          </svg>
        )}

        {/* Cards biens flottantes */}
        {CARDS.map(card => {
          const isHov = hovered === card.id;
          return (
            <div
              key={card.id}
              onClick={() => onCardClick(card)}
              onMouseEnter={() => onCardEnter(card)}
              onMouseLeave={() => onCardLeave(card)}
              style={{
                position: "absolute",
                zIndex: 5,
                width: CARD_W,
                cursor: "pointer",
                borderRadius: 12,
                background: "#fff",
                border: "0.5px solid rgba(26,22,18,0.08)",
                boxShadow: isHov
                  ? "0 8px 32px rgba(26,22,18,0.20)"
                  : "0 4px 20px rgba(26,22,18,0.12)",
                transform: isHov ? "translateY(-2px) scale(1.02)" : "translateY(0) scale(1)",
                transition: "box-shadow 0.18s, transform 0.18s",
                overflow: "hidden",
                ...card.posStyle,
              }}
            >
              {/* Photo placeholder */}
              <div style={{ height: 72, background: card.gradient, position: "relative" }}>
                <span style={{
                  position: "absolute", top: 6, right: 7,
                  background: "rgba(255,255,255,0.92)",
                  borderRadius: 20, padding: "2px 8px",
                  fontSize: 9.5, fontWeight: 700, color: ORANGE,
                  letterSpacing: "0.02em", lineHeight: 1.6,
                }}>
                  ★ Vérifié Althy
                </span>
              </div>

              {/* Infos */}
              <div style={{ padding: "8px 10px 9px" }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#1A1612", marginBottom: 3 }}>
                  {card.price}
                </div>
                <div style={{ fontSize: 10, color: "#6B5E52", marginBottom: 6, lineHeight: 1.3 }}>
                  {card.address}
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {card.tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: 9.5, fontWeight: 600,
                      padding: "2px 7px", borderRadius: 4,
                      background: "rgba(232,96,44,0.08)",
                      color: ORANGE,
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Barre de recherche ────────────────────────────────────────────── */}
      <form
        onSubmit={handleSearch}
        style={{ marginTop: 14, position: "relative", maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}
      >
        <Search
          size={15}
          style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#6B5E52", pointerEvents: "none" }}
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
            padding: "6px 18px", borderRadius: 22,
            background: ORANGE, color: "#fff",
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
