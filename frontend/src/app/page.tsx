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
  tags_ia?: string[];
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
    verifie: true, note: 4.8, tags_ia: ["Rive gauche", "Vue lac", "Lumineux"],
  },
  {
    id: "l1", lng: 6.632, lat: 46.519,
    prix: "1'350", periode: "/mois",
    ville: "Lausanne", adresse: "Av. de la Gare 8 · Centre",
    type: "Studio", surface: 32, pieces: 1,
    statut: "À louer",
    gradient: "linear-gradient(135deg,#C4D8C4,#90B890)",
    verifie: true, note: 4.6, tags_ia: ["Centre-ville", "Transports", "Rénové"],
  },
  {
    id: "f1", lng: 7.161, lat: 46.806,
    prix: "1'580", periode: "/mois",
    ville: "Fribourg", adresse: "Grand-Rue 22 · Basse-Ville",
    type: "Appartement", surface: 55, pieces: 2,
    statut: "À louer",
    gradient: "linear-gradient(135deg,#E0D8C4,#C0A880)",
    verifie: false, note: 4.5, tags_ia: ["Vieille ville", "Calme", "Charme"],
  },
  {
    id: "n1", lng: 6.931, lat: 46.992,
    prix: "1'800", periode: "/mois",
    ville: "Neuchâtel", adresse: "Fbg de l'Hôpital 5 · Centre",
    type: "Appartement", surface: 80, pieces: 3,
    statut: "À louer",
    gradient: "linear-gradient(135deg,#C8C4E0,#9890B8)",
    verifie: false, note: 4.4, tags_ia: ["Vue lac", "Espace", "Lumineux"],
  },
  {
    id: "s1", lng: 7.359, lat: 46.233,
    prix: "980", periode: "/mois",
    ville: "Sion", adresse: "Pl. du Marché 3 · Centre",
    type: "Studio", surface: 38, pieces: 1,
    statut: "À louer",
    gradient: "linear-gradient(135deg,#C4D8C0,#90B080)",
    verifie: true, note: 4.7, tags_ia: ["Valais", "Montagne", "Animé"],
  },
  {
    id: "g2", lng: 6.185, lat: 46.218,
    prix: "3'400", periode: "/mois",
    ville: "Genève", adresse: "Route de Chêne 44 · Champel",
    type: "Villa", surface: 180, pieces: 5,
    statut: "À louer",
    gradient: "linear-gradient(135deg,#D4C8B8,#A89880)",
    verifie: true, note: 4.9, tags_ia: ["Villa", "Jardin", "Standing"],
  },
  {
    id: "l2", lng: 6.651, lat: 46.538,
    prix: "2'100", periode: "/mois",
    ville: "Lausanne", adresse: "Chemin des Pins 3 · Chailly",
    type: "Appartement", surface: 95, pieces: 4,
    statut: "À louer",
    gradient: "linear-gradient(135deg,#C0D0C0,#889880)",
    verifie: true, note: 4.6, tags_ia: ["Famille", "Calme", "Spacieux"],
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
  .lp-price-marker {
    display: inline-block;
    width: auto;
    max-width: max-content;
    align-items: center;
    background: ${ORANGE};
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    font-family: 'DM Sans', system-ui, sans-serif;
    padding: 5px 12px;
    border-radius: 20px;
    box-shadow: 0 2px 14px rgba(232,96,44,0.42);
    cursor: pointer;
    white-space: nowrap;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    border: 2px solid rgba(255,255,255,0.45);
    user-select: none;
    letter-spacing: 0.01em;
    position: relative;
  }
  .lp-price-marker::after {
    content: '';
    position: absolute;
    bottom: -7px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 7px solid ${ORANGE};
  }
  .lp-price-marker:hover { transform: scale(1.10) translateY(-2px); box-shadow: 0 6px 22px rgba(232,96,44,0.55); }
  .lp-price-marker.active { background: ${DARK}; transform: scale(1.12) translateY(-3px); box-shadow: 0 8px 26px rgba(26,22,18,0.40); }
  .lp-price-marker.active::after { border-top-color: ${DARK}; }

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
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(12px); }
    to   { opacity: 1; transform: translateX(0); }
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
  const [mapInteracted, setMapInteracted] = useState(false);

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
        center:             [7.5, 46.8],
        zoom:               7.2,
        minZoom:            5.5,
        maxZoom:            16,
        pitch:              50,
        bearing:            -8,
        antialias:          true,
        attributionControl: false,
      });

      mapRef.current = map;

      const handleInteraction = () => setMapInteracted(true);
      map.on("dragstart",   handleInteraction);
      map.on("zoomstart",   handleInteraction);
      map.on("pitchstart",  handleInteraction);
      map.on("rotatestart", handleInteraction);

      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");

      map.on("load", () => {

        // ── Style Standard — Day, Default, sans POI/transit/roads ────────────
        map.setConfigProperty("basemap", "lightPreset",              "day");
        map.setConfigProperty("basemap", "colorTheme",               "default");
        map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
        map.setConfigProperty("basemap", "showTransitLabels",         false);
        map.setConfigProperty("basemap", "showRoadLabels",            false);

        // ── Terrain 3D — relief des Alpes ────────────────────────────────────
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });

        // ── MASQUE MONDIAL avec trous aux contours suisses ───────────────────
        map.addSource("world-mask", { type: "geojson", data: "/suisse-mask.json" });
        map.addLayer({
          id: "world-mask-layer", type: "fill", source: "world-mask",
          slot: "top",
          paint: { "fill-color": "#FAFAF8", "fill-opacity": 0.38 },
        });

        // ── CONTOUR ORANGE PARFAIT DE LA SUISSE ──────────────────────────────
        map.addSource("swiss-union", { type: "geojson", data: "/suisse-union.json" });
        map.addLayer({
          id: "swiss-border", type: "line", source: "swiss-union",
          slot: "top",
          paint: { "line-color": "#E8602C", "line-width": 2.5, "line-opacity": 0.80 },
        });

        // ── FILL ORANGE LÉGER — SUISSE ROMANDE uniquement ────────────────────
        map.addSource("cantons", { type: "geojson", data: "/cantons-suisse.json" });
        map.addLayer({
          id: "cantons-romands-fill", type: "fill", source: "cantons",
          slot: "top",
          filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
          paint: { "fill-color": "#E8602C", "fill-opacity": 0.09 },
        });

        // ── MARKERS PRIX ──────────────────────────────────────────────────────
        BIENS_MARKERS.forEach(bien => {
          const wrapper = document.createElement("div");
          wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;width:max-content;";

          const el = document.createElement("div");
          el.className = "lp-price-marker";
          el.textContent = `CHF ${bien.prix}${bien.periode === "/mois" ? "/m" : ""}`;

          wrapper.appendChild(el);

          el.addEventListener("click", e => {
            e.stopPropagation();
            markersRef.current.forEach((m, id) => m.classList.toggle("active", id === bien.id));
            setSelected(bien);
          });

          markersRef.current.set(bien.id, el);
          new mapboxgl.Marker({ element: wrapper, anchor: "bottom" })
            .setLngLat([bien.lng, bien.lat])
            .addTo(map);
        });

        map.on("click", () => {
          markersRef.current.forEach(m => m.classList.remove("active"));
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
    markersRef.current.forEach(m => m.classList.remove("active"));
    setSelected(null);
  }, []);

  const openBien = useCallback((bien: BienMarker) => {
    markersRef.current.forEach((m, id) => m.classList.toggle("active", id === bien.id));
    setSelected(bien);
  }, []);

  const toggleMapMode = useCallback((next: "standard" | "satellite") => {
    if (!mapRef.current || next === mapMode) return;
    const map = mapRef.current;

    if (next === "satellite") {
      map.setStyle("mapbox://styles/mapbox/satellite-streets-v12");
    } else {
      map.setStyle("mapbox://styles/mapbox/standard");
    }

    map.once("style.load", () => {
      if (next === "standard") {
        map.setConfigProperty("basemap", "lightPreset",              "day");
        map.setConfigProperty("basemap", "colorTheme",               "default");
        map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
        map.setConfigProperty("basemap", "showTransitLabels",         false);
        map.setConfigProperty("basemap", "showRoadLabels",            false);
        if (!map.getSource("mapbox-dem")) {
          map.addSource("mapbox-dem", {
            type: "raster-dem",
            url: "mapbox://mapbox.mapbox-terrain-dem-v1",
            tileSize: 512, maxzoom: 14,
          });
        }
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });
      }

      // Masque mondial
      if (!map.getSource("world-mask")) {
        map.addSource("world-mask", { type: "geojson", data: "/suisse-mask.json" });
      }
      map.addLayer({
        id: "world-mask-layer", type: "fill", source: "world-mask",
        slot: "top",
        paint: { "fill-color": "#FAFAF8", "fill-opacity": next === "satellite" ? 0 : 0.38 },
      });

      // Contour orange Suisse
      if (!map.getSource("swiss-union")) {
        map.addSource("swiss-union", { type: "geojson", data: "/suisse-union.json" });
      }
      map.addLayer({
        id: "swiss-border", type: "line", source: "swiss-union",
        slot: "top",
        paint: { "line-color": "#E8602C", "line-width": 2.5, "line-opacity": 0.80 },
      });

      // Fill orange léger Suisse romande
      if (!map.getSource("cantons")) {
        map.addSource("cantons", { type: "geojson", data: "/cantons-suisse.json" });
      }
      map.addLayer({
        id: "cantons-romands-fill", type: "fill", source: "cantons",
        slot: "top",
        filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
        paint: { "fill-color": "#E8602C", "fill-opacity": next === "satellite" ? 0.18 : 0.09 },
      });
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
          position: "fixed", top: 0, left: 0, right: 0,
          height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 28px",
          zIndex: 30,
          background: "transparent",
          backdropFilter: "none",
          border: "none",
        }}>
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
            <span style={{
              fontFamily: serif,
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: "0.22em",
              color: ORANGE,
              textShadow: "0 2px 16px rgba(255,255,255,0.50)",
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
              fontFamily: "var(--font-sans, system-ui)",
              fontSize: 11, letterSpacing: "0.14em",
              color: ORANGE,
            }}>
              Votre agent personnel
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Link href="/login" style={{
              fontSize: 11, fontWeight: 400, textDecoration: "none",
              padding: "7px 16px", borderRadius: 100,
              border: "1px solid rgba(26,18,8,0.20)",
              background: "rgba(255,255,255,0.60)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              color: "#1A1208",
              fontFamily: "var(--font-sans, system-ui)",
            }}>
              Se connecter
            </Link>
            <Link href="/register" className="lp-nav-cta" style={{
              fontSize: 11, fontWeight: 500, textDecoration: "none",
              padding: "7px 16px", borderRadius: 100,
              background: ORANGE, color: "#fff", border: "none",
              fontFamily: "var(--font-sans, system-ui)",
              boxShadow: "0 2px 10px rgba(232,96,44,0.35)",
            }}>
              Commencer gratuitement
            </Link>
          </div>
        </nav>

        {/* ════════════════════════════════════════════════════════════════
            HERO — fullscreen Mapbox map
        ════════════════════════════════════════════════════════════════ */}
        <section style={{ position: "relative", height: "100vh", overflow: "hidden" }}>

          {/* Mapbox canvas — dépasse de 50px pour cacher le logo Mapbox sous le fold */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: "-50px" }}>
            <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
          </div>

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
            opacity: mapInteracted ? 0 : 1,
            transition: "opacity 0.5s ease",
          }}>
            <h1 style={{
              fontFamily: serif,
              fontSize: "clamp(44px, 6vw, 88px)",
              fontWeight: 300,
              fontStyle: "normal",
              color: "#FFFFFF",
              margin: 0,
              letterSpacing: "-0.03em",
              lineHeight: 1.02,
              textShadow: "0 2px 32px rgba(0,0,0,0.45), 0 1px 6px rgba(0,0,0,0.25)",
            }}>
              Trouvez votre<br />
              <span style={{
                color: ORANGE,
                fontWeight: 300,
                letterSpacing: "-0.03em",
                textShadow: "0 2px 24px rgba(232,96,44,0.35)",
              }}>
                chez‑vous.
              </span>
            </h1>
            <p style={{
              fontFamily: serif,
              fontSize: "clamp(14px, 1.5vw, 18px)",
              color: "rgba(255,255,255,0.65)",
              margin: "20px 0 0",
              fontWeight: 300,
              fontStyle: "italic",
              letterSpacing: "0.06em",
              textShadow: "0 1px 10px rgba(0,0,0,0.30)",
            }}>
              Suisse romande — Althy gère, vous décidez.
            </p>
          </div>

          {/* Stats card — top left */}
          <div className="lp-stats-card" style={{
            position: "absolute",
            top: "4.25rem", left: "1.25rem",
            zIndex: 20,
            background: "rgba(255,255,255,0.75)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.85)",
            borderRadius: 14,
            padding: "14px 18px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
            minWidth: 140,
          }}>
            <div style={{
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontSize: 30, fontWeight: 300,
              color: "#1A1208", lineHeight: 1,
            }}>
              {BIENS_MARKERS.length}
            </div>
            <div style={{
              fontSize: 10, letterSpacing: "0.06em",
              color: "rgba(26,18,8,0.45)",
              fontFamily: "var(--font-sans, system-ui)",
              marginTop: 2,
            }}>
              biens disponibles
            </div>
            <div style={{ fontSize: 11, color: ORANGE, fontWeight: 700, marginTop: 5 }}>
              5 villes actives
            </div>
          </div>

          {/* Search bar premium — filtres + micro IA */}
          <div style={{
            position: "absolute",
            bottom: 72, left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            width: "min(620px, calc(100vw - 32px))",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          }}>

            {/* Barre principale */}
            <form onSubmit={handleSearch} style={{ position: "relative", width: "100%" }}>
              <Search
                size={15}
                style={{
                  position: "absolute", left: 16, top: "50%",
                  transform: "translateY(-50%)",
                  color: MUTED, pointerEvents: "none", zIndex: 2,
                }}
              />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Ville, quartier, code postal…"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "15px 200px 15px 44px",
                  borderRadius: 32, border: "none",
                  background: "rgba(250,250,248,0.97)",
                  backdropFilter: "blur(20px)",
                  fontSize: 14, color: DARK,
                  outline: "none",
                  boxShadow: "0 8px 36px rgba(26,22,18,0.22)",
                  fontFamily: sans,
                }}
              />
              <div style={{
                position: "absolute", right: 6, top: "50%",
                transform: "translateY(-50%)",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <div style={{ width: 1, height: 20, background: "rgba(26,22,18,0.12)", marginRight: 4 }} />
                <button
                  type="button"
                  title="Parler à Althy IA"
                  onClick={() => { window.location.href = "/register"; }}
                  style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: "rgba(232,96,44,0.10)",
                    border: "1.5px solid rgba(232,96,44,0.25)",
                    color: ORANGE,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "all 0.2s", flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(232,96,44,0.18)";
                    e.currentTarget.style.borderColor = ORANGE;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(232,96,44,0.10)";
                    e.currentTarget.style.borderColor = "rgba(232,96,44,0.25)";
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="4.5" y="1" width="5" height="8" rx="2.5" fill="#E8602C"/>
                    <path d="M2 7.5c0 2.76 2.24 5 5 5s5-2.24 5-5" stroke="#E8602C" strokeWidth="1.3" strokeLinecap="round"/>
                    <line x1="7" y1="12.5" x2="7" y2="14" stroke="#E8602C" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "7px 18px", borderRadius: 24,
                    background: ORANGE, color: "#fff",
                    border: "none", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: sans, flexShrink: 0,
                    boxShadow: "0 2px 10px rgba(232,96,44,0.35)",
                  }}
                >
                  Chercher
                </button>
              </div>
            </form>

            {/* Filtres rapides */}
            <div style={{
              display: "flex", gap: 6, alignItems: "center",
              flexWrap: "nowrap", overflowX: "auto",
            }}>
              {[
                { label: "Location", value: "location" },
                { label: "Vente",    value: "vente" },
                { label: "Colocation", value: "colocation" },
              ].map(f => (
                <button
                  key={f.value}
                  type="button"
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 14px", borderRadius: 20,
                    background: "rgba(250,250,248,0.85)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.35)",
                    color: DARK, fontSize: 11.5, fontWeight: 500,
                    cursor: "pointer", fontFamily: sans,
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = ORANGE;
                    e.currentTarget.style.color = "#fff";
                    e.currentTarget.style.borderColor = ORANGE;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(250,250,248,0.85)";
                    e.currentTarget.style.color = DARK;
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)";
                  }}
                >
                  {f.label}
                </button>
              ))}
              <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
              <button
                type="button"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 14px", borderRadius: 20,
                  background: "rgba(250,250,248,0.85)", backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.35)",
                  color: DARK, fontSize: 11.5, fontWeight: 500,
                  cursor: "pointer", fontFamily: sans,
                  whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                }}
              >
                Budget
              </button>
              <button
                type="button"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 14px", borderRadius: 20,
                  background: "rgba(250,250,248,0.85)", backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.35)",
                  color: DARK, fontSize: 11.5, fontWeight: 500,
                  cursor: "pointer", fontFamily: sans,
                  whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                }}
              >
                Pièces
              </button>
              <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
              <Link href="/biens/swipe" style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 14px", borderRadius: 20,
                background: "rgba(26,22,18,0.75)", backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff", fontSize: 11.5, fontWeight: 600,
                textDecoration: "none", whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              }}>
                <Layers size={12} /> Mode Swipe
              </Link>
              <button
                onClick={scrollToList}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 14px", borderRadius: 20,
                  background: "rgba(250,250,248,0.85)", backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.35)",
                  color: DARK, fontSize: 11.5, fontWeight: 500,
                  cursor: "pointer", fontFamily: sans,
                  whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                }}
              >
                <List size={12} /> Liste ({BIENS_MARKERS.length})
              </button>
            </div>
          </div>

          {/* Panel détail — haut droite */}
          {selected && (
            <div style={{
              position: "absolute",
              top: "4.25rem", right: "1.25rem",
              zIndex: 25,
              width: 220,
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.90)",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              animation: "slideInRight 0.25s ease",
            }}>
              {/* Image */}
              <div style={{
                height: 110,
                background: selected.gradient,
                position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{
                  position: "absolute", top: 8, left: 8,
                  background: "#E8602C", color: "#fff",
                  fontSize: 8, fontWeight: 700,
                  padding: "3px 8px", borderRadius: 4,
                  fontFamily: "system-ui", letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}>{selected.statut}</span>
                <button onClick={closePanel} style={{
                  position: "absolute", top: 8, right: 8,
                  background: "rgba(0,0,0,0.35)", border: "none",
                  borderRadius: "50%", width: 24, height: 24,
                  color: "#fff", cursor: "pointer", fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  lineHeight: 1,
                }}>×</button>
              </div>

              {/* Corps */}
              <div style={{ padding: "14px 16px" }}>
                <div>
                  <span style={{
                    fontFamily: "var(--font-serif, Georgia, serif)",
                    fontSize: 22, fontWeight: 300, color: "#E8602C",
                  }}>CHF {selected.prix}</span>
                  <span style={{
                    fontSize: 10, color: "rgba(26,18,8,0.40)",
                    fontFamily: "system-ui", marginLeft: 3,
                  }}>/mois</span>
                </div>
                <div style={{
                  fontSize: 11, color: "#1A1208",
                  fontFamily: "system-ui", lineHeight: 1.5, marginTop: 4,
                }}>
                  {selected.adresse}<br />
                  {selected.ville} · {selected.pieces}p · {selected.surface}m²
                </div>
                {(selected.tags_ia?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                    {selected.tags_ia!.slice(0, 3).map(tag => (
                      <span key={tag} style={{
                        fontSize: 8.5, padding: "2px 7px", borderRadius: 10,
                        background: "rgba(232,96,44,0.09)", color: "#E8602C",
                        fontFamily: "system-ui", letterSpacing: "0.04em",
                      }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* CTA */}
              <a href={`/biens/${selected.id}`} style={{
                display: "block", margin: "0 16px 14px",
                background: "#1A1208", color: "#fff",
                borderRadius: 20, padding: "9px 0",
                fontSize: 10, fontWeight: 600,
                fontFamily: "system-ui", letterSpacing: "0.04em",
                textAlign: "center", textDecoration: "none",
              }}>
                Je suis intéressé →
              </a>
            </div>
          )}

          {/* Toggle carte — bas gauche */}
          <div style={{
            position: "absolute", bottom: "2.5rem", left: "1.25rem",
            zIndex: 20, display: "flex", flexDirection: "column", gap: 3,
          }}>
            <button
              onClick={() => toggleMapMode("standard")}
              style={{
                background: mapMode === "standard" ? "#1A1208" : "rgba(255,255,255,0.80)",
                backdropFilter: "blur(16px)",
                color: mapMode === "standard" ? "#fff" : "rgba(26,18,8,0.60)",
                border: mapMode === "standard" ? "1px solid #1A1208" : "1px solid rgba(255,255,255,0.90)",
                borderRadius: 9, padding: "7px 13px",
                fontSize: 9, fontWeight: 600,
                fontFamily: "system-ui", letterSpacing: "0.09em",
                textTransform: "uppercase", cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                transition: "all 0.18s",
              }}
            >
              Standard
            </button>
            <button
              onClick={() => toggleMapMode("satellite")}
              style={{
                background: mapMode === "satellite" ? "#1A1208" : "rgba(255,255,255,0.80)",
                backdropFilter: "blur(16px)",
                color: mapMode === "satellite" ? "#fff" : "rgba(26,18,8,0.60)",
                border: mapMode === "satellite" ? "1px solid #1A1208" : "1px solid rgba(255,255,255,0.90)",
                borderRadius: 9, padding: "7px 13px",
                fontSize: 9, fontWeight: 600,
                fontFamily: "system-ui", letterSpacing: "0.09em",
                textTransform: "uppercase", cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                transition: "all 0.18s",
              }}
            >
              Satellite
            </button>
          </div>

          {/* Scroll indicator */}
          <div
            onClick={scrollToList}
            style={{
              position: "absolute", bottom: 22, left: "50%",
              transform: "translateX(-50%)", zIndex: 10,
              cursor: "pointer", padding: "8px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}
          >
            <span style={{
              fontSize: 9, letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.50)",
              fontFamily: sans, textTransform: "uppercase",
            }}>
              Découvrir
            </span>
            <ChevronDown
              size={22}
              color="rgba(255,255,255,0.65)"
              style={{ animation: "lp-bounce 1.8s ease-in-out infinite" }}
            />
          </div>
        </section>

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
