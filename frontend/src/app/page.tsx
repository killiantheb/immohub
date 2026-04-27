"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { C } from "@/lib/design-tokens";
import { AlthyLogo } from "@/components/AlthyLogo";
import { SwitzerlandBackground } from "@/components/landing/SwitzerlandBackground";
import { HeroInput }              from "@/components/landing/HeroInput";
import { InlineChat }             from "@/components/landing/InlineChat";
import { FloatingChatBubble }     from "@/components/landing/FloatingChatBubble";
import { Footer }                 from "@/components/landing/Footer";
import { LandingEstimation }      from "@/components/landing/LandingEstimation";
// Phase 1 : marketplace publique masquée — LandingBiens retiré de la landing.
// import { LandingBiens }           from "@/components/landing/LandingBiens";
import { LandingPreuve }          from "@/components/landing/LandingPreuve";
import { SocialProof }            from "@/components/landing/SocialProof";
import { FeatureIA }              from "@/components/landing/FeatureIA";
import { FeatureBiens }           from "@/components/landing/FeatureBiens";
import { FeatureReseau }          from "@/components/landing/FeatureReseau";
import { PourQui }                from "@/components/landing/PourQui";
import { Testimonials }           from "@/components/landing/Testimonials";
import { Garanties }              from "@/components/landing/Garanties";
import { Tarifs }                 from "@/components/landing/Tarifs";
import { CTAFinal }               from "@/components/landing/CTAFinal";
import { ProprioSolo }            from "@/components/landing/ProprioSolo";
import { AutonomieHighlight }     from "@/components/landing/AutonomieHighlight";

const PRUSSIAN_HEX = "#0F2E4C";
const serif = "var(--font-serif)";
const sans  = "var(--font-sans)";
const API   = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const ETAPES = [
  { n: "01", titre: "Posez votre question",     desc: "Althy IA comprend votre besoin — estimation, recherche, gestion. Pas de formulaire, pas de jargon." },
  { n: "02", titre: "Althy IA analyse",         desc: "Notre agent lit votre contexte et vous propose une réponse précise, ancrée dans le marché suisse." },
  { n: "03", titre: "Vous décidez",             desc: "Un clic pour valider. Althy exécute — document, annonce, coordination artisan, envoi d'email." },
] as const;

const CSS = `
  .lp-grid-etapes { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
  @media (max-width:640px) {
    .lp-grid-etapes { grid-template-columns:1fr; }
    .lp-nav-cta     { display:none !important; }
    .lp-nav-burger  { display:flex !important; }
  }
  @keyframes lp-bounce {
    0%, 100% { transform:translateY(0); opacity:0.6; }
    50%      { transform:translateY(5px); opacity:1; }
  }
  @keyframes lp-pulse-gold {
    0%, 100% { opacity: 0.9; transform: scale(1);    }
    50%      { opacity: 0.55; transform: scale(1.25); }
  }
`;

export default function LandingPage() {
  const [stats, setStats]         = useState<{ total_biens: number; total_villes: number } | null>(null);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [chatQ, setChatQ]         = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/marketplace/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => null);
  }, []);

  const handleHeroSubmit = useCallback((q: string) => {
    setChatQ(q);
  }, []);

  const closeChat = useCallback(() => setChatQ(null), []);

  const openFloatingChat = useCallback(() => {
    setChatQ("");
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
                onClick={() => setMenuOpen((o) => !o)}
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

        {/* ── Hero — Bleu de Prusse + contour or Suisse + input/chat centré ── */}
        <section
          id="hero"
          style={{
            position: "relative",
            height: "100dvh",
            minHeight: 620,
            overflow: "hidden",
            width: "100vw",
            background: PRUSSIAN_HEX,
          }}
        >
          <SwitzerlandBackground />

          {/* Stats pill top-left */}
          {stats && (
            <div style={{
              position: "absolute", top: 82, left: 20, zIndex: 15,
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(18px)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 100, padding: "7px 14px",
              color: "#fff", fontFamily: sans, fontSize: 12, fontWeight: 500,
              letterSpacing: "0.02em",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold, animation: "lp-pulse-gold 2s ease-in-out infinite" }} />
              {stats.total_biens} biens actifs · {stats.total_villes} villes
            </div>
          )}

          {/* Centre — HeroInput OU InlineChat (même position, swap animé) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 16px",
              zIndex: 10,
            }}
          >
            <AnimatePresence mode="wait">
              {chatQ === null ? (
                <div key="hero-input" style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                  <HeroInput onSubmit={handleHeroSubmit} />
                </div>
              ) : (
                <InlineChat key="inline-chat" initialQuestion={chatQ} onClose={closeChat} />
              )}
            </AnimatePresence>
          </div>

          {/* Scroll indicator */}
          <div
            onClick={scrollToNext}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") scrollToNext(); }}
            style={{
              position: "absolute",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10,
              cursor: "pointer",
              padding: 8,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              opacity: chatQ !== null ? 0 : 1,
              transition: "opacity 0.3s",
              pointerEvents: chatQ !== null ? "none" : "auto",
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
        {/* Phase 1 : <LandingBiens /> masqué — marketplace publique reportée. */}
        <LandingEstimation />
        <FeatureIA />
        <FeatureBiens />
        <FeatureReseau />

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
            {ETAPES.map((e) => (
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

        {/* Bouton flottant — visible quand le hero quitte le viewport */}
        <FloatingChatBubble onOpen={openFloatingChat} hidden={chatQ !== null} />
      </div>
    </>
  );
}
