"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Layers, List, ChevronDown, X } from "lucide-react";
import { Footer } from "@/components/landing/Footer";

// ── Design tokens ──────────────────────────────────────────────────────────────

const ORANGE = "#E8602C";
const DARK   = "#1A1612";
const MUTED  = "#6B5E52";
const BG     = "#FAFAF8";
const serif  = "var(--font-serif, 'Fraunces', Georgia, serif)";
const sans   = "var(--font-sans, 'DM Sans', system-ui, sans-serif)";

const ACTIVE_CANTONS = ["Genève", "Vaud", "Valais", "Fribourg", "Neuchâtel", "Jura"];

// ── Types ──────────────────────────────────────────────────────────────────────

interface BienMarker {
  id:       string;
  lng:      number;
  lat:      number;
  prix:     string;
  periode:  string;
  ville:    string;
  adresse:  string;
  type:     string;
  surface:  number;
  pieces:   number;
  statut:   "À louer" | "À vendre" | "Saisonnier";
  gradient: string;
  verifie:  boolean;
  note:     number;
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const BIENS_MARKERS: BienMarker[] = [
  {
    id: "g1", lng: 6.143, lat: 46.204,
    prix: "2'200", periode: "/mois",
    ville: "Genève", adresse: "Rue de Rive 14 · Rive Gauche",
    type: "Appartement", surface: 75, pieces: 3,
    statut: "À louer",
    gradient: "linear-gradient(135deg,#E8D8C4,#C8A880)",
    verifie: true, note: 4.8,
  },
  {
    id: "l1", lng: 6.632, lat: 46.519,
    prix: "1'350", periode: "/mois",
    ville: "Lausanne", adresse: "Av. de la Gare 8 · Centre",
    type: "Studio", surface: 32, pieces: 1,
    statut: "À louer",
    gradient: "linear-gradient(135deg,#C4D8C4,#90B890)",
    verifie: true, note: 4.6,
  },
  {
    id: "f1", lng: 7.161, lat: 46.806,
    prix: "1'580", periode: "/mois",
    ville: "Fribourg", adresse: "Grand-Rue 22 · Basse-Ville",
    type: "Appartement", surface: 55, pieces: 2,
    statut: "À louer",
    gradient: "linear-gradient(135deg,#E0D8C4,#C0A880)",
    verifie: false, note: 4.5,
  },
  {
    id: "n1", lng: 6.931, lat: 46.992,
    prix: "1'800", periode: "/mois",
    ville: "Neuchâtel", adresse: "Fbg de l'Hôpital 5 · Centre",
    type: "Appartement", surface: 80, pieces: 3,
    statut: "À louer",
    gradient: "linear-gradient(135deg,#C8C4E0,#9890B8)",
    verifie: false, note: 4.4,
  },
  {
    id: "s1", lng: 7.359, lat: 46.233,
    prix: "980", periode: "/mois",
    ville: "Sion", adresse: "Pl. du Marché 3 · Centre",
    type: "Studio", surface: 38, pieces: 1,
    statut: "À louer",
    gradient: "linear-gradient(135deg,#C4D8C0,#90B080)",
    verifie: true, note: 4.7,
  },
  {
    id: "g2", lng: 6.185, lat: 46.218,
    prix: "3'400", periode: "/mois",
    ville: "Genève", adresse: "Route de Chêne 44 · Champel",
    type: "Villa", surface: 180, pieces: 5,
    statut: "À louer",
    gradient: "linear-gradient(135deg,#D4C8B8,#A89880)",
    verifie: true, note: 4.9,
  },
  {
    id: "l2", lng: 6.651, lat: 46.538,
    prix: "2'100", periode: "/mois",
    ville: "Lausanne", adresse: "Chemin des Pins 3 · Chailly",
    type: "Appartement", surface: 95, pieces: 4,
    statut: "À louer",
    gradient: "linear-gradient(135deg,#C0D0C0,#889880)",
    verifie: true, note: 4.6,
  },
];

const CITY_COORDS: Record<string, [number, number]> = {
  "genève": [6.143, 46.204], "geneve": [6.143, 46.204], "geneva": [6.143, 46.204],
  "lausanne": [6.632, 46.519],
  "fribourg": [7.161, 46.806],
  "neuchâtel": [6.931, 46.992], "neuchatel": [6.931, 46.992],
  "sion": [7.359, 46.233], "valais": [7.359, 46.233],
  "nyon": [6.239, 46.383], "montreux": [6.911, 46.433],
  "vevey": [6.844, 46.461], "yverdon": [6.641, 46.778],
};

const VALEURS = [
  { n: "24h/24", label: "Disponible",  desc: "Althy ne dort jamais — week-end et jours fériés inclus" },
  { n: "15 min", label: "Chrono",      desc: "Pour rédiger un bail complet, une quittance, un état des lieux" },
  { n: "4%",     label: "Transparent", desc: "Uniquement sur les flux reçus via Althy — zéro marge cachée" },
  { n: "100%",   label: "Suisse",      desc: "Données hébergées en Suisse, conformes LPD et RGPD" },
] as const;

const ETAPES = [
  { n: "01", titre: "Inscrivez-vous",    desc: "Choisissez votre rôle en 2 minutes : propriétaire, agence, artisan, locataire. Aucune carte bancaire requise." },
  { n: "02", titre: "La Sphère analyse", desc: "Notre agent IA lit votre contexte chaque matin et vous propose des actions prioritaires à valider." },
  { n: "03", titre: "Vous décidez",      desc: "Un clic pour valider. Althy exécute — envoi d'email, génération de document, coordination artisan." },
] as const;

const ROLES = [
  { icon: "⌂", titre: "Propriétaire",      desc: "Baux, états des lieux, quittances, relances, artisans — gérez seul ou avec votre agence.", prix: "CHF 29", periode: "/mois",       note: "ou CHF 23 si annuel",     href: "/register?role=proprio_solo", cta: "Commencer",       accent: ORANGE    },
  { icon: "⬜", titre: "Agence",            desc: "Multi-agents, portail proprio pour vos clients, mandats, comptabilité PPE — un outil pour toute l'équipe.", prix: "CHF 29", periode: "/agent/mois", note: "Portail proprio CHF 9",   href: "/register?role=agence",       cta: "Voir la démo",    accent: "#2563EB" },
  { icon: "⚒", titre: "Artisan & Ouvreur", desc: "Profil vérifié, missions qualifiées dans votre zone, devis et facturation automatiques.", prix: "Gratuit", periode: "",            note: "Pro CHF 19/mois",          href: "/register?role=artisan",      cta: "Créer mon profil", accent: "#3A7A5A" },
  { icon: "◇", titre: "Locataire",          desc: "Bail, quittances, signalement de problème — tout en un seul endroit, simple et gratuit.", prix: "Gratuit", periode: "",            note: "Dossier CHF 90 si retenu", href: "/register?role=locataire",    cta: "Accéder",         accent: "#6B5E52" },
] as const;

// ── CSS ────────────────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
  .althy-bubble {
    background: #E8602C;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    font-family: 'DM Sans', system-ui, sans-serif;
    padding: 5px 12px;
    border-radius: 20px;
    white-space: nowrap;
    box-shadow: 0 3px 14px rgba(232,96,44,0.50), 0 1px 3px rgba(0,0,0,0.15);
    border: 2px solid rgba(255,255,255,0.55);
    letter-spacing: 0.01em;
    position: relative;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    cursor: pointer;
    user-select: none;
  }
  .althy-bubble::after {
    content: '';
    position: absolute;
    bottom: -7px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 7px solid #E8602C;
    display: block;
  }
  .althy-bubble:hover { transform: scale(1.08) translateY(-2px); box-shadow: 0 6px 20px rgba(232,96,44,0.55); }
  .althy-bubble.active { background: #1A1208; box-shadow: 0 6px 20px rgba(26,18,8,0.40); }
  .althy-bubble.active::after { border-top-color: #1A1208; }
  .althy-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #E8602C;
    margin-top: 1px;
    box-shadow: 0 0 0 3px rgba(232,96,44,0.20);
  }

  .lp-grid-valeurs { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
  .lp-grid-roles   { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
  .lp-grid-etapes  { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
  .lp-grid-biens   { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }

  @media (max-width:1024px) {
    .lp-grid-valeurs { grid-template-columns:repeat(2,1fr); }
    .lp-grid-roles   { grid-template-columns:repeat(2,1fr); }
    .lp-grid-biens   { grid-template-columns:repeat(2,1fr); }
  }
  @media (max-width:640px) {
    .lp-grid-valeurs { grid-template-columns:repeat(2,1fr); }
    .lp-grid-roles   { grid-template-columns:1fr; }
    .lp-grid-etapes  { grid-template-columns:1fr; }
    .lp-grid-biens   { grid-template-columns:1fr; }
    .lp-nav-tag      { display:none !important; }
    .lp-section      { padding:56px 16px 44px !important; }
    .lp-section-valeurs   { padding:48px 16px !important; }
    .lp-section-roles     { padding:56px 16px !important; }
    .lp-section-cta       { padding:64px 16px !important; }
    .lp-section-inner     { margin-bottom:36px !important; }
  }

  @media (max-width:768px) {
    .lp-stats-card { display:none !important; }
  }

  @media (max-width:420px) {
    .lp-nav-cta { display:none !important; }
  }

  @keyframes lp-bounce {
    0%, 100% { transform: translateY(0); opacity: 0.6; }
    50%       { transform: translateY(5px); opacity: 1; }
  }
`;

// ── Component ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const markersRef   = useRef<Map<string, HTMLElement>>(new Map());

  const [scrolled,      setScrolled]     = useState(false);
  const [selected,      setSelected]     = useState<BienMarker | null>(null);
  const [isMobile,      setIsMobile]     = useState(false);
  const [panelVisible,  setPanelVisible] = useState(false);
  const [query,         setQuery]        = useState("");
  const [mapMode,       setMapMode]      = useState<"standard" | "satellite">("standard");

  // Navbar scroll opacity
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Mobile breakpoint
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Panel slide-in with rAF so CSS transition fires
  useEffect(() => {
    if (selected) {
      requestAnimationFrame(() => setPanelVisible(true));
    } else {
      setPanelVisible(false);
    }
  }, [selected]);

  // Mapbox init
  useEffect(() => {
    let map: any;

    (async () => {
      if (!mapContainer.current) return;
      const mapboxgl = (await import("mapbox-gl")).default;


      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

      map = new mapboxgl.Map({
        container:          mapContainer.current,
        style:              "mapbox://styles/mapbox/standard",
        center:             [7.0, 46.65],
        zoom:               7.2,
        minZoom:            5.5,
        maxZoom:            18,
        pitch:              40,
        bearing:            -8,
        antialias:          true,
        attributionControl: false,
      });

      mapRef.current = map;

      // Contrôles de navigation (zoom + rotation + tilt)
      map.addControl(new mapboxgl.NavigationControl({
        visualizePitch: true,
      }), "bottom-right");

      map.on("load", () => {
        // Style Standard — Default theme + Day preset
        map.setConfigProperty("basemap", "lightPreset",              "day");
        map.setConfigProperty("basemap", "colorTheme",               "default");
        map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
        map.setConfigProperty("basemap", "showTransitLabels",         false);
        map.setConfigProperty("basemap", "showPlaceLabels",           true);
        map.setConfigProperty("basemap", "showRoadLabels",            false);

        // Terrain 3D — relief des Alpes suisses
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });

        // Sky layer — ciel réaliste au-dessus des montagnes
        map.addLayer({
          id: "sky",
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0.0, 90.0],
            "sky-atmosphere-sun-intensity": 15,
          },
        });

        // Cantons
        map.addSource("cantons", { type: "geojson", data: "/cantons-suisse.json" });
        map.addLayer({
          id: "cantons-fill", type: "fill", source: "cantons",
          filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
          paint:  { "fill-color": ORANGE, "fill-opacity": 0.12 },
        });
        map.addLayer({
          id: "cantons-line", type: "line", source: "cantons",
          filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
          paint:  { "line-color": ORANGE, "line-width": 2, "line-opacity": 0.6 },
        });

        // Price markers
        BIENS_MARKERS.forEach(bien => {
          const el = document.createElement("div");
          // Élément racine neutre — Mapbox gère le positionnement
          el.style.cssText = `
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            width: auto;
            height: auto;
          `;
          el.innerHTML = `
            <div class="althy-bubble">CHF ${bien.prix}</div>
            <div class="althy-dot"></div>
          `;

          el.addEventListener("click", e => {
            e.stopPropagation();
            markersRef.current.forEach((m, id) => {
              const bubble = m.querySelector(".althy-bubble");
              if (bubble) bubble.classList.toggle("active", id === bien.id);
            });
            setSelected(bien);
          });

          markersRef.current.set(bien.id, el);

          new mapboxgl.Marker({ element: el, anchor: "bottom", offset: [0, 0] })
            .setLngLat([bien.lng, bien.lat])
            .addTo(map);
        });

        // Click sur la carte → fermer le panel
        map.on("click", () => {
          markersRef.current.forEach(m => {
            const bubble = m.querySelector(".althy-bubble");
            if (bubble) bubble.classList.remove("active");
          });
          setSelected(null);
        });
      });
    })();

    return () => {
      map?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const key    = query.trim().toLowerCase();
    const coords = CITY_COORDS[key];
    if (coords && mapRef.current) {
      mapRef.current.flyTo({ center: coords, zoom: 12, duration: 1800, essential: true });
    }
  }, [query]);

  const closePanel = useCallback(() => {
    markersRef.current.forEach(m => {
      const bubble = m.querySelector(".althy-bubble");
      if (bubble) bubble.classList.remove("active");
    });
    setSelected(null);
  }, []);

  const openBien = useCallback((bien: BienMarker) => {
    markersRef.current.forEach((m, id) => {
      const bubble = m.querySelector(".althy-bubble");
      if (bubble) bubble.classList.toggle("active", id === bien.id);
    });
    setSelected(bien);
  }, []);

  const toggleMapMode = useCallback(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const next = mapMode === "standard" ? "satellite" : "standard";

    if (next === "satellite") {
      map.setStyle("mapbox://styles/mapbox/satellite-streets-v12");
    } else {
      map.setStyle("mapbox://styles/mapbox/standard");
    }

    map.once("style.load", () => {
      if (next === "standard") {
        map.setConfigProperty("basemap", "lightPreset",              "day");
        map.setConfigProperty("basemap", "colorTheme",               "monochrome");
        map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
        map.setConfigProperty("basemap", "showTransitLabels",         false);
        map.setConfigProperty("basemap", "showRoadLabels",            false);
      }

      if (!map.getSource("mapbox-dem")) {
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });
      }

      if (!map.getSource("cantons")) {
        map.addSource("cantons", { type: "geojson", data: "/cantons-suisse.json" });
      }
      if (!map.getLayer("cantons-fill-active")) {
        map.addLayer({
          id: "cantons-fill-active", type: "fill", source: "cantons",
          slot: "bottom",
          filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
          paint: { "fill-color": "#E8602C", "fill-opacity": next === "satellite" ? 0.18 : 0.12 },
        });
        map.addLayer({
          id: "cantons-line-active", type: "line", source: "cantons",
          slot: "bottom",
          filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
          paint: { "line-color": "#E8602C", "line-width": 2, "line-opacity": 0.7 },
        });
      }
    });

    setMapMode(next);
  }, [mapMode]);

  const scrollToList = () =>
    document.getElementById("liste")?.scrollIntoView({ behavior: "smooth" });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <div style={{ fontFamily: sans, background: BG }}>

        {/* ════════════════════════════════════════════════════════════════
            NAVBAR — fixed, transparent → opaque on scroll
        ════════════════════════════════════════════════════════════════ */}
        <nav style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
          height: 62,
          display: "flex", alignItems: "center",
          padding: "0 24px", gap: 16,
          background:    scrolled ? "rgba(250,250,248,0.96)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom:  scrolled ? "1px solid rgba(26,22,18,0.07)" : "none",
          transition: "background 0.35s ease, border-color 0.35s ease",
        }}>
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
            <span style={{
              fontFamily: serif,
              fontSize: 21, fontWeight: 400, letterSpacing: "0.18em",
              color: scrolled ? ORANGE : "#fff",
              textShadow: scrolled ? "none" : "0 1px 10px rgba(0,0,0,0.30)",
              transition: "color 0.35s ease",
            }}>
              ALTHY
            </span>
          </Link>

          <div style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)",
            pointerEvents: "none",
          }}>
            <span className="lp-nav-tag" style={{
              fontFamily: sans, fontSize: 13, fontWeight: 500,
              color: scrolled ? MUTED : "rgba(255,255,255,0.85)",
              letterSpacing: "0.04em",
              transition: "color 0.35s ease",
            }}>
              Votre agent personnel
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: "auto" }}>
            <Link href="/login" style={{
              fontSize: 13, fontWeight: 500, textDecoration: "none",
              padding: "7px 14px",
              color: scrolled ? MUTED : "rgba(255,255,255,0.90)",
              transition: "color 0.35s ease",
            }}>
              Se connecter
            </Link>
            <Link href="/register" className="lp-nav-cta" style={{
              fontSize: 13, fontWeight: 600, textDecoration: "none",
              padding: "8px 18px", borderRadius: 10,
              background: scrolled ? ORANGE : "rgba(255,255,255,0.16)",
              color: "#fff",
              border: scrolled ? "none" : "1px solid rgba(255,255,255,0.35)",
              backdropFilter: scrolled ? "none" : "blur(8px)",
              boxShadow: scrolled ? "0 2px 12px rgba(232,96,44,0.30)" : "none",
              transition: "background 0.35s ease, box-shadow 0.35s ease",
            }}>
              Commencer gratuitement
            </Link>
          </div>
        </nav>

        {/* ════════════════════════════════════════════════════════════════
            HERO — fullscreen Mapbox map
        ════════════════════════════════════════════════════════════════ */}
        <section style={{ position: "relative", height: "100vh", overflow: "hidden" }}>

          {/* Mapbox canvas */}
          <div ref={mapContainer} style={{ position: "absolute", inset: 0 }} />

          {/* Top gradient for navbar readability */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 130,
            background: "linear-gradient(to bottom, rgba(20,16,12,0.50) 0%, transparent 100%)",
            pointerEvents: "none", zIndex: 5,
          }} />

          {/* Bottom gradient for search bar readability */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 200,
            background: "linear-gradient(to top, rgba(20,16,12,0.35) 0%, transparent 100%)",
            pointerEvents: "none", zIndex: 5,
          }} />

          {/* H1 hero — centré sur la map */}
          <div style={{
            position: "absolute",
            top: "28%", left: "50%",
            transform: "translateX(-50%)",
            textAlign: "center",
            zIndex: 10,
            pointerEvents: "none",
            width: "min(680px, calc(100vw - 48px))",
          }}>
            <h1 style={{
              fontFamily: serif,
              fontSize: "clamp(38px, 6vw, 78px)",
              fontWeight: 300,
              fontStyle: "normal",
              color: "#1A1208",
              textShadow: "0 1px 12px rgba(255,255,255,0.70)",
              margin: 0,
              letterSpacing: "-0.02em",
              lineHeight: 1.08,
            }}>
              Trouvez votre<br />
              <span style={{ color: "#E8602C" }}>chez-vous.</span>
            </h1>
            <p style={{
              fontFamily: sans,
              fontSize: "clamp(13px, 1.8vw, 17px)",
              color: "#5C5650",
              margin: "18px 0 0",
              fontWeight: 400,
              letterSpacing: "0.03em",
            }}>
              Suisse romande — Althy gère, vous décidez.
            </p>
          </div>

          {/* Stats card — top left */}
          <div className="lp-stats-card" style={{
            position: "absolute", top: 80, left: 20, zIndex: 10,
            background: "rgba(250,250,248,0.94)", backdropFilter: "blur(14px)",
            borderRadius: 14, padding: "14px 18px",
            border: "1px solid rgba(26,22,18,0.08)",
            boxShadow: "0 4px 24px rgba(26,22,18,0.14)",
          }}>
            <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 400, color: DARK, lineHeight: 1 }}>
              {BIENS_MARKERS.length}
            </div>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 500, marginTop: 3 }}>
              biens disponibles
            </div>
            <div style={{ fontSize: 11, color: ORANGE, fontWeight: 700, marginTop: 5 }}>
              5 villes actives
            </div>
          </div>

          {/* Search bar + action buttons — bottom center */}
          <div style={{
            position: "absolute",
            bottom: 72, left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            width: "min(500px, calc(100vw - 40px))",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          }}>
            <form onSubmit={handleSearch} style={{ position: "relative", width: "100%" }}>
              <Search
                size={15}
                style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: MUTED, pointerEvents: "none" }}
              />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher une ville… Genève, Lausanne, Sion"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "14px 120px 14px 42px",
                  borderRadius: 32, border: "none",
                  background: "rgba(250,250,248,0.97)",
                  backdropFilter: "blur(20px)",
                  fontSize: 14, color: DARK,
                  outline: "none",
                  boxShadow: "0 8px 36px rgba(26,22,18,0.22)",
                  fontFamily: sans,
                }}
              />
              <button
                type="submit"
                style={{
                  position: "absolute", right: 6, top: "50%",
                  transform: "translateY(-50%)",
                  padding: "7px 18px", borderRadius: 24,
                  background: ORANGE, color: "#fff",
                  border: "none", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: sans,
                }}
              >
                Chercher
              </button>
            </form>

            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/biens/swipe" style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 22,
                background: "rgba(26,22,18,0.78)", backdropFilter: "blur(10px)",
                color: "#fff", fontSize: 12, fontWeight: 600,
                textDecoration: "none",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.20)",
              }}>
                <Layers size={13} /> Mode Swipe
              </Link>
              <button
                onClick={scrollToList}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 22,
                  background: "rgba(250,250,248,0.94)", backdropFilter: "blur(10px)",
                  color: DARK, fontSize: 12, fontWeight: 600,
                  border: "1px solid rgba(26,22,18,0.12)",
                  cursor: "pointer", fontFamily: sans,
                  boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                }}
              >
                <List size={13} /> Liste ({BIENS_MARKERS.length})
              </button>
            </div>
          </div>

          {/* Toggle carte — bas gauche */}
          <div
            onClick={toggleMapMode}
            style={{
              position: "absolute", bottom: "2.5rem", left: "1rem", zIndex: 10,
              width: 72, height: 72,
              borderRadius: 12, overflow: "hidden",
              cursor: "pointer",
              border: "3px solid #FFFFFF",
              boxShadow: "0 2px 12px rgba(0,0,0,0.30)",
              transition: "transform 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
          >
            <img
              src={
                mapMode === "standard"
                  ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/7.0,46.65,6/72x72?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
                  : `https://api.mapbox.com/styles/v1/mapbox/standard/static/7.0,46.65,6/72x72?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
              }
              alt={mapMode === "standard" ? "Vue satellite" : "Vue carte"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "rgba(0,0,0,0.55)",
              color: "#fff", fontSize: 10, fontWeight: 600,
              textAlign: "center", padding: "3px 0",
              fontFamily: sans, letterSpacing: "0.04em",
            }}>
              {mapMode === "standard" ? "SATELLITE" : "STANDARD"}
            </div>
          </div>

          {/* Scroll indicator */}
          <div style={{
            position: "absolute", bottom: 18, left: "50%",
            transform: "translateX(-50%)", zIndex: 10,
          }}>
            <ChevronDown
              size={20}
              color="rgba(255,255,255,0.55)"
              style={{ animation: "lp-bounce 1.8s ease-in-out infinite" }}
            />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            DETAIL PANEL — bottom sheet (mobile) / right drawer (desktop)
        ════════════════════════════════════════════════════════════════ */}
        {selected && (
          <>
            {/* Backdrop */}
            <div
              onClick={closePanel}
              style={{
                position: "fixed", inset: 0, zIndex: 150,
                background: "rgba(26,22,18,0.42)",
                backdropFilter: "blur(2px)",
                opacity: panelVisible ? 1 : 0,
                transition: "opacity 0.25s ease",
              }}
            />

            {/* Panel */}
            <div style={{
              position: "fixed", zIndex: 160,
              ...(isMobile
                ? { left: 0, right: 0, bottom: 0, borderRadius: "20px 20px 0 0", maxHeight: "82vh", overflowY: "auto", transform: panelVisible ? "translateY(0)" : "translateY(100%)" }
                : { top: 0, right: 0, bottom: 0, width: 380, overflowY: "auto", transform: panelVisible ? "translateX(0)" : "translateX(100%)" }
              ),
              background: "#fff",
              boxShadow: isMobile ? "0 -8px 40px rgba(26,22,18,0.20)" : "-8px 0 40px rgba(26,22,18,0.15)",
              transition: "transform 0.30s cubic-bezier(0.25,0.46,0.45,0.94)",
              fontFamily: sans,
            }}>
              {/* Pull handle (mobile) */}
              {isMobile && (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(26,22,18,0.15)" }} />
                </div>
              )}

              {/* Header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: "1px solid rgba(26,22,18,0.07)",
              }}>
                <span style={{
                  fontSize: 11, color: selected.statut === "À louer" ? "#3A7A5A" : selected.statut === "À vendre" ? "#2563EB" : "#B45309",
                  fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                }}>
                  {selected.statut}
                </span>
                <button onClick={closePanel} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
                  <X size={18} color={MUTED} />
                </button>
              </div>

              {/* Photo */}
              <div style={{ height: 210, background: selected.gradient, position: "relative", flexShrink: 0 }}>
                {selected.verifie && (
                  <span style={{
                    position: "absolute", top: 12, right: 12,
                    background: "rgba(255,255,255,0.94)", color: ORANGE,
                    fontSize: 11, fontWeight: 700,
                    padding: "4px 10px", borderRadius: 6,
                    border: `1px solid ${ORANGE}`,
                  }}>
                    ✓ Vérifié Althy
                  </span>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: "22px 22px 28px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 8 }}>
                  <span style={{ fontFamily: serif, fontSize: 30, fontWeight: 300, color: DARK }}>
                    CHF {selected.prix}
                  </span>
                  <span style={{ fontSize: 14, color: MUTED }}>{selected.periode}</span>
                </div>

                <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: DARK }}>
                  {selected.adresse}
                </p>
                <p style={{ margin: "0 0 16px", fontSize: 13, color: MUTED }}>
                  {selected.ville}
                </p>

                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
                  {[`${selected.pieces} pièce${selected.pieces > 1 ? "s" : ""}`, `${selected.surface} m²`, selected.type].map(t => (
                    <span key={t} style={{
                      fontSize: 12, fontWeight: 500,
                      padding: "4px 10px", borderRadius: 6,
                      background: "rgba(26,22,18,0.05)", color: MUTED,
                    }}>
                      {t}
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 2, alignItems: "center", marginBottom: 24 }}>
                  {[1,2,3,4,5].map(i => (
                    <span key={i} style={{ color: i <= Math.round(selected.note) ? ORANGE : "#D4CEC8", fontSize: 15 }}>★</span>
                  ))}
                  <span style={{ fontSize: 12, color: MUTED, marginLeft: 5, fontWeight: 500 }}>{selected.note}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Link href="/register?role=locataire" style={{
                    display: "block", textAlign: "center",
                    padding: "14px 0", borderRadius: 12,
                    background: ORANGE, color: "#fff",
                    fontSize: 14, fontWeight: 700, textDecoration: "none",
                    boxShadow: "0 4px 18px rgba(232,96,44,0.32)",
                  }}>
                    Postuler — envoyer mon dossier
                  </Link>
                  <button
                    onClick={closePanel}
                    style={{
                      padding: "12px 0", borderRadius: 12,
                      border: "1.5px solid rgba(26,22,18,0.12)",
                      background: "transparent", color: DARK,
                      fontSize: 13, fontWeight: 500,
                      cursor: "pointer", fontFamily: sans,
                    }}
                  >
                    Voir d&apos;autres biens
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════
            LISTE DES BIENS
        ════════════════════════════════════════════════════════════════ */}
        <section id="liste" className="lp-section" style={{ maxWidth: 1100, margin: "0 auto", padding: "88px 24px 64px" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: ORANGE, textTransform: "uppercase", marginBottom: 12 }}>
              Suisse romande · Genève · Vaud · Valais
            </p>
            <h2 style={{ fontFamily: serif, fontSize: "clamp(26px,3.5vw,40px)", fontWeight: 300, color: DARK, margin: "0 0 12px" }}>
              Biens disponibles maintenant
            </h2>
            <p style={{ fontSize: 15, color: MUTED, margin: 0 }}>
              {BIENS_MARKERS.length} biens vérifiés, mis à jour en temps réel.
            </p>
          </div>

          <div className="lp-grid-biens">
            {BIENS_MARKERS.map(b => (
              <div
                key={b.id}
                onClick={() => openBien(b)}
                style={{
                  background: "#fff", borderRadius: 14, overflow: "hidden",
                  border: "0.5px solid rgba(26,22,18,0.07)",
                  boxShadow: "0 2px 16px rgba(26,22,18,0.05)",
                  cursor: "pointer",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(26,22,18,0.13)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 16px rgba(26,22,18,0.05)";
                }}
              >
                <div style={{ height: 180, background: b.gradient, position: "relative" }}>
                  <div style={{
                    position: "absolute", top: 10, left: 10,
                    background: b.statut === "À louer" ? "#3A7A5A" : b.statut === "À vendre" ? "#2563EB" : "#B45309",
                    color: "#fff", fontSize: 11, fontWeight: 700,
                    padding: "3px 9px", borderRadius: 6,
                  }}>
                    {b.statut}
                  </div>
                  {b.verifie && (
                    <div style={{
                      position: "absolute", top: 10, right: 10,
                      background: "rgba(255,255,255,0.92)",
                      color: ORANGE, fontSize: 10, fontWeight: 700,
                      padding: "3px 8px", borderRadius: 6,
                      border: `1px solid ${ORANGE}`,
                    }}>
                      ✓ Vérifié Althy
                    </div>
                  )}
                </div>
                <div style={{ padding: "14px 16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                    <span style={{ fontFamily: serif, fontSize: 22, fontWeight: 400, color: DARK }}>
                      CHF {b.prix}
                    </span>
                    <span style={{ fontSize: 13, color: MUTED }}>{b.periode}</span>
                  </div>
                  <p style={{ margin: "0 0 3px", fontSize: 13, color: DARK, fontWeight: 500 }}>{b.adresse}</p>
                  <p style={{ margin: "0 0 12px", fontSize: 12, color: MUTED }}>{b.ville}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[`${b.pieces}p`, `${b.surface} m²`, b.type].map(tag => (
                      <span key={tag} style={{
                        fontSize: 11, fontWeight: 500,
                        padding: "3px 8px", borderRadius: 5,
                        background: "rgba(26,22,18,0.05)", color: MUTED,
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 40 }}>
            <Link href="/biens" style={{
              display: "inline-block",
              padding: "12px 30px", borderRadius: 10,
              border: "1.5px solid rgba(26,22,18,0.14)",
              fontSize: 14, fontWeight: 600, color: DARK,
              textDecoration: "none",
            }}>
              Voir tous les biens →
            </Link>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            VALEURS
        ════════════════════════════════════════════════════════════════ */}
        <section className="lp-section-valeurs" style={{
          background: "#fff",
          borderTop: "1px solid rgba(26,22,18,0.06)",
          borderBottom: "1px solid rgba(26,22,18,0.06)",
          padding: "72px 24px",
        }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div className="lp-grid-valeurs">
              {VALEURS.map(v => (
                <div key={v.n} style={{ textAlign: "center", padding: "8px 12px" }}>
                  <div style={{ fontFamily: serif, fontSize: "clamp(32px,4vw,44px)", fontWeight: 300, color: ORANGE, lineHeight: 1, marginBottom: 4 }}>
                    {v.n}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: DARK, marginBottom: 8 }}>
                    {v.label}
                  </div>
                  <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.55, margin: 0, maxWidth: 200, marginLeft: "auto", marginRight: "auto" }}>
                    {v.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            COMMENT ÇA MARCHE
        ════════════════════════════════════════════════════════════════ */}
        <section className="lp-section" style={{ maxWidth: 1100, margin: "0 auto", padding: "88px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ fontFamily: serif, fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 300, color: DARK, margin: "0 0 12px" }}>
              Comment ça marche
            </h2>
            <p style={{ fontSize: 15, color: MUTED, margin: 0 }}>Trois étapes — deux minutes.</p>
          </div>
          <div className="lp-grid-etapes">
            {ETAPES.map(e => (
              <div key={e.n} style={{
                background: "#fff", border: "0.5px solid rgba(26,22,18,0.07)",
                borderRadius: 14, padding: "32px 28px",
                boxShadow: "0 2px 16px rgba(26,22,18,0.05)",
              }}>
                <div style={{ fontFamily: serif, fontSize: 48, fontWeight: 300, color: "rgba(232,96,44,0.15)", lineHeight: 1, marginBottom: 16 }}>
                  {e.n}
                </div>
                <h3 style={{ fontFamily: serif, fontSize: 20, fontWeight: 400, color: DARK, margin: "0 0 10px" }}>{e.titre}</h3>
                <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.65, margin: 0 }}>{e.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            RÔLES
        ════════════════════════════════════════════════════════════════ */}
        <section className="lp-section-roles" style={{ background: "rgba(26,22,18,0.02)", borderTop: "1px solid rgba(26,22,18,0.06)", padding: "88px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <h2 style={{ fontFamily: serif, fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 300, color: DARK, margin: "0 0 12px" }}>
                Un outil pour chaque acteur
              </h2>
              <p style={{ fontSize: 15, color: MUTED, margin: 0 }}>
                Pas un logiciel de plus — un assistant qui s&apos;adapte à votre rôle.
              </p>
            </div>
            <div className="lp-grid-roles">
              {ROLES.map(r => (
                <div key={r.titre} style={{
                  background: "#fff", border: "0.5px solid rgba(26,22,18,0.07)",
                  borderRadius: 14, padding: "28px 24px",
                  boxShadow: "0 2px 16px rgba(26,22,18,0.05)",
                  display: "flex", flexDirection: "column",
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${r.accent}14`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, marginBottom: 16, color: r.accent,
                  }}>
                    {r.icon}
                  </div>
                  <h3 style={{ fontFamily: serif, fontSize: 20, fontWeight: 400, color: DARK, margin: "0 0 8px" }}>{r.titre}</h3>
                  <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65, margin: "0 0 20px", flex: 1 }}>{r.desc}</p>
                  <div style={{ marginBottom: 18 }}>
                    <span style={{ fontFamily: serif, fontSize: 26, fontWeight: 300, color: r.accent }}>{r.prix}</span>
                    {r.periode && <span style={{ fontSize: 12, color: MUTED, marginLeft: 4 }}>{r.periode}</span>}
                    {r.note && <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>{r.note}</div>}
                  </div>
                  <Link href={r.href} style={{
                    display: "block", textAlign: "center",
                    padding: "9px 0", borderRadius: 9,
                    background: `${r.accent}12`, color: r.accent,
                    fontSize: 13, fontWeight: 600, textDecoration: "none",
                    border: `1px solid ${r.accent}28`,
                  }}>
                    {r.cta} →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            CTA BAND
        ════════════════════════════════════════════════════════════════ */}
        <section className="lp-section-cta" style={{ background: DARK, padding: "88px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(250,250,248,0.40)", marginBottom: 20 }}>
              Disponible maintenant
            </p>
            <h2 style={{ fontFamily: serif, fontSize: "clamp(28px,4.5vw,48px)", fontWeight: 300, lineHeight: 1.15, color: "#FAFAF8", margin: "0 0 16px" }}>
              Rejoignez l&apos;immobilier<br />qui vous ressemble
            </h2>
            <p style={{ fontSize: 15, color: "rgba(250,250,248,0.55)", margin: "0 0 36px", lineHeight: 1.6 }}>
              Propriétaires, agences, artisans, locataires — un seul écosystème.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/register" style={{
                padding: "13px 30px", borderRadius: 12,
                background: ORANGE, color: "#fff",
                fontSize: 15, fontWeight: 700, textDecoration: "none",
                boxShadow: "0 4px 20px rgba(232,96,44,0.35)",
              }}>
                Commencer gratuitement
              </Link>
              <Link href="/estimation" style={{
                padding: "13px 28px", borderRadius: 12,
                border: "1.5px solid rgba(250,250,248,0.20)",
                color: "rgba(250,250,248,0.80)",
                fontSize: 15, fontWeight: 500, textDecoration: "none",
              }}>
                Estimer mon bien
              </Link>
            </div>
          </div>
        </section>

        <Footer />

      </div>
    </>
  );
}
