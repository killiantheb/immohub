"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X, Sparkles } from "lucide-react";
import { C } from "@/lib/design-tokens";
import { AlthyLogo } from "@/components/AlthyLogo";
import { HeroConversational } from "@/components/landing/HeroConversational";
import { LandingChatPanel, type LandingTurnInfo } from "@/components/landing/LandingChatPanel";
import { TopographyOverlay } from "@/components/landing/TopographyOverlay";
import { Footer } from "@/components/landing/Footer";
import { LandingEstimation } from "@/components/landing/LandingEstimation";
import { LandingBiens }      from "@/components/landing/LandingBiens";
import { LandingPreuve }     from "@/components/landing/LandingPreuve";
import { SocialProof }       from "@/components/landing/SocialProof";
import { FeatureIA }         from "@/components/landing/FeatureIA";
import { FeatureBiens }      from "@/components/landing/FeatureBiens";
import { FeatureReseau }     from "@/components/landing/FeatureReseau";
import { PourQui }           from "@/components/landing/PourQui";
import { Testimonials }      from "@/components/landing/Testimonials";
import { Garanties }         from "@/components/landing/Garanties";
import { Tarifs }            from "@/components/landing/Tarifs";
import { CTAFinal }          from "@/components/landing/CTAFinal";
import { ProprioSolo }       from "@/components/landing/ProprioSolo";
import { AutonomieHighlight } from "@/components/landing/AutonomieHighlight";

// Mapbox GL requires hex — do not replace with CSS var
const PRUSSIAN_HEX = "#0F2E4C";
const GOLD_HEX     = "#C9A961";

const serif = "var(--font-serif)";
const sans  = "var(--font-sans)";
const API   = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const ACTIVE_CANTONS = ["Genève", "Vaud", "Valais", "Fribourg", "Neuchâtel", "Jura"];

// Ville → (coords, zoom)
const VILLE_FLY: Record<string, { center: [number, number]; zoom: number }> = {
  genève:    { center: [6.143, 46.204], zoom: 11.5 },
  lausanne:  { center: [6.632, 46.519], zoom: 11.5 },
  fribourg:  { center: [7.161, 46.806], zoom: 11.5 },
  neuchâtel: { center: [6.931, 46.992], zoom: 11.5 },
  sion:      { center: [7.359, 46.233], zoom: 11.5 },
  vaud:      { center: [6.63, 46.62],   zoom: 9.0 },
  valais:    { center: [7.4, 46.2],     zoom: 8.8 },
  montreux:  { center: [6.911, 46.433], zoom: 11.5 },
  vevey:     { center: [6.843, 46.463], zoom: 12 },
  nyon:      { center: [6.239, 46.383], zoom: 12 },
};

const ETAPES = [
  { n: "01", titre: "Posez votre question",     desc: "Althy IA comprend votre besoin — estimation, recherche, gestion. Pas de formulaire, pas de jargon." },
  { n: "02", titre: "Althy IA analyse",         desc: "Notre agent lit votre contexte et vous propose une réponse précise, ancrée dans le marché suisse." },
  { n: "03", titre: "Vous décidez",             desc: "Un clic pour valider. Althy exécute — document, annonce, coordination artisan, envoi d'email." },
] as const;

const CSS = `
  .lp-grid-etapes  { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
  @media (max-width:640px)  {
    .lp-grid-etapes  { grid-template-columns:1fr; }
    .lp-nav-tag      { display:none !important; }
    .lp-nav-cta      { display:none !important; }
    .lp-nav-burger   { display:flex !important; }
    .lp-hero-title   { font-size: clamp(30px, 8vw, 44px) !important; }
  }
  @keyframes lp-bounce {
    0%, 100% { transform:translateY(0); opacity:0.6; }
    50%       { transform:translateY(5px); opacity:1; }
  }
  @keyframes lp-pulse-gold {
    0%, 100% { opacity: 0.9; transform: scale(1); }
    50%      { opacity: 0.55; transform: scale(1.25); }
  }
`;

// ── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const mapContainer      = useRef<HTMLDivElement>(null);
  const mapRef            = useRef<any>(null);
  const pulseIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [stats,         setStats]         = useState<{ total_biens: number; total_villes: number } | null>(null);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [chatOpen,      setChatOpen]      = useState(false);
  const [pendingQ,      setPendingQ]      = useState<string | null>(null);
  const [hidden,        setHidden]        = useState(false); // hide hero text when chat opens or map interacted
  const [showFloating,  setShowFloating]  = useState(false); // floating "Parler à Althy IA" button post-hero

  // Fetch stats marketplace
  useEffect(() => {
    fetch(`${API}/marketplace/stats`)
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => null);
  }, []);

  // Mapbox init (dark style + gold points)
  useEffect(() => {
    let map: any;
    let ro: ResizeObserver | null = null;
    (async () => {
      if (!mapContainer.current) return;
      const mapboxgl = (await import("mapbox-gl")).default;
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
      map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [7.2, 46.6], zoom: 7.6,
        minZoom: 5.5, maxZoom: 18,
        pitch: 42, bearing: -8,
        antialias: true, attributionControl: false,
        interactive: true,
      });
      mapRef.current = map;
      map.resize();
      ro = new ResizeObserver(() => map.resize());
      ro.observe(mapContainer.current!);

      const onInteract = () => setHidden(true);
      map.on("dragstart", onInteract);
      map.on("zoomstart", onInteract);

      map.on("load", () => {
        // Terrain subtle
        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url:  "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512, maxzoom: 14,
        });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.3 });

        // Cantons glow (bleu Prusse)
        map.addSource("cantons", { type: "geojson", data: "/cantons-suisse.json" });
        map.addLayer({
          id: "romande-fill", type: "fill", source: "cantons",
          filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
          paint: { "fill-color": PRUSSIAN_HEX, "fill-opacity": 0.22 },
        });
        map.addLayer({
          id: "romande-border-glow", type: "line", source: "cantons",
          filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
          paint: { "line-color": PRUSSIAN_HEX, "line-width": 10, "line-opacity": 0.35, "line-blur": 8 },
        });
        map.addLayer({
          id: "romande-border", type: "line", source: "cantons",
          filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
          paint: { "line-color": GOLD_HEX, "line-width": 1.2, "line-opacity": 0.45 },
        });

        // Public biens (gold points)
        fetch(`${API}/marketplace/carte`)
          .then(r => r.json())
          .then(geojson => {
            if (!map || !geojson?.features) return;
            map.addSource("biens", { type: "geojson", data: geojson });

            // Halo (pulsating via JS loop)
            map.addLayer({
              id: "biens-glow", type: "circle", source: "biens",
              paint: {
                "circle-radius":  14,
                "circle-color":   GOLD_HEX,
                "circle-opacity": 0.28,
                "circle-blur":    1.2,
                "circle-radius-transition":  { duration: 1100 },
                "circle-opacity-transition": { duration: 1100 },
              },
            });

            // Highlight layer (only biens matching the detected city — hidden by default)
            map.addLayer({
              id: "biens-highlight", type: "circle", source: "biens",
              filter: ["==", ["get", "ville"], "__none__"],
              paint: {
                "circle-radius":  22,
                "circle-color":   GOLD_HEX,
                "circle-opacity": 0.6,
                "circle-blur":    0.9,
                "circle-stroke-color": GOLD_HEX,
                "circle-stroke-width": 2,
                "circle-stroke-opacity": 0.9,
              },
            });

            // Core point
            map.addLayer({
              id: "biens-core", type: "circle", source: "biens",
              paint: {
                "circle-radius":       4,
                "circle-color":        GOLD_HEX,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1,
                "circle-opacity":      0.95,
              },
            });

            // JS pulse loop — alternate glow radius/opacity
            let big = false;
            pulseIntervalRef.current = setInterval(() => {
              if (!mapRef.current || !mapRef.current.getLayer("biens-glow")) return;
              big = !big;
              mapRef.current.setPaintProperty("biens-glow", "circle-radius",  big ? 22 : 14);
              mapRef.current.setPaintProperty("biens-glow", "circle-opacity", big ? 0.12 : 0.34);
            }, 1100);
          })
          .catch(() => null);
      });
    })();
    return () => {
      ro?.disconnect();
      if (pulseIntervalRef.current) clearInterval(pulseIntervalRef.current);
      pulseIntervalRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Scroll-based floating "Parler à Althy IA" widget
  useEffect(() => {
    const onScroll = () => {
      const threshold = window.innerHeight * 0.85;
      setShowFloating(window.scrollY > threshold);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Handler from hero input & suggestion chips
  const handleHeroSubmit = useCallback((question: string) => {
    setPendingQ(question);
    setChatOpen(true);
    setHidden(true);
  }, []);

  // Chat intent → zoom map on relevant canton/ville + highlight matching biens
  const handleTurnUpdate = useCallback((info: LandingTurnInfo) => {
    const map = mapRef.current;
    if (!map) return;

    const villeRaw = info.entities.ville?.toLowerCase();
    if (!villeRaw) return;

    // Fly to city
    const key = villeRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const fly = VILLE_FLY[villeRaw] ?? VILLE_FLY[key];
    if (fly) {
      map.flyTo({ center: fly.center, zoom: fly.zoom, duration: 2000, essential: true });
    }

    // Highlight biens whose ville matches (case-insensitive contains)
    if (map.getLayer("biens-highlight")) {
      // Mapbox can't do ILIKE — we use downcase + == with both accented/unaccented forms
      const accented   = villeRaw.charAt(0).toUpperCase() + villeRaw.slice(1);
      const unaccented = key.charAt(0).toUpperCase() + key.slice(1);
      map.setFilter("biens-highlight", [
        "any",
        ["==", ["downcase", ["coalesce", ["get", "ville"], ""]], villeRaw],
        ["==", ["get", "ville"], accented],
        ["==", ["get", "ville"], unaccented],
      ]);
    }
  }, []);

  const closeChatAndReset = useCallback(() => {
    setChatOpen(false);
    setPendingQ(null);
    // Clear highlight
    if (mapRef.current?.getLayer("biens-highlight")) {
      mapRef.current.setFilter("biens-highlight", ["==", ["get", "ville"], "__none__"]);
    }
  }, []);

  const openChatFromFloating = useCallback(() => {
    setPendingQ(null);
    setChatOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const scrollToNext = () => document.getElementById("lp-next")?.scrollIntoView({ behavior: "smooth" });

  return (
    <>
      <style>{CSS}</style>
      <div style={{ fontFamily: sans, background: C.bg, width: "100%", overflowX: "hidden" }}>

        {/* ── Navbar ── */}
        <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 30 }}>
          <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px" }}>
            <Link href="/" style={{ textDecoration: "none", display: "inline-flex", filter: "drop-shadow(0 2px 18px rgba(15,46,76,0.5))" }}>
              <AlthyLogo variant="inverted" size={34} />
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link href="/login" style={{ fontSize: 13, textDecoration: "none", padding: "8px 18px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", color: "#fff", fontFamily: sans, fontWeight: 500 }}>
                Se connecter
              </Link>
              <Link href="/register" className="lp-nav-cta" style={{ fontSize: 13, fontWeight: 600, textDecoration: "none", padding: "8px 18px", borderRadius: 100, background: C.gold, color: C.prussian, boxShadow: "0 2px 12px rgba(201,169,97,0.45)", fontFamily: sans }}>
                Commencer
              </Link>
              <button
                className="lp-nav-burger"
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Menu"
                style={{ display: "none", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", cursor: "pointer", color: "#fff" }}
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div style={{ background: "rgba(15,46,76,0.96)", backdropFilter: "blur(20px)", padding: "16px 28px 20px", display: "flex", flexDirection: "column", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
              <Link href="/login" onClick={() => setMenuOpen(false)} style={{ fontSize: 14, textDecoration: "none", padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.25)", color: "#fff", fontFamily: sans, textAlign: "center" }}>
                Se connecter
              </Link>
              <Link href="/register" onClick={() => setMenuOpen(false)} style={{ fontSize: 14, fontWeight: 600, textDecoration: "none", padding: "12px 16px", borderRadius: 10, background: C.gold, color: C.prussian, fontFamily: sans, textAlign: "center" }}>
                Commencer gratuitement
              </Link>
            </div>
          )}
        </nav>

        {/* ── Hero — immersive full screen ── */}
        <section style={{ position: "relative", height: "100dvh", minHeight: 620, overflow: "hidden", width: "100vw", background: PRUSSIAN_HEX }}>
          <div ref={mapContainer} style={{ position: "absolute", inset: 0 }} />

          {/* Topographic pattern overlay (subtle gold contours drifting) */}
          <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}>
            <TopographyOverlay color="#C9A961" opacity={0.09} />
          </div>

          {/* Vignette + gradient overlays (prussian tint) */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse at center, rgba(15,46,76,0.25) 0%, rgba(15,46,76,0.55) 60%, rgba(15,46,76,0.80) 100%)",
            zIndex: 2,
          }} />
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 160,
            background: "linear-gradient(to bottom, rgba(15,46,76,0.75), transparent)",
            pointerEvents: "none", zIndex: 3,
          }} />
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 180,
            background: "linear-gradient(to top, rgba(15,46,76,0.85), transparent)",
            pointerEvents: "none", zIndex: 3,
          }} />

          {/* Hero conversational center */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 24px",
            zIndex: 10,
            pointerEvents: "none",
          }}>
            <div style={{ pointerEvents: "auto" }}>
              <HeroConversational onSubmit={handleHeroSubmit} visible={!hidden} />
            </div>
          </div>

          {/* Stats pill top-left */}
          {stats && (
            <div style={{
              position: "absolute", top: 82, left: 20, zIndex: 15,
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.14)",
              backdropFilter: "blur(18px)",
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 100, padding: "7px 14px",
              color: "#fff", fontFamily: sans, fontSize: 12, fontWeight: 500,
              letterSpacing: "0.02em",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold, animation: "lp-pulse-gold 2s ease-in-out infinite" }} />
              {stats.total_biens} biens actifs · {stats.total_villes} villes
            </div>
          )}

          {/* Scroll indicator */}
          <div
            onClick={scrollToNext}
            style={{
              position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
              zIndex: 10, cursor: "pointer", padding: 8,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              opacity: chatOpen ? 0 : 1,
              transition: "opacity 0.3s",
            }}
          >
            <span style={{ fontSize: 10, letterSpacing: "0.14em", color: "rgba(255,255,255,0.65)", fontFamily: sans, textTransform: "uppercase" }}>
              Découvrir
            </span>
            <ChevronDown size={22} color="rgba(255,255,255,0.8)" style={{ animation: "lp-bounce 1.8s ease-in-out infinite" }} />
          </div>
        </section>

        <div id="lp-next" />

        {/* ── Sections ── */}
        <SocialProof />
        <PourQui />

        {stats && (
          <div style={{ background: C.prussian, padding: "18px 24px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#fff", letterSpacing: "0.06em", fontFamily: sans }}>
              {stats.total_biens} biens gérés · {stats.total_villes} villes actives · 100% Suisse romande
            </p>
          </div>
        )}

        <AutonomieHighlight />
        <ProprioSolo />
        <LandingBiens />
        <LandingEstimation />
        <FeatureIA />
        <FeatureBiens />
        <FeatureReseau />

        {/* Comment ça marche */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "88px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ fontFamily: serif, fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 300, color: C.text, margin: "0 0 12px" }}>
              Comment ça marche
            </h2>
            <p style={{ fontSize: 15, color: C.textMuted, margin: 0 }}>
              Trois étapes — deux minutes.
            </p>
          </div>
          <div className="lp-grid-etapes">
            {ETAPES.map(e => (
              <div key={e.n} style={{ background: C.surface, border: `0.5px solid ${C.border}`, borderRadius: 14, padding: "32px 28px", boxShadow: C.shadow }}>
                <div style={{ fontFamily: serif, fontSize: 48, fontWeight: 300, color: "rgba(15,46,76,0.15)", lineHeight: 1, marginBottom: 16 }}>{e.n}</div>
                <h3 style={{ fontFamily: serif, fontSize: 20, fontWeight: 400, color: C.text, margin: "0 0 10px" }}>{e.titre}</h3>
                <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.65, margin: 0 }}>{e.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <Testimonials />
        <LandingPreuve />
        <Garanties />
        <Tarifs />
        <CTAFinal />
        <Footer />

        {/* Floating "Parler à Althy IA" — visible après scroll hero */}
        <button
          onClick={openChatFromFloating}
          aria-label="Parler à Althy IA"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 20px 14px 16px",
            borderRadius: 100,
            border: "none",
            background: C.prussian,
            color: "#fff",
            fontFamily: sans,
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: "0 10px 30px rgba(15,46,76,0.4), 0 4px 10px rgba(0,0,0,0.12)",
            opacity: showFloating && !chatOpen ? 1 : 0,
            transform: showFloating && !chatOpen ? "translateY(0) scale(1)" : "translateY(16px) scale(0.92)",
            transition: "opacity 300ms ease, transform 300ms ease",
            pointerEvents: showFloating && !chatOpen ? "auto" : "none",
          }}
        >
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28, height: 28,
            borderRadius: "50%",
            background: C.gold,
            color: C.prussian,
          }}>
            <Sparkles size={15} />
          </span>
          Parler à Althy IA
        </button>

        {/* Chat panel — slide from right */}
        <LandingChatPanel
          open={chatOpen}
          onClose={closeChatAndReset}
          initialQuestion={pendingQ}
          onTurnUpdate={handleTurnUpdate}
        />
      </div>
    </>
  );
}
