"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  X,
  Heart,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Sparkles,
  MapPin,
  Home,
  Ruler,
  Building2,
} from "lucide-react";
import { C } from "@/lib/design-tokens";

// ── Constants ─────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 100;
const serif           = "var(--font-serif)";
const sans            = "var(--font-sans)";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BienSwipe {
  id:               string;
  titre:            string;
  transaction_type: string;
  prix:             number | null;
  charges:          number | null;
  adresse_affichee: string;
  ville:            string;
  surface:          number | null;
  pieces:           number | null;
  type_label:       string;
  cover:            string | null;
  photos:           string[];
  tags_ia:          string[];
  is_premium:       boolean;
  description?:     string;
  etage?:           string | number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtPrix(n: number) {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(n);
}

const PHOTO_BG = [
  "linear-gradient(135deg,#E8D8C4 0%,#C8A880 100%)",
  "linear-gradient(135deg,#C4D8C4 0%,#90B890 100%)",
  "linear-gradient(135deg,#C4CCE0 0%,#9CACC8 100%)",
  "linear-gradient(135deg,#E0D8C4 0%,#C0A880 100%)",
  "linear-gradient(135deg,#C8C4E0 0%,#9890B8 100%)",
];
const photoBg = (i: number) => PHOTO_BG[i % PHOTO_BG.length];

const MEDIAN: Record<string, number> = {
  "genève": 9000, "geneva": 9000,
  lausanne: 7500, fribourg: 6200,
  "neuchâtel": 6100, neuchatel: 6100,
  sion: 5800, nyon: 7200, morges: 6800,
};

function althyInsight(bien: BienSwipe): string {
  const city   = bien.ville?.toLowerCase() ?? "";
  const prix   = bien.prix ?? 0;
  const median = MEDIAN[city] ?? 7000;
  const pct    = Math.round((prix / median) * 100);
  const pieces = bien.pieces ?? 0;
  return [
    `Le loyer représente ${pct}% d'un salaire médian à ${bien.ville}.`,
    pieces >= 3
      ? "Idéal pour une famille — plusieurs écoles dans le quartier."
      : "Parfait pour une personne seule ou un couple.",
    "Accès aux transports publics à moins de 5 min à pied.",
  ].join(" ");
}

// ── CSS keyframes ─────────────────────────────────────────────────────────────

export const SWIPE_CSS = `
  @keyframes sw-spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes sw-slidein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sw-fadeout { 0%{opacity:1;transform:translateX(-50%) translateY(0)} 70%{opacity:1} 100%{opacity:0;transform:translateX(-50%) translateY(-12px)} }
  .sw-btn-pass:hover { transform:scale(1.10); box-shadow:0 6px 20px rgba(231,76,60,0.22)!important; }
  .sw-btn-like:hover { transform:scale(1.10); box-shadow:0 6px 20px rgba(76,175,80,0.22)!important; }
  .sw-photo-btn      { transition:background 0.15s; }
  .sw-photo-btn:hover{ background:rgba(0,0,0,0.55)!important; }
`;

// ── Althy IA mini-widget ──────────────────────────────────────────────────────

function AlthyInsightWidget({ bien }: { bien: BienSwipe }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);

  function reveal() {
    if (insight) { setOpen(o => !o); return; }
    setLoading(true);
    setOpen(true);
    setTimeout(() => {
      setInsight(althyInsight(bien));
      setLoading(false);
    }, 900);
  }

  return (
    <div style={{ borderTop: "1px solid rgba(26,22,18,0.07)", paddingTop: 14 }}>
      <button
        onClick={reveal}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "none", border: "none", cursor: "pointer",
          padding: 0, fontFamily: sans,
          color: C.orange, fontSize: 13, fontWeight: 600,
          width: "100%", textAlign: "left",
        }}
      >
        <Sparkles size={14} />
        Demander à Althy
        <span style={{
          marginLeft: "auto", fontSize: 11, color: "rgba(232,96,44,0.60)",
          display: "inline-block",
          transform: open ? "rotate(90deg)" : "none",
          transition: "transform 0.2s",
        }}>▸</span>
      </button>

      {open && loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, color: "rgba(26,22,18,0.45)", fontSize: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${C.orange}`, borderTopColor: "transparent", animation: "sw-spin 0.7s linear infinite" }} />
          Althy analyse ce bien…
        </div>
      )}

      {open && !loading && insight && (
        <div style={{
          marginTop: 12, padding: "12px 14px",
          background: "rgba(232,96,44,0.05)",
          borderRadius: 10, border: `1px solid rgba(232,96,44,0.12)`,
          animation: "sw-slidein 0.25s ease",
        }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--althy-text)", lineHeight: 1.65 }}>
            <span style={{ color: C.orange, fontWeight: 700 }}>✦ </span>
            {insight}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "rgba(26,22,18,0.40)", fontStyle: "italic" }}>— Althy IA</p>
        </div>
      )}
    </div>
  );
}

// ── Desktop card — 60/40 split with Framer Motion drag ────────────────────────

function DesktopCard({
  bien,
  nextBien,
  current,
  total,
  onSwipe,
  onOpenGallery,
}: {
  bien:          BienSwipe;
  nextBien:      BienSwipe | null;
  current:       number;
  total:         number;
  onSwipe:       (dir: "left" | "right") => void;
  onOpenGallery: (idx: number) => void;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  useEffect(() => { setPhotoIdx(0); }, [bien.id]);

  const x       = useMotionValue(0);
  const rotate  = useTransform(x, [-300, 0, 300], [-14, 0, 14]);
  const rightOp = useTransform(x, [0, SWIPE_THRESHOLD], [0, 0.6]);
  const leftOp  = useTransform(x, [-SWIPE_THRESHOLD, 0], [0.6, 0]);

  function triggerSwipe(dir: "left" | "right") {
    animate(x, dir === "right" ? 700 : -700, {
      type: "spring", stiffness: 300, damping: 30,
    });
    setTimeout(() => onSwipe(dir), 350);
  }

  function onDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x > SWIPE_THRESHOLD) {
      triggerSwipe("right");
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      triggerSwipe("left");
    } else {
      animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
    }
  }

  const photos    = bien.photos ?? [];
  const photoUrl  = photos[photoIdx] ?? bien.cover ?? null;
  const totalPics = Math.max(photos.length, bien.cover ? 1 : 0);

  const prixLabel = bien.prix
    ? `${fmtPrix(bien.prix)}${["location","colocation"].includes(bien.transaction_type) ? "/mois" : ""}`
    : "Prix sur demande";

  return (
    // Outer wrapper — spring-entrance when card becomes active
    <motion.div
      initial={{ scale: 0.95, opacity: 0.85 }}
      animate={{ scale: 1,    opacity: 1    }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{ display: "flex", flex: 1, overflow: "hidden" }}
    >
      {/* ── Photo column (left, 60%) ──────────────────────────────── */}
      <div style={{ position: "relative", flex: "0 0 60%", overflow: "hidden", background: "#0D0B08" }}>

        {/* Next card peek (behind) */}
        {nextBien && (
          <div style={{
            position: "absolute", inset: 0,
            background: nextBien.cover ? "#000" : photoBg(1),
            transform: "scale(0.97)",
          }}>
            {nextBien.cover && (
              <img
                src={nextBien.cover}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.65 }}
              />
            )}
          </div>
        )}

        {/* Draggable photo */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.8}
          onDragEnd={onDragEnd}
          style={{
            position: "absolute", inset: 0,
            x, rotate,
            cursor: "grab",
            userSelect: "none",
            touchAction: "none",
          }}
          whileDrag={{ cursor: "grabbing" }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={bien.titre}
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", background: photoBg(photoIdx) }} />
          )}

          {/* Gradient overlays */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 140, background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 180, background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)", pointerEvents: "none" }} />

          {/* Prix en bas gauche */}
          <div style={{ position: "absolute", bottom: 28, left: 28, pointerEvents: "none" }}>
            <p style={{ margin: 0, fontFamily: serif, fontSize: 36, fontWeight: 300, color: "#fff", lineHeight: 1, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
              {prixLabel}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.80)", textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>
              {bien.adresse_affichee} · {bien.ville}
            </p>
          </div>

          {/* Swipe overlay — AIMER (right) */}
          <motion.div
            style={{
              position: "absolute", inset: 0,
              background: "rgba(20,80,20,1)",
              opacity: rightOp,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div style={{ border: "4px solid #4CAF50", borderRadius: 14, padding: "10px 24px", transform: "rotate(-14deg)" }}>
              <span style={{ fontSize: 38, fontWeight: 900, color: "var(--althy-green)" }}>♥ AIMER</span>
            </div>
          </motion.div>

          {/* Swipe overlay — PASSER (left) */}
          <motion.div
            style={{
              position: "absolute", inset: 0,
              background: "rgba(120,20,20,1)",
              opacity: leftOp,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div style={{ border: "4px solid #E74C3C", borderRadius: 14, padding: "10px 24px", transform: "rotate(14deg)" }}>
              <span style={{ fontSize: 38, fontWeight: 900, color: "var(--althy-red)" }}>✕ PASSER</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Photo nav */}
        {totalPics > 1 && (
          <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 6, zIndex: 10 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => (i - 1 + totalPics) % totalPics); }}
              className="sw-photo-btn"
              style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.42)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <ChevronLeft size={16} color="#fff" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => (i + 1) % totalPics); }}
              className="sw-photo-btn"
              style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.42)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <ChevronRight size={16} color="#fff" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenGallery(photoIdx); }}
              className="sw-photo-btn"
              style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.42)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <Maximize2 size={14} color="#fff" />
            </button>
          </div>
        )}

        {/* Photo dots */}
        {totalPics > 1 && (
          <div style={{ position: "absolute", bottom: 12, right: 16, display: "flex", gap: 5, pointerEvents: "none", zIndex: 10 }}>
            {Array.from({ length: Math.min(totalPics, 5) }).map((_, i) => (
              <div key={i} style={{ width: i === photoIdx ? 18 : 6, height: 6, borderRadius: 3, background: i === photoIdx ? C.orange : "rgba(255,255,255,0.50)", transition: "all 0.2s" }} />
            ))}
          </div>
        )}
      </div>

      {/* ── Info panel (right, 40%) ───────────────────────────────── */}
      <div style={{
        flex: "0 0 40%",
        display: "flex", flexDirection: "column",
        background: "#fff",
        borderLeft: "1px solid rgba(26,22,18,0.07)",
        overflow: "hidden",
      }}>
        {/* Progress */}
        <div style={{ padding: "14px 22px", borderBottom: "1px solid rgba(26,22,18,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--althy-text-3)", fontWeight: 500 }}>
            {current}/{total} biens · {bien.ville}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {Array.from({ length: Math.min(total, 6) }).map((_, i) => (
              <div key={i} style={{ width: 22, height: 3, borderRadius: 2, background: i < current ? C.orange : "rgba(26,22,18,0.12)", transition: "background 0.2s" }} />
            ))}
          </div>
        </div>

        {/* Content (scrollable) */}
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 22px 0" }}>
          {/* Badges */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ background: C.orange, color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>
              {bien.transaction_type === "location" ? "Location" : bien.transaction_type === "colocation" ? "Colocation" : "Vente"}
            </span>
            {bien.type_label && (
              <span style={{ background: "rgba(26,22,18,0.07)", color: "var(--althy-text-2)", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20 }}>
                {bien.type_label}
              </span>
            )}
            {bien.is_premium && (
              <span style={{ background: "var(--althy-orange-light)", color: "#B45309", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20 }}>
                ✦ Premium
              </span>
            )}
          </div>

          {/* Title */}
          <h2 style={{ fontFamily: serif, fontSize: 23, fontWeight: 300, color: "var(--althy-text)", margin: "0 0 6px", lineHeight: 1.25 }}>
            {bien.titre}
          </h2>

          {/* Address */}
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--althy-text-3)", display: "flex", alignItems: "center", gap: 5 }}>
            <MapPin size={13} /> {bien.adresse_affichee}
          </p>

          {/* Specs */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            {bien.pieces ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "rgba(26,22,18,0.04)", fontSize: 13, color: "var(--althy-text)", fontWeight: 500 }}>
                <Home size={13} color="var(--althy-text-3)" /> {bien.pieces} pièce{bien.pieces > 1 ? "s" : ""}
              </div>
            ) : null}
            {bien.surface ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "rgba(26,22,18,0.04)", fontSize: 13, color: "var(--althy-text)", fontWeight: 500 }}>
                <Ruler size={13} color="var(--althy-text-3)" /> {bien.surface} m²
              </div>
            ) : null}
            {bien.etage ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, background: "rgba(26,22,18,0.04)", fontSize: 13, color: "var(--althy-text)", fontWeight: 500 }}>
                <Building2 size={13} color="var(--althy-text-3)" /> {bien.etage}
              </div>
            ) : null}
          </div>

          {/* Prix */}
          <div style={{ marginBottom: 18 }}>
            <span style={{ fontFamily: serif, fontSize: 34, fontWeight: 300, color: "var(--althy-text)" }}>
              {bien.prix ? fmtPrix(bien.prix) : "Sur demande"}
            </span>
            {["location","colocation"].includes(bien.transaction_type) && bien.prix ? (
              <span style={{ fontSize: 14, color: "var(--althy-text-3)", marginLeft: 6 }}>/mois</span>
            ) : null}
            {bien.charges ? (
              <span style={{ display: "block", fontSize: 12, color: "var(--althy-text-3)", marginTop: 3 }}>
                + CHF {bien.charges} charges
              </span>
            ) : null}
          </div>

          {/* Tags IA */}
          {bien.tags_ia?.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
              {bien.tags_ia.slice(0, 6).map(tag => (
                <span key={tag} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "rgba(232,96,44,0.07)", color: C.orange, fontWeight: 500 }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Description (max 3 lignes) */}
          {bien.description && (
            <p style={{
              margin: "0 0 18px", fontSize: 13, color: "var(--althy-text-2)", lineHeight: 1.65,
              display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {bien.description}
            </p>
          )}

          {/* Althy IA widget */}
          <AlthyInsightWidget bien={bien} />

          <Link href={`/biens/${bien.id}`} style={{ display: "block", margin: "14px 0 22px", fontSize: 12, color: "var(--althy-text-3)", textDecoration: "none", textAlign: "center" }}>
            Voir la fiche complète →
          </Link>
        </div>

        {/* Action buttons */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(26,22,18,0.07)", background: "#fff", display: "flex", gap: 12 }}>
          <button
            className="sw-btn-pass"
            onClick={() => triggerSwipe("left")}
            style={{
              flex: 1, height: 52, borderRadius: 14,
              border: "2px solid #E74C3C", background: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              cursor: "pointer", fontSize: 14, fontWeight: 700, color: "var(--althy-red)",
              boxShadow: "0 2px 10px rgba(231,76,60,0.12)",
              transition: "transform 0.15s, box-shadow 0.15s",
              fontFamily: sans,
            }}
          >
            <X size={18} strokeWidth={2.5} /> Passer
          </button>
          <button
            className="sw-btn-like"
            onClick={() => triggerSwipe("right")}
            style={{
              flex: 1, height: 52, borderRadius: 14,
              border: "none", background: "var(--althy-green)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#fff",
              boxShadow: "0 2px 10px rgba(76,175,80,0.22)",
              transition: "transform 0.15s, box-shadow 0.15s",
              fontFamily: sans,
            }}
          >
            <Heart size={18} strokeWidth={2.5} /> Aimer
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Mobile card — plein écran avec drag ───────────────────────────────────────

function MobileCard({
  bien,
  current,
  total,
  onSwipe,
  onOpenGallery,
}: {
  bien:          BienSwipe;
  current:       number;
  total:         number;
  onSwipe:       (dir: "left" | "right") => void;
  onOpenGallery: (idx: number) => void;
}) {
  const [photoIdx,    setPhotoIdx]    = useState(0);
  const [showDetail,  setShowDetail]  = useState(false);
  useEffect(() => { setPhotoIdx(0); setShowDetail(false); }, [bien.id]);

  const x        = useMotionValue(0);
  const rotate   = useTransform(x, [-300, 0, 300], [-14, 0, 14]);
  const rightOp  = useTransform(x, [0, SWIPE_THRESHOLD], [0, 0.6]);
  const leftOp   = useTransform(x, [-SWIPE_THRESHOLD, 0], [0.6, 0]);

  function triggerSwipe(dir: "left" | "right") {
    animate(x, dir === "right" ? 700 : -700, {
      type: "spring", stiffness: 300, damping: 30,
    });
    setTimeout(() => onSwipe(dir), 350);
  }

  function onDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x > SWIPE_THRESHOLD) triggerSwipe("right");
    else if (info.offset.x < -SWIPE_THRESHOLD) triggerSwipe("left");
    else animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
  }

  const photos   = bien.photos ?? [];
  const photoUrl = photos[photoIdx] ?? bien.cover ?? null;
  const totalPics = Math.max(photos.length, bien.cover ? 1 : 0);

  const prixLabel = bien.prix
    ? `${fmtPrix(bien.prix)}${["location","colocation"].includes(bien.transaction_type) ? "/mois" : ""}`
    : "Prix sur demande";

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0.85 }}
      animate={{ scale: 1,    opacity: 1    }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{ flex: 1, position: "relative", overflow: "hidden" }}
    >
      {/* Draggable full-screen photo */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.8}
        onDragEnd={onDragEnd}
        style={{
          position: "absolute", inset: 0,
          x, rotate,
          cursor: "grab",
          userSelect: "none",
          touchAction: showDetail ? "auto" : "none",
        }}
        whileDrag={{ cursor: "grabbing" }}
      >
        {/* Photo */}
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={bien.titre}
            draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: photoBg(photoIdx) }} />
        )}

        {/* Top gradient */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120, background: "linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, transparent 100%)", pointerEvents: "none" }} />
        {/* Bottom gradient */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "58%", background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)", pointerEvents: "none" }} />

        {/* Counter pill */}
        <div style={{ position: "absolute", top: 16, left: 16, background: "rgba(0,0,0,0.42)", backdropFilter: "blur(6px)", borderRadius: 20, padding: "4px 12px" }}>
          <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{current}/{total}</span>
        </div>

        {/* Gallery button */}
        <button
          onClick={(e) => { e.stopPropagation(); onOpenGallery(photoIdx); }}
          className="sw-photo-btn"
          style={{ position: "absolute", top: 14, right: 14, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.42)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Maximize2 size={16} color="#fff" />
        </button>

        {/* Photo dots */}
        {totalPics > 1 && (
          <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
            {Array.from({ length: Math.min(totalPics, 5) }).map((_, i) => (
              <div key={i} style={{ width: i === photoIdx ? 16 : 5, height: 5, borderRadius: 3, background: i === photoIdx ? "#fff" : "rgba(255,255,255,0.45)", transition: "all 0.2s" }} />
            ))}
          </div>
        )}

        {/* Swipe overlays */}
        <motion.div style={{ position: "absolute", inset: 0, background: "rgba(20,80,20,1)", opacity: rightOp, display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: 30, pointerEvents: "none" }}>
          <div style={{ border: "4px solid #4CAF50", borderRadius: 12, padding: "8px 16px", transform: "rotate(-14deg)" }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: "var(--althy-green)" }}>♥</span>
          </div>
        </motion.div>
        <motion.div style={{ position: "absolute", inset: 0, background: "rgba(120,20,20,1)", opacity: leftOp, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 30, pointerEvents: "none" }}>
          <div style={{ border: "4px solid #E74C3C", borderRadius: 12, padding: "8px 16px", transform: "rotate(14deg)" }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: "var(--althy-red)" }}>✕</span>
          </div>
        </motion.div>

        {/* Bottom overlay */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 14px 14px", pointerEvents: "all" }}>
          {/* Info card */}
          <div
            style={{
              background: "rgba(250,250,248,0.96)", backdropFilter: "blur(14px)",
              borderRadius: 20, padding: "14px 16px",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
              marginBottom: 10, cursor: "pointer",
            }}
            onClick={() => setShowDetail(d => !d)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: "var(--althy-text)" }}>
                  {bien.ville}{bien.pieces ? ` · ${bien.pieces}p` : ""}{bien.surface ? ` · ${bien.surface}m²` : ""}
                </p>
                <p style={{ margin: 0, fontFamily: serif, fontSize: 22, fontWeight: 300, color: "var(--althy-text)" }}>
                  {prixLabel}
                </p>
              </div>
              <span style={{ fontSize: 11, color: "var(--althy-text-3)", marginTop: 2 }}>{showDetail ? "▲" : "▼"}</span>
            </div>

            {/* Tags teaser */}
            {bien.tags_ia?.length > 0 && !showDetail && (
              <p style={{ margin: "7px 0 0", fontSize: 12, color: C.orange, fontWeight: 500 }}>
                ✦ {bien.tags_ia[0]}{bien.tags_ia[1] ? `, ${bien.tags_ia[1]}` : ""}
              </p>
            )}

            {/* Expanded detail */}
            {showDetail && (
              <div style={{ marginTop: 12, animation: "sw-slidein 0.22s ease" }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--althy-text-2)" }}>
                  {bien.adresse_affichee}
                </p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {bien.tags_ia?.slice(0, 4).map(tag => (
                    <span key={tag} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: "rgba(232,96,44,0.08)", color: C.orange }}>
                      {tag}
                    </span>
                  ))}
                </div>
                <AlthyInsightWidget bien={bien} />
              </div>
            )}
          </div>

          {/* Action row */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => triggerSwipe("left")}
              style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid #E74C3C", background: "rgba(255,255,255,0.94)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 14px rgba(231,76,60,0.18)", flexShrink: 0 }}
            >
              <X size={22} color="var(--althy-red)" strokeWidth={2.5} />
            </button>

            <Link
              href={`/biens/${bien.id}`}
              style={{ flex: 1, height: 48, borderRadius: 14, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
            >
              <Sparkles size={14} /> Voir le détail
            </Link>

            <button
              onClick={() => triggerSwipe("right")}
              style={{ width: 56, height: 56, borderRadius: "50%", border: "none", background: "var(--althy-green)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 14px rgba(76,175,80,0.28)", flexShrink: 0 }}
            >
              <Heart size={22} color="#fff" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function SwipeCard({
  bien,
  nextBien,
  isMobile,
  current,
  total,
  onSwipe,
  onOpenGallery,
}: {
  bien:          BienSwipe;
  nextBien:      BienSwipe | null;
  isMobile:      boolean;
  current:       number;
  total:         number;
  onSwipe:       (dir: "left" | "right") => void;
  onOpenGallery: (idx: number) => void;
}) {
  if (isMobile) {
    return (
      <MobileCard
        key={bien.id}
        bien={bien}
        current={current}
        total={total}
        onSwipe={onSwipe}
        onOpenGallery={onOpenGallery}
      />
    );
  }
  return (
    <DesktopCard
      key={bien.id}
      bien={bien}
      nextBien={nextBien}
      current={current}
      total={total}
      onSwipe={onSwipe}
      onOpenGallery={onOpenGallery}
    />
  );
}
