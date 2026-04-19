"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  X,
  Heart,
  ChevronLeft,
  ChevronRight,
  LogIn,
  RefreshCw,
  List,
  SlidersHorizontal,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Analytics } from "@/lib/analytics";
import {
  SwipeCard,
  SWIPE_CSS,
  type BienSwipe,
  fmtPrix,
} from "@/components/marketplace/SwipeCard";
import { C } from "@/lib/design-tokens";

// ── Constants ─────────────────────────────────────────────────────────────────

const API   = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const serif  = "var(--font-serif)";
const sans   = "var(--font-sans)";

// ── Session anonyme ────────────────────────────────────────────────────────────

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sid = localStorage.getItem("althy_session_id");
  if (!sid) { sid = crypto.randomUUID(); localStorage.setItem("althy_session_id", sid); }
  return sid;
}

// ── Gallery overlay ────────────────────────────────────────────────────────────

function GalleryOverlay({
  bien,
  startIdx,
  onClose,
}: {
  bien: BienSwipe;
  startIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const photos  = bien.photos ?? [];
  const total   = Math.max(photos.length, bien.cover ? 1 : 0);
  const photoUrl = photos[idx] ?? bien.cover ?? null;

  const prev = () => setIdx(i => (i - 1 + total) % total);
  const next = () => setIdx(i => (i + 1) % total);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape")     onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.95)",
      display: "flex", flexDirection: "column",
      fontFamily: sans,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>{idx + 1} / {total}</span>
        <span style={{ fontFamily: serif, fontSize: 15, color: "rgba(255,255,255,0.80)", fontWeight: 300 }}>{bien.titre}</span>
        <button
          onClick={onClose}
          style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <X size={18} color="#fff" />
        </button>
      </div>

      {/* Photo */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {photoUrl ? (
          <img src={photoUrl} alt={`Photo ${idx + 1}`} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }} />
        ) : (
          <div style={{ width: "min(600px,90vw)", height: "min(400px,60vh)", borderRadius: 16, background: "linear-gradient(135deg,#E8D8C4 0%,#C8A880 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 48, opacity: 0.35 }}>🏠</span>
          </div>
        )}

        {total > 1 && (
          <>
            <button onClick={prev} className="sw-photo-btn" style={{ position: "absolute", left: 16, background: "rgba(0,0,0,0.40)", border: "none", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <ChevronLeft size={22} color="#fff" />
            </button>
            <button onClick={next} className="sw-photo-btn" style={{ position: "absolute", right: 16, background: "rgba(0,0,0,0.40)", border: "none", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <ChevronRight size={22} color="#fff" />
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      {total > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "18px 0" }}>
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              style={{ width: i === idx ? 20 : 8, height: 8, borderRadius: 4, background: i === idx ? C.orange : "rgba(255,255,255,0.30)", border: "none", cursor: "pointer", transition: "all 0.2s", padding: 0 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Filtre drawer (minimal) ────────────────────────────────────────────────────

function FilterDrawer({
  tx, onTx, onClose,
}: {
  tx: string;
  onTx: (v: string) => void;
  onClose: () => void;
}) {
  const TX = ["", "location", "colocation", "vente"] as const;
  const TX_LABEL: Record<string, string> = { "": "Tous", location: "Location", colocation: "Colocation", vente: "Vente" };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.50)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "#fff", borderRadius: "24px 24px 0 0",
        padding: "28px 24px 40px",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
        fontFamily: sans,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--althy-text)" }}>Filtrer les biens</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--althy-text-3)" }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "var(--althy-text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Type de transaction</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {TX.map(t => (
            <button
              key={t}
              onClick={() => onTx(t)}
              style={{
                padding: "8px 16px", borderRadius: 20,
                border: `1.5px solid ${tx === t ? C.orange : "rgba(26,22,18,0.15)"}`,
                background: tx === t ? C.orange : "#fff",
                color: tx === t ? "#fff" : "var(--althy-text)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {TX_LABEL[t]}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{ width: "100%", padding: "12px", background: C.orange, color: "#fff", border: "none", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: sans }}
        >
          Appliquer
        </button>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({
  liked,
  likedIds,
  passed,
  isLoggedIn,
  onReset,
}: {
  liked: number;
  likedIds: string[];
  passed: number;
  isLoggedIn: boolean;
  onReset: () => void;
}) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: sans }}>
      <div style={{ textAlign: "center", maxWidth: 320 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(232,96,44,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Heart size={32} color={C.orange} />
        </div>

        <h2 style={{ fontFamily: serif, fontWeight: 300, fontSize: 26, color: "var(--althy-text)", margin: "0 0 10px" }}>
          Vous avez tout vu !
        </h2>

        {liked > 0 && (
          <div style={{ background: "rgba(76,175,80,0.08)", borderRadius: 12, padding: "12px 18px", marginBottom: 18, border: "1px solid rgba(76,175,80,0.20)" }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--althy-green)" }}>
              {liked} bien{liked > 1 ? "s" : ""} aimé{liked > 1 ? "s" : ""}
            </p>
            {!isLoggedIn && (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--althy-text-2)" }}>
                Connectez-vous pour les retrouver.
              </p>
            )}
          </div>
        )}

        {passed > 0 && (
          <p style={{ color: "var(--althy-text-3)", fontSize: 13, margin: "0 0 24px" }}>
            {passed} bien{passed > 1 ? "s" : ""} passé{passed > 1 ? "s" : ""}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!isLoggedIn && liked > 0 && (
            <Link
              href="/login?callbackUrl=/biens/swipe"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.orange, color: "#fff", padding: "12px 20px", borderRadius: 12, textDecoration: "none", fontSize: 14, fontWeight: 600, fontFamily: sans }}
            >
              <LogIn size={15} /> Se connecter pour voir mes favoris
            </Link>
          )}
          {isLoggedIn && liked > 0 && (
            <Link
              href="/app/biens"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: C.orange, color: "#fff", padding: "12px 20px", borderRadius: 12, textDecoration: "none", fontSize: 14, fontWeight: 600, fontFamily: sans }}
            >
              Voir mes favoris ({liked})
            </Link>
          )}
          {isLoggedIn && liked > 0 && likedIds[0] && (
            <div style={{ textAlign: "center" }}>
              <Link
                href={`/postuler/${likedIds[0]}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1.5px solid rgba(26,22,18,0.15)", background: "#fff", color: "var(--althy-text)", padding: "11px 20px", borderRadius: 12, textDecoration: "none", fontSize: 13, fontFamily: sans }}
              >
                Compléter mon dossier de candidature
              </Link>
              {liked > 1 && (
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--althy-text-3)" }}>
                  Vous avez liké {liked} biens — ce bouton vous emmène vers le plus récent.{" "}
                  <Link href="/app/biens?tab=favoris" style={{ color: C.orange, textDecoration: "none" }}>
                    Voir tous mes favoris
                  </Link>
                </p>
              )}
            </div>
          )}
          <button
            onClick={onReset}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1.5px solid rgba(26,22,18,0.14)", background: "transparent", color: "var(--althy-text-2)", padding: "11px 20px", borderRadius: 12, cursor: "pointer", fontSize: 13, fontFamily: sans }}
          >
            <RefreshCw size={14} /> Recommencer
          </button>
          <Link href="/biens" style={{ fontSize: 13, color: "var(--althy-text-3)", textDecoration: "none" }}>
            Voir tous les biens →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SwipePage() {
  const [deck,        setDeck]        = useState<BienSwipe[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [liked,       setLiked]       = useState(0);
  const [likedIds,    setLikedIds]    = useState<string[]>([]);
  const [passed,      setPassed]      = useState(0);
  const [totalSeen,   setTotalSeen]   = useState(0);
  const [token,       setToken]       = useState<string | null>(null);
  const [isLoggedIn,  setIsLoggedIn]  = useState(false);
  const [isMobile,    setIsMobile]    = useState(false);
  const [toast,       setToast]       = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIdx,  setGalleryIdx]  = useState(0);
  const [showFilter,  setShowFilter]  = useState(false);
  const [txFilter,    setTxFilter]    = useState("");

  const sessionId  = useRef(getSessionId());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Responsive
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auth
  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (session) { setToken(session.access_token); setIsLoggedIn(true); }
    });
  }, []);

  // Fetch
  const fetchDeck = useCallback(async (append = false) => {
    const params = new URLSearchParams({ limit: "50" });
    if (txFilter) params.set("transaction_type", txFilter);

    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API}/marketplace/biens?${params}`, { headers }).catch(() => null);
    if (!res?.ok) { setLoading(false); return; }

    const data: { items?: BienSwipe[] } | BienSwipe[] = await res.json().catch(() => ({}));
    const items: BienSwipe[] = Array.isArray(data) ? data : (data as { items?: BienSwipe[] }).items ?? [];

    setDeck(prev => append ? [...prev, ...items] : items);
    setLoading(false);
  }, [token, txFilter]);

  useEffect(() => { setLoading(true); setDeck([]); fetchDeck(); }, [fetchDeck]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (deck.length === 0 || showGallery || showFilter) return;
      if (e.key === "ArrowRight") handleSwipe("right");
      if (e.key === "ArrowLeft")  handleSwipe("left");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, showGallery, showFilter]);

  // Swipe handler
  async function handleSwipe(dir: "left" | "right") {
    if (deck.length === 0) return;
    const bien = deck[0];
    setDeck(prev => prev.slice(1));
    setTotalSeen(n => n + 1);

    if (dir === "right") {
      setLiked(n => n + 1);
      setLikedIds(prev => [bien.id, ...prev]);
      Analytics.swipeRight(bien.id);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast(`♥ ${bien.ville} ajouté aux favoris`);
      toastTimer.current = setTimeout(() => setToast(null), 2800);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      fetch(`${API}/marketplace/interesse`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          listing_id: bien.id,
          session_id: isLoggedIn ? undefined : sessionId.current,
        }),
      }).catch(() => null);
    } else {
      setPassed(n => n + 1);
      Analytics.swipeLeft(bien.id);
    }
  }

  function openGallery(idx: number) { setGalleryIdx(idx); setShowGallery(true); }

  function handleReset() {
    setLoading(true);
    setDeck([]);
    setLiked(0);
    setLikedIds([]);
    setPassed(0);
    setTotalSeen(0);
    fetchDeck();
  }

  const currentBien = deck[0] ?? null;
  const nextBien    = deck[1] ?? null;
  const current     = totalSeen + 1;
  const total       = totalSeen + deck.length;

  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: "#0F0E0D",
      overflow: "hidden",
      fontFamily: sans,
    }}>
      <style>{SWIPE_CSS}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={{
        background: "rgba(15,14,13,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 16px",
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        zIndex: 50,
      }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: serif, fontSize: 19, fontWeight: 300, color: "#fff", letterSpacing: "0.14em" }}>
            ALT<span style={{ color: C.orange }}>H</span>Y
          </span>
        </Link>

        {/* Centre — compteur + badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {deck.length > 0 && (
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>
              {current} / {total} biens
            </span>
          )}
          <span style={{ fontSize: 10, background: C.orange, color: "#fff", padding: "2px 7px", borderRadius: 20, fontWeight: 700, letterSpacing: "0.05em" }}>
            SWIPE
          </span>
        </div>

        {/* Droite — actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Filtres */}
          <button
            onClick={() => setShowFilter(true)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: txFilter ? C.orange : "rgba(255,255,255,0.55)", display: "flex", alignItems: "center" }}
            title="Filtres"
          >
            <SlidersHorizontal size={17} />
          </button>

          {/* Vue liste */}
          <Link
            href="/biens"
            style={{ color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", padding: 4 }}
            title="Vue liste"
          >
            <List size={17} />
          </Link>

          {/* Compteurs */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.70)" }}>
              <Heart size={13} color="var(--althy-green)" fill="var(--althy-green)" /> {liked}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.70)" }}>
              <X size={13} color="var(--althy-red)" /> {passed}
            </span>
          </div>

          {/* Connexion */}
          {!isLoggedIn && (
            <Link href="/login?callbackUrl=/biens/swipe" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.orange, textDecoration: "none" }}>
              <LogIn size={13} />
              {!isMobile && <span>Connexion</span>}
            </Link>
          )}
          {isLoggedIn && (
            <Link href="/app/biens" style={{ fontSize: 12, color: C.orange, textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}>
              {isMobile ? "↗" : "Favoris →"}
            </Link>
          )}
        </div>
      </header>

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", top: 66, left: "50%",
          transform: "translateX(-50%)",
          background: "var(--althy-green)", color: "#fff",
          padding: "8px 18px", borderRadius: 24,
          fontSize: 13, fontWeight: 600,
          zIndex: 300,
          animation: "sw-fadeout 2.8s forwards",
          whiteSpace: "nowrap",
          boxShadow: "0 4px 18px rgba(0,0,0,0.30)",
        }}>
          {toast}
          {!isLoggedIn && (
            <Link href="/login?callbackUrl=/biens/swipe" style={{ color: "#90EE90", marginLeft: 8, textDecoration: "none" }}>
              Se connecter →
            </Link>
          )}
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${C.orange}`, borderTopColor: "transparent", animation: "sw-spin 0.8s linear infinite" }} />
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14 }}>Chargement des biens…</p>
        </div>
      ) : deck.length === 0 ? (
        <div style={{ flex: 1, background: "var(--althy-bg)", display: "flex" }}>
          <EmptyState liked={liked} likedIds={likedIds} passed={passed} isLoggedIn={isLoggedIn} onReset={handleReset} />
        </div>
      ) : (
        <SwipeCard
          key={currentBien!.id}
          bien={currentBien!}
          nextBien={nextBien}
          isMobile={isMobile}
          current={current}
          total={total}
          onSwipe={handleSwipe}
          onOpenGallery={openGallery}
        />
      )}

      {/* ── Keyboard hint (desktop uniquement) ───────────────────────── */}
      {!isMobile && deck.length > 0 && !loading && (
        <div style={{
          position: "fixed", bottom: 14, left: "50%", transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)",
          borderRadius: 20, padding: "5px 14px", zIndex: 20, pointerEvents: "none",
        }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>
            ← Passer · → Aimer · cliquer sur la photo pour la galerie
          </span>
        </div>
      )}

      {/* ── Gallery overlay ──────────────────────────────────────────── */}
      {showGallery && currentBien && (
        <GalleryOverlay
          bien={currentBien}
          startIdx={galleryIdx}
          onClose={() => setShowGallery(false)}
        />
      )}

      {/* ── Filter drawer ────────────────────────────────────────────── */}
      {showFilter && (
        <FilterDrawer
          tx={txFilter}
          onTx={(v) => setTxFilter(v)}
          onClose={() => setShowFilter(false)}
        />
      )}
    </div>
  );
}
