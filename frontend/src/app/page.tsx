"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Mic, SlidersHorizontal, ChevronDown, Menu, X } from "lucide-react";
import { C } from "@/lib/design-tokens";
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

// ── Tokens ─────────────────────────────────────────────────────────────────────
// Mapbox GL requires hex — do not replace with CSS var
const PRUSSIAN_HEX = "#0F2E4C";

const serif  = "var(--font-serif)";
const sans   = "var(--font-sans)";
const API    = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const ACTIVE_CANTONS = ["Genève", "Vaud", "Valais", "Fribourg", "Neuchâtel", "Jura"];

const CITY_COORDS: Record<string, [number, number]> = {
  "genève": [6.143, 46.204], "geneve": [6.143, 46.204],
  "lausanne": [6.632, 46.519], "fribourg": [7.161, 46.806],
  "neuchâtel": [6.931, 46.992], "neuchatel": [6.931, 46.992],
  "sion": [7.359, 46.233], "valais": [7.359, 46.233],
  "nyon": [6.239, 46.383], "montreux": [6.911, 46.433],
};

const ETAPES = [
  { n: "01", titre: "Inscrivez-vous",    desc: "Choisissez votre rôle en 2 minutes : propriétaire, agence, artisan, locataire. Aucune carte bancaire requise." },
  { n: "02", titre: "La Sphère analyse", desc: "Notre agent IA lit votre contexte chaque matin et vous propose des actions prioritaires à valider." },
  { n: "03", titre: "Vous décidez",      desc: "Un clic pour valider. Althy exécute — envoi d'email, génération de document, coordination artisan." },
] as const;

const CSS = `
  .lp-grid-etapes  { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
  @media (max-width:640px)  {
    .lp-grid-etapes  { grid-template-columns:1fr; }
    .lp-nav-tag      { display:none !important; }
    .lp-nav-cta      { display:none !important; }
    .lp-nav-burger   { display:flex !important; }
  }
  @media (max-width:768px) { .lp-stats-card { display:none !important; } }
  @keyframes lp-bounce {
    0%, 100% { transform:translateY(0); opacity:0.6; }
    50%       { transform:translateY(5px); opacity:1; }
  }
`;

// ── Component ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);

  const [query,        setQuery]       = useState("");
  const [mapMode,      setMapMode]     = useState<"standard" | "satellite">("standard");
  const [mapInteracted, setMapInteracted] = useState(false);
  const [stats, setStats] = useState<{ total_biens: number; total_villes: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Fetch stats marketplace
  useEffect(() => {
    fetch(`${API}/marketplace/stats`)
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => null);
  }, []);

  // Mapbox init
  useEffect(() => {
    let map: any;
    let ro: ResizeObserver | null = null;
    (async () => {
      if (!mapContainer.current) return;
      const mapboxgl = (await import("mapbox-gl")).default;
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
      map = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/standard",
        center: [7.5, 46.8], zoom: 7.2,
        minZoom: 5.5, maxZoom: 20,
        pitch: 50, bearing: -8,
        antialias: true, attributionControl: false,
      });
      mapRef.current = map;
      map.resize();
      ro = new ResizeObserver(() => map.resize());
      ro.observe(mapContainer.current!);
      const onInteract = () => setMapInteracted(true);
      map.on("dragstart", onInteract);
      map.on("zoomstart", onInteract);
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
      map.on("load", () => {
        map.addSource("mapbox-dem", { type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 512, maxzoom: 14 });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
        map.addSource("cantons", { type: "geojson", data: "/cantons-suisse.json" });
        map.addLayer({ id: "romande-fill", type: "fill", source: "cantons",
          filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
          paint: { "fill-color": PRUSSIAN_HEX, "fill-opacity": 0.10 } });
        map.addLayer({ id: "romande-border-glow", type: "line", source: "cantons",
          filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
          paint: { "line-color": PRUSSIAN_HEX, "line-width": 8, "line-opacity": 0.18, "line-blur": 6 } });
        map.addLayer({ id: "romande-border", type: "line", source: "cantons",
          filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
          paint: { "line-color": PRUSSIAN_HEX, "line-width": 2, "line-opacity": 0.85 } });
      });
    })();
    return () => { ro?.disconnect(); map?.remove(); mapRef.current = null; };
  }, []);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const coords = CITY_COORDS[query.trim().toLowerCase()];
    if (coords && mapRef.current) mapRef.current.flyTo({ center: coords, zoom: 12, duration: 1800, essential: true });
  }, [query]);

  const toggleMapMode = useCallback((next: "standard" | "satellite") => {
    if (!mapRef.current || next === mapMode) return;
    const map = mapRef.current;
    map.setStyle(next === "satellite"
      ? "mapbox://styles/mapbox/satellite-streets-v12"
      : "mapbox://styles/mapbox/standard");
    map.once("style.load", () => {
      if (next === "standard") {
        if (!map.getSource("mapbox-dem")) map.addSource("mapbox-dem", { type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 512, maxzoom: 14 });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.4 });
      }
      if (!map.getSource("cantons")) map.addSource("cantons", { type: "geojson", data: "/cantons-suisse.json" });
      if (!map.getLayer("romande-fill")) map.addLayer({ id: "romande-fill", type: "fill", source: "cantons",
        filter: ["in", ["get", "name"], ["literal", ACTIVE_CANTONS]],
        paint: { "fill-color": PRUSSIAN_HEX, "fill-opacity": next === "satellite" ? 0.18 : 0.09 } });
    });
    setMapMode(next);
  }, [mapMode]);

  const scrollToList = () => document.getElementById("liste")?.scrollIntoView({ behavior: "smooth" });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{CSS}</style>
      <div style={{ fontFamily: sans, background: C.bg, width: "100%", overflowX: "hidden" }}>

        {/* ── Navbar ── */}
        <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 30 }}>
          <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", background: "transparent" }}>
            <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
              <span style={{ fontFamily: serif, fontSize: 28, fontWeight: 400, letterSpacing: "0.22em", color: C.orange, textShadow: "0 2px 16px rgba(255,255,255,0.50)" }}>
                ALTHY
              </span>
            </Link>
            <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }}>
              <span className="lp-nav-tag" style={{ fontFamily: sans, fontSize: 11, letterSpacing: "0.14em", color: "var(--althy-surface)" }}>
                Votre agent personnel
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <Link href="/login" style={{ fontSize: 11, textDecoration: "none", padding: "7px 16px", borderRadius: 100, border: "1px solid rgba(26,18,8,0.20)", background: "rgba(255,255,255,0.60)", backdropFilter: "blur(12px)", color: "#1A1208", fontFamily: sans }}>
                Se connecter
              </Link>
              <Link href="/register" className="lp-nav-cta" style={{ fontSize: 11, fontWeight: 500, textDecoration: "none", padding: "7px 16px", borderRadius: 100, background: C.orange, color: "#fff", boxShadow: "0 2px 10px rgba(15,46,76,0.35)", fontFamily: sans }}>
                Commencer gratuitement
              </Link>
              <button
                className="lp-nav-burger"
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Menu"
                style={{ display: "none", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 10, border: "none", background: "rgba(255,255,255,0.60)", backdropFilter: "blur(12px)", cursor: "pointer", color: C.text }}
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)", padding: "16px 28px 20px", display: "flex", flexDirection: "column", gap: 10, borderBottom: `1px solid ${C.border}` }}>
              <Link href="/login" onClick={() => setMenuOpen(false)} style={{ fontSize: 14, textDecoration: "none", padding: "10px 16px", borderRadius: 10, border: `1px solid ${C.border}`, color: C.text, fontFamily: sans, textAlign: "center" }}>
                Se connecter
              </Link>
              <Link href="/register" onClick={() => setMenuOpen(false)} style={{ fontSize: 14, fontWeight: 600, textDecoration: "none", padding: "10px 16px", borderRadius: 10, background: C.orange, color: "#fff", fontFamily: sans, textAlign: "center" }}>
                Commencer gratuitement
              </Link>
            </div>
          )}
        </nav>

        {/* ── Hero — 60vh Mapbox ── */}
        <section style={{ position: "relative", height: "60dvh", minHeight: 480, overflow: "hidden", width: "100vw" }}>
          <div ref={mapContainer} style={{ position: "absolute", inset: 0 }} />

          {/* Gradients */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 130, background: "linear-gradient(to bottom, rgba(20,16,12,0.50) 0%, transparent 100%)", pointerEvents: "none", zIndex: 5 }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 160, background: "linear-gradient(to top, rgba(20,16,12,0.35) 0%, transparent 100%)", pointerEvents: "none", zIndex: 5 }} />

          {/* H1 */}
          <div style={{ position: "absolute", top: "26%", left: "50%", transform: "translateX(-50%)", textAlign: "center", zIndex: 10, pointerEvents: "none", width: "min(680px, calc(100vw - 48px))", opacity: mapInteracted ? 0 : 1, transition: "opacity 0.5s ease" }}>
            {/* A/B variant A (active) — propriétaire solo */}
            <h1 style={{ fontFamily: serif, fontSize: "clamp(40px,6vw,82px)", fontWeight: 300, color: "var(--althy-surface)", margin: 0, letterSpacing: "-0.03em", lineHeight: 1.02, textShadow: "0 2px 32px rgba(0,0,0,0.45)" }}>
              Votre bien, géré<br />
              <span style={{ color: C.orange, textShadow: "0 2px 24px rgba(15,46,76,0.35)" }}>sans agence.</span>
            </h1>
            {/* A/B variant B: « Gérez vos biens<br/>sans vous compliquer la vie. » */}
            {/* A/B variant C: « L'immobilier simplifié<br/>pour les propriétaires. » */}
            <p style={{ fontFamily: serif, fontSize: "clamp(13px,1.5vw,17px)", color: "rgba(255,255,255,0.65)", margin: "18px 0 0", fontWeight: 300, fontStyle: "italic", letterSpacing: "0.06em", textShadow: "0 1px 10px rgba(0,0,0,0.30)" }}>
              Suisse romande — Propriétaire, sans charge mentale.
            </p>
          </div>

          {/* Stats card */}
          <div className="lp-stats-card" style={{ position: "absolute", top: "4.25rem", left: "1.25rem", zIndex: 20, background: "rgba(255,255,255,0.75)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.85)", borderRadius: 14, padding: "14px 18px", boxShadow: "0 4px 20px rgba(0,0,0,0.07)", minWidth: 140 }}>
            <div style={{ fontFamily: serif, fontSize: 30, fontWeight: 300, color: C.text, lineHeight: 1 }}>
              {stats?.total_biens ?? "—"}
            </div>
            <div style={{ fontSize: 10, letterSpacing: "0.06em", color: C.textMuted, fontFamily: sans, marginTop: 2 }}>
              biens disponibles
            </div>
            <div style={{ fontSize: 11, color: C.orange, fontWeight: 700, marginTop: 5 }}>
              {stats?.total_villes ?? 5} villes actives
            </div>
          </div>

          {/* Micro-copy proprio */}
          <div style={{ position: "absolute", bottom: 100, left: "50%", transform: "translateX(-50%)", zIndex: 10, textAlign: "center", opacity: mapInteracted ? 0 : 1, transition: "opacity 0.5s ease" }}>
            <Link href="/register?role=proprio_solo" style={{ fontSize: 13, color: "rgba(255,255,255,0.70)", textDecoration: "none", fontFamily: sans, fontWeight: 500, textShadow: "0 1px 6px rgba(0,0,0,0.30)" }}>
              Déjà propriétaire ? <span style={{ color: C.orange, fontWeight: 600 }}>Commencer gratuitement →</span>
            </Link>
          </div>

          {/* Search bar */}
          <div style={{ position: "absolute", bottom: 52, left: "50%", transform: "translateX(-50%)", zIndex: 10, width: "min(580px, calc(100vw - 32px))" }}>
            <form onSubmit={handleSearch} style={{ position: "relative", width: "100%", display: "flex", alignItems: "center" }}>
              <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ville, quartier, adresse…"
                style={{ width: "100%", boxSizing: "border-box" as const, padding: "14px 160px 14px 20px", borderRadius: 32, border: "1.5px solid rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.82)", backdropFilter: "blur(20px)", fontSize: 14, color: C.text, outline: "none", boxShadow: "0 8px 32px rgba(26,22,18,0.18)", fontFamily: sans }} />
              <div style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 4 }}>
                <button type="button" disabled title="Bientôt disponible" style={{ width: 34, height: 34, borderRadius: "50%", background: "transparent", border: "none", color: C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "not-allowed", opacity: 0.4 }}>
                  <Mic size={15} />
                </button>
                <button type="button" disabled title="Bientôt disponible" style={{ width: 34, height: 34, borderRadius: "50%", background: "transparent", border: "none", color: C.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "not-allowed", opacity: 0.4 }}>
                  <SlidersHorizontal size={15} />
                </button>
                <div style={{ width: 1, height: 18, background: "rgba(26,22,18,0.15)" }} />
                <button type="submit" style={{ padding: "7px 16px", borderRadius: 24, background: C.orange, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: sans, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(15,46,76,0.35)" }}>
                  <Search size={14} />
                </button>
              </div>
            </form>
          </div>

          {/* Toggle carte */}
          <div style={{ position: "absolute", bottom: "2.5rem", left: "1.25rem", zIndex: 20, display: "flex", flexDirection: "column", gap: 3 }}>
            {(["standard", "satellite"] as const).map(mode => (
              <button key={mode} onClick={() => toggleMapMode(mode)} style={{ background: mapMode === mode ? C.text : "rgba(255,255,255,0.80)", backdropFilter: "blur(16px)", color: mapMode === mode ? "#fff" : C.textMuted, border: mapMode === mode ? `1px solid ${C.text}` : "1px solid rgba(255,255,255,0.90)", borderRadius: 9, padding: "7px 13px", fontSize: 9, fontWeight: 600, fontFamily: sans, letterSpacing: "0.09em", textTransform: "uppercase" as const, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.10)", transition: "all 0.18s" }}>
                {mode === "standard" ? "Standard" : "Satellite"}
              </button>
            ))}
          </div>

          {/* Scroll indicator */}
          <div onClick={scrollToList} style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", zIndex: 10, cursor: "pointer", padding: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 9, letterSpacing: "0.12em", color: "rgba(255,255,255,0.50)", fontFamily: sans, textTransform: "uppercase" as const }}>
              Découvrir
            </span>
            <ChevronDown size={22} color="rgba(255,255,255,0.65)" style={{ animation: "lp-bounce 1.8s ease-in-out infinite" }} />
          </div>
        </section>

        {/* ── Social Proof marquee ── */}
        <SocialProof />

        {/* ── Estimation IA ── */}
        <LandingEstimation />

        {/* ── Bandeau stats dynamique ── */}
        {stats && (
          <div style={{ background: C.orange, padding: "18px 24px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#fff", letterSpacing: "0.06em", fontFamily: sans }}>
              {stats.total_biens} biens gérés · {stats.total_villes} villes actives · 100% Suisse romande
            </p>
          </div>
        )}

        {/* ── Proprio solo — douleur + valeur ── */}
        <ProprioSolo />

        {/* ── Vrais biens ── */}
        <LandingBiens />

        {/* ── Feature : Assistant IA ── */}
        <FeatureIA />

        {/* ── Feature : Tableau de bord biens ── */}
        <FeatureBiens />

        {/* ── Feature : Réseau ouvreurs + artisans ── */}
        <FeatureReseau />

        {/* ── Comment ça marche ── */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "88px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ fontFamily: serif, fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 300, color: C.text, margin: "0 0 12px" }}>
              Comment ça marche
            </h2>
            <p style={{ fontSize: 15, color: C.textMuted, margin: 0 }}>Trois étapes — deux minutes.</p>
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

        {/* ── Pour qui ── */}
        <PourQui />

        {/* ── Témoignages ── */}
        <Testimonials />

        {/* ── Preuve sociale (chiffres) ── */}
        <LandingPreuve />

        {/* ── Garanties ── */}
        <Garanties />

        {/* ── Tarifs ── */}
        <Tarifs />

        {/* ── CTA final ── */}
        <CTAFinal />

        <Footer />
      </div>
    </>
  );
}
