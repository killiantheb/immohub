"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Ruler,
  Bed,
  Bath,
  Building2,
  Star,
  ChevronLeft,
  ChevronRight,
  Check,
  Shield,
  Home,
  X,
  Send,
  Copy,
  Share2,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/lib/store/authStore";
import { Analytics } from "@/lib/analytics";
import { C } from "@/lib/design-tokens";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

interface BienDetail {
  id: string;
  titre: string;
  description: string | null;
  transaction_type: "location" | "vente" | "colocation";
  prix: number | null;
  charges: number | null;
  caution: number | null;
  adresse_affichee: string;
  ville: string;
  code_postal: string;
  canton: string | null;
  lat: number | null;
  lng: number | null;
  surface: number | null;
  pieces: number | null;
  chambres: number | null;
  sdb: number | null;
  etage: number | null;
  type_label: string;
  is_furnished: boolean;
  has_parking: boolean;
  has_balcony: boolean;
  has_terrace: boolean;
  has_garden: boolean;
  pets_allowed: boolean;
  photos: string[];
  tags_ia: string[];
  is_premium: boolean;
  vues: number;
}

const TX_LABEL: Record<string, string> = {
  location: "Location",
  vente: "Vente",
  colocation: "Colocation",
};
const TX_COLOR: Record<string, string> = {
  location: C.orange,
  vente: "#0EA5E9",
  colocation: "var(--althy-purple)",
};

function fmt(n: number) {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Header commun ─────────────────────────────────────────────────────────────

function Header() {
  return (
    <header
      style={{
        background: "var(--althy-surface)",
        borderBottom: "1px solid var(--althy-border)",
        padding: "0 24px",
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <Link href="/" style={{ textDecoration: "none" }}>
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 300,
            color: "var(--althy-text)",
            letterSpacing: "0.05em",
          }}
        >
          ALT<span style={{ color: C.orange }}>H</span>Y
        </span>
      </Link>
      <div style={{ display: "flex", gap: 8 }}>
        <Link
          href="/register"
          style={{
            fontSize: 13,
            padding: "6px 14px",
            borderRadius: "var(--radius-elem)",
            background: "var(--althy-orange-bg, rgba(232,96,44,0.08))",
            color: C.orange,
            border: `1px solid ${C.orange}`,
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          Publier un bien
        </Link>
        <Link
          href="/login"
          style={{
            fontSize: 13,
            padding: "6px 14px",
            borderRadius: "var(--radius-elem)",
            background: C.orange,
            color: "#fff",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          Se connecter
        </Link>
      </div>
    </header>
  );
}

// ── Modal intérêt ─────────────────────────────────────────────────────────────

function InteretModal({
  bienId,
  titre,
  isLoggedIn,
  onClose,
}: {
  bienId: string;
  titre: string;
  isLoggedIn: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = useCallback(async () => {
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API}/marketplace/interesse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ listing_id: bienId, message: message || undefined }),
      });
      if (res.ok) {
        setSent(true);
        if (isLoggedIn) setStep(2);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.detail ?? "Erreur lors de l'envoi.");
      }
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setSending(false);
    }
  }, [bienId, message, isLoggedIn]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(15,14,13,0.6)",
        display: "flex", alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--althy-surface)",
          borderRadius: "20px 20px 0 0",
          width: "100%", maxWidth: 520,
          padding: "28px 24px 32px",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--althy-text)" }}>
            {sent && !isLoggedIn ? "Intérêt enregistré ✓" : step === 2 ? "Votre dossier" : "Je suis intéressé"}
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--althy-text-3)", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {sent && !isLoggedIn && (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ color: "var(--althy-text-2)", fontSize: 14, marginBottom: 20 }}>
              Votre intérêt pour <strong>«&nbsp;{titre}&nbsp;»</strong> a bien été transmis au propriétaire.
            </p>
            <p style={{ color: "var(--althy-text-3)", fontSize: 13, marginBottom: 20 }}>
              Créez un compte pour envoyer votre dossier complet et augmenter vos chances.
            </p>
            <Link
              href={`/register?callbackUrl=/biens/${bienId}`}
              style={{
                display: "block", textAlign: "center",
                background: C.orange, color: "#fff",
                padding: "11px", borderRadius: "var(--radius-elem)",
                textDecoration: "none", fontWeight: 600, fontSize: 14,
              }}
            >
              Créer mon compte gratuitement →
            </Link>
          </div>
        )}

        {!sent && step === 1 && (
          <>
            <p style={{ color: "var(--althy-text-3)", fontSize: 13, margin: "0 0 14px" }}>
              Ajoutez un message optionnel au propriétaire de <strong>«&nbsp;{titre}&nbsp;»</strong>.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Bonjour, je suis intéressé par votre bien…"
              rows={4}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 12px",
                border: "1.5px solid var(--althy-border)",
                borderRadius: "var(--radius-elem)",
                fontSize: 13, color: "var(--althy-text)",
                background: "var(--althy-bg)", resize: "vertical",
                outline: "none", fontFamily: "inherit",
                marginBottom: 14,
              }}
            />
            {error && (
              <p style={{ color: "var(--althy-red)", fontSize: 12, marginBottom: 10 }}>{error}</p>
            )}
            <button
              onClick={submit}
              disabled={sending}
              style={{
                width: "100%", padding: "11px",
                background: C.orange, color: "#fff",
                border: "none", borderRadius: "var(--radius-elem)",
                fontSize: 14, fontWeight: 600, cursor: sending ? "wait" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                opacity: sending ? 0.75 : 1,
              }}
            >
              <Send size={14} /> {sending ? "Envoi…" : "Envoyer mon intérêt"}
            </button>
            {!isLoggedIn && (
              <p style={{ textAlign: "center", color: "var(--althy-text-3)", fontSize: 11, marginTop: 10 }}>
                Sans compte — votre intérêt est enregistré mais vous ne pourrez pas envoyer de dossier.
              </p>
            )}
          </>
        )}

        {step === 2 && sent && isLoggedIn && (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "var(--althy-text-2)", fontSize: 14, marginBottom: 20 }}>
              Intérêt transmis ✓. Complétez votre dossier pour maximiser vos chances.
            </p>
            <Link
              href={`/postuler/${bienId}`}
              style={{
                display: "block", textAlign: "center",
                background: C.orange, color: "#fff",
                padding: "11px", borderRadius: "var(--radius-elem)",
                textDecoration: "none", fontWeight: 600, fontSize: 14, marginBottom: 10,
              }}
            >
              Compléter mon dossier de candidature →
            </Link>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--althy-text-3)", fontSize: 13, cursor: "pointer" }}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Althy IA contextuelle ─────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Quels sont les charges exactes ?",
  "Y a-t-il une cave ou un grenier ?",
  "Ce bien est-il bien desservi en transports ?",
  "Quels sont les voisins et le quartier ?",
];

function AlthyIAWidget({ bien }: { bien: BienDetail }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [thinking, setThinking] = useState(false);

  const systemCtx = `Tu es Althy, assistant immobilier. L'utilisateur regarde le bien suivant : « ${bien.titre} » à ${bien.adresse_affichee}. Prix : ${bien.prix ? `CHF ${bien.prix}/mois` : "non communiqué"}. Surface : ${bien.surface ? `${bien.surface}m²` : "non connue"}. ${bien.description ? `Description : ${bien.description.slice(0, 400)}` : ""}. Réponds en français, de façon concise et bienveillante.`;

  const ask = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setOpen(true);
    const userMsg = { role: "user" as const, text: q };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setThinking(true);
    try {
      const res = await fetch(`${API}/sphere/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: q,
          context: systemCtx,
          stream: false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = data.response ?? data.message ?? "Je n'ai pas pu répondre à cette question.";
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Connexion impossible. Réessayez." }]);
    } finally {
      setThinking(false);
    }
  }, [systemCtx]);

  return (
    <div
      style={{
        background: "var(--althy-surface)",
        border: "1px solid var(--althy-border)",
        borderRadius: "var(--radius-card)",
        padding: 18,
        marginTop: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Sparkles size={15} color={C.orange} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--althy-text)" }}>
          Posez vos questions à Althy
        </span>
      </div>

      {/* Suggestions */}
      {!open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              style={{
                textAlign: "left", background: "var(--althy-bg)",
                border: "1px solid var(--althy-border)",
                borderRadius: "var(--radius-elem)",
                padding: "7px 11px", fontSize: 12,
                color: "var(--althy-text-2)", cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.orange)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--althy-border)")}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Historique */}
      {messages.length > 0 && (
        <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                background: m.role === "user" ? "rgba(232,96,44,0.08)" : "var(--althy-bg)",
                border: "1px solid var(--althy-border)",
                borderRadius: "var(--radius-elem)",
                padding: "7px 11px",
                fontSize: 12,
                color: m.role === "user" ? C.orange : "var(--althy-text-2)",
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "90%",
              }}
            >
              {m.text}
            </div>
          ))}
          {thinking && (
            <div style={{ fontSize: 12, color: "var(--althy-text-3)", padding: "4px 11px" }}>
              Althy réfléchit…
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(question); }}
          placeholder="Votre question…"
          style={{
            flex: 1, height: 32, padding: "0 10px",
            border: "1.5px solid var(--althy-border)",
            borderRadius: "var(--radius-elem)",
            fontSize: 12, outline: "none",
            background: "var(--althy-bg)", color: "var(--althy-text)",
            fontFamily: "inherit",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = C.orange)}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--althy-border)")}
        />
        <button
          onClick={() => ask(question)}
          disabled={thinking || !question.trim()}
          style={{
            width: 32, height: 32, background: C.orange, color: "#fff",
            border: "none", borderRadius: "var(--radius-elem)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            opacity: thinking || !question.trim() ? 0.5 : 1,
          }}
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Boutons de partage ────────────────────────────────────────────────────────

function ShareButtons({ bienId, titre }: { bienId: string; titre: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/biens/${bienId}` : `https://althy.ch/biens/${bienId}`;

  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${titre} — ${url}`)}`);
  };

  return (
    <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
      <button
        onClick={copy}
        style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          height: 32, border: "1px solid var(--althy-border)",
          borderRadius: "var(--radius-elem)", background: "var(--althy-bg)",
          color: "var(--althy-text-2)", fontSize: 12, cursor: "pointer",
        }}
      >
        <Copy size={12} /> {copied ? "Copié !" : "Copier le lien"}
      </button>
      <button
        onClick={whatsapp}
        style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          height: 32, border: "1px solid var(--althy-border)",
          borderRadius: "var(--radius-elem)", background: "var(--whatsapp-green)",
          color: "#fff", fontSize: 12, cursor: "pointer",
        }}
      >
        <MessageCircle size={12} /> WhatsApp
      </button>
    </div>
  );
}

// ── Galerie Airbnb (desktop: 1 grande + 4 petites, mobile: carousel) ──────────

function Galerie({
  photos,
  titre,
  transactionType,
  isPremium,
  onOpenLightbox,
}: {
  photos: string[];
  titre: string;
  transactionType: string;
  isPremium: boolean;
  onOpenLightbox: (idx: number) => void;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  const Badges = () => (
    <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 6, zIndex: 2 }}>
      <span style={{ background: TX_COLOR[transactionType] || C.orange, color: "#fff", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 4 }}>
        {TX_LABEL[transactionType]}
      </span>
      {isPremium && (
        <span style={{ background: "var(--althy-warning)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <Star size={11} fill="#fff" /> Premium
        </span>
      )}
    </div>
  );

  const Placeholder = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "linear-gradient(135deg, #FEF2EB 0%, rgba(232,96,44,0.1) 100%)" }}>
      <Building2 size={48} color={C.orange} style={{ opacity: 0.3 }} />
    </div>
  );

  // Mobile : carousel
  if (isMobile || photos.length === 0) {
    return (
      <div
        style={{ position: "relative", borderRadius: "var(--radius-card)", overflow: "hidden", aspectRatio: "16/9", marginBottom: 22, background: "#000", cursor: photos.length ? "pointer" : "default" }}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null || photos.length <= 1) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(dx) > 40) setCarouselIdx((prev) => dx < 0 ? (prev + 1) % photos.length : (prev - 1 + photos.length) % photos.length);
          touchStartX.current = null;
        }}
        onClick={() => photos.length && onOpenLightbox(carouselIdx)}
      >
        <Badges />
        {photos.length > 0 ? (
          <Image src={photos[carouselIdx]} alt={`${titre} — ${carouselIdx + 1}`} fill sizes="100vw" style={{ objectFit: "cover" }} priority={carouselIdx === 0} />
        ) : <Placeholder />}
        {photos.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); setCarouselIdx((prev) => (prev - 1 + photos.length) % photos.length); }} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}><ChevronLeft size={16} /></button>
            <button onClick={(e) => { e.stopPropagation(); setCarouselIdx((prev) => (prev + 1) % photos.length); }} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.45)", border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}><ChevronRight size={16} /></button>
            <span style={{ position: "absolute", bottom: 12, right: 12, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 11, padding: "3px 8px", borderRadius: 4 }}>{carouselIdx + 1}/{photos.length}</span>
          </>
        )}
      </div>
    );
  }

  // Desktop : grille Airbnb
  const main = photos[0];
  const thumbs = photos.slice(1, 5);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "repeat(2, 160px)", gap: 4, borderRadius: "var(--radius-card)", overflow: "hidden", marginBottom: 22, position: "relative" }}>
      <Badges />
      {/* Grande photo gauche — occupe 2 lignes */}
      <div
        style={{ gridRow: "1 / 3", position: "relative", cursor: "pointer" }}
        onClick={() => onOpenLightbox(0)}
      >
        {main ? (
          <Image src={main} alt={titre} fill sizes="50vw" style={{ objectFit: "cover" }} priority />
        ) : <Placeholder />}
      </div>

      {/* 4 petites droite */}
      {thumbs.length === 0 && (
        <div style={{ gridRow: "1 / 3", background: "var(--althy-border)" }} />
      )}
      {thumbs.map((url, i) => (
        <div
          key={url}
          style={{ position: "relative", cursor: "pointer", overflow: "hidden", background: "#eee" }}
          onClick={() => onOpenLightbox(i + 1)}
        >
          <Image src={url} alt={`${titre} — ${i + 2}`} fill sizes="25vw" style={{ objectFit: "cover" }} />
          {/* Overlay "voir toutes" sur la dernière vignette */}
          {i === 3 && photos.length > 5 && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 600 }}>
              +{photos.length - 5} photos
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({
  photos,
  idx,
  onClose,
  onChange,
}: {
  photos: string[];
  idx: number;
  onClose: () => void;
  onChange: (i: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onChange((idx + 1) % photos.length);
      if (e.key === "ArrowLeft") onChange((idx - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, photos.length, onClose, onChange]);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <button onClick={onClose} style={{ position: "absolute", top: 16, right: 20, background: "none", border: "none", color: "#fff", cursor: "pointer", zIndex: 1 }}>
        <X size={28} />
      </button>
      <button onClick={(e) => { e.stopPropagation(); onChange((idx - 1 + photos.length) % photos.length); }} style={{ position: "absolute", left: 16, background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
        <ChevronLeft size={22} />
      </button>
      <div style={{ position: "relative", width: "min(90vw, 1100px)", height: "min(80vh, 700px)" }} onClick={(e) => e.stopPropagation()}>
        <Image src={photos[idx]} alt={`Photo ${idx + 1}`} fill sizes="90vw" style={{ objectFit: "contain" }} />
      </div>
      <button onClick={(e) => { e.stopPropagation(); onChange((idx + 1) % photos.length); }} style={{ position: "absolute", right: 16, background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
        <ChevronRight size={22} />
      </button>
      <span style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
        {idx + 1} / {photos.length}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BienDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { user } = useAuthStore();
  const isLoggedIn = !!user;

  const [bien, setBien] = useState<BienDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [interetOpen, setInteretOpen] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  // ── Fetch detail ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`${API}/marketplace/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setBien(data);
        if (data) Analytics.listingViewed(data.id, data.prix, data.ville);
      })
      .catch(() => setBien(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  // ── Mini-map ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!bien?.lat || !bien?.lng || !mapContainerRef.current || !MAPBOX_TOKEN || mapRef.current)
      return;

    import("mapbox-gl").then((m) => {
      const mapboxgl = m.default;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: "mapbox://styles/mapbox/light-v11",
        center: [bien.lng!, bien.lat!],
        zoom: 13,
        interactive: false,
      });

      mapRef.current = map;

      map.on("load", () => {
        const el = document.createElement("div");
        el.style.cssText = `
          width: 26px; height: 26px;
          border-radius: 50% 50% 50% 0;
          background: ${C.orange};
          border: 2px solid #fff;
          transform: rotate(-45deg);
          box-shadow: 0 2px 8px rgba(232,96,44,0.4);
        `;
        new mapboxgl.Marker({ element: el })
          .setLngLat([bien.lng!, bien.lat!])
          .addTo(map);
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [bien?.lat, bien?.lng]);

  // ── États vide / chargement ───────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--althy-bg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Header />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p style={{ color: "var(--althy-text-3)", fontSize: 14 }}>
            Chargement...
          </p>
        </div>
      </div>
    );
  }

  if (!bien) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--althy-bg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Header />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <Building2 size={44} color="var(--althy-text-3)" style={{ opacity: 0.25 }} />
          <p style={{ color: "var(--althy-text-2)", fontSize: 15 }}>
            Ce bien n'est pas disponible.
          </p>
          <Link
            href="/biens"
            style={{ color: C.orange, fontSize: 13, textDecoration: "none" }}
          >
            ← Retour aux biens
          </Link>
        </div>
      </div>
    );
  }

  const photos = bien.photos ?? [];
  const hasPhotos = photos.length > 0;

  const equipements = [
    bien.is_furnished && "Meublé",
    bien.has_parking && "Parking",
    bien.has_balcony && "Balcon",
    bien.has_terrace && "Terrasse",
    bien.has_garden && "Jardin",
    bien.pets_allowed && "Animaux acceptés",
  ].filter(Boolean) as string[];

  const stats = [
    bien.surface ? { icon: <Ruler size={15} />, label: `${bien.surface} m²` } : null,
    bien.pieces
      ? { icon: <Home size={15} />, label: `${bien.pieces} pièce${bien.pieces > 1 ? "s" : ""}` }
      : null,
    bien.chambres
      ? {
          icon: <Bed size={15} />,
          label: `${bien.chambres} chambre${bien.chambres > 1 ? "s" : ""}`,
        }
      : null,
    bien.sdb
      ? {
          icon: <Bath size={15} />,
          label: `${bien.sdb} salle${bien.sdb > 1 ? "s" : ""} de bain`,
        }
      : null,
    bien.etage != null
      ? {
          icon: <Building2 size={15} />,
          label: bien.etage === 0 ? "Rez-de-chaussée" : `${bien.etage}e étage`,
        }
      : null,
  ].filter(Boolean) as { icon: React.ReactNode; label: string }[];

  // ── JSON-LD ───────────────────────────────────────────────────────────────

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "name": bien.titre,
    "description": bien.description ?? undefined,
    "url": `https://althy.ch/biens/${bien.id}`,
    "numberOfRooms": bien.pieces,
    "floorSize": bien.surface
      ? { "@type": "QuantitativeValue", "value": bien.surface, "unitCode": "MTK" }
      : undefined,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": bien.adresse_affichee,
      "addressLocality": bien.ville,
      "postalCode": bien.code_postal,
      "addressRegion": bien.canton ?? undefined,
      "addressCountry": "CH",
    },
    ...(bien.lat && bien.lng && {
      "geo": { "@type": "GeoCoordinates", "latitude": bien.lat, "longitude": bien.lng },
    }),
    ...(bien.prix && {
      "offers": {
        "@type": "Offer",
        "price": bien.prix,
        "priceCurrency": "CHF",
        "seller": { "@type": "Organization", "name": "Althy", "url": "https://althy.ch" },
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": bien.prix,
          "priceCurrency": "CHF",
          "unitText": "MON",
        },
      },
    }),
    ...(photos[0] && { "image": photos }),
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--althy-bg)" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 20px 40px" }}>
        {/* Fil d'ariane */}
        <Link
          href="/biens"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--althy-text-3)",
            fontSize: 13,
            textDecoration: "none",
            marginBottom: 18,
          }}
        >
          <ArrowLeft size={14} /> Retour aux biens
        </Link>

        <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
          {/* Gauche : contenu principal */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Galerie Airbnb */}
            <Galerie
              photos={photos}
              titre={bien.titre}
              transactionType={bien.transaction_type}
              isPremium={bien.is_premium}
              onOpenLightbox={(idx) => { setLightboxIdx(idx); setLightboxOpen(true); }}
            />
            {lightboxOpen && photos.length > 0 && (
              <Lightbox
                photos={photos}
                idx={lightboxIdx}
                onClose={() => setLightboxOpen(false)}
                onChange={setLightboxIdx}
              />
            )}

            {/* Titre + localisation */}
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 300,
                fontSize: 26,
                color: "var(--althy-text)",
                margin: "0 0 8px",
                lineHeight: 1.2,
              }}
            >
              {bien.titre}
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 16,
                color: "var(--althy-text-3)",
                fontSize: 13,
                flexWrap: "wrap",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={13} /> {bien.adresse_affichee}
              </span>
              {bien.code_postal && <span>· {bien.code_postal}</span>}
              {bien.canton && (
                <span
                  style={{
                    background: "var(--althy-border)",
                    padding: "2px 7px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--althy-text-2)",
                  }}
                >
                  {bien.canton.toUpperCase()}
                </span>
              )}
            </div>

            {/* Tags IA */}
            {bien.tags_ia.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 20,
                }}
              >
                {bien.tags_ia.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: "var(--althy-orange-bg, rgba(232,96,44,0.08))",
                      color: C.orange,
                      fontSize: 12,
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontWeight: 500,
                    }}
                  >
                    ✦ {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Stats */}
            {stats.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 22,
                }}
              >
                {stats.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "var(--althy-surface)",
                      border: "1px solid var(--althy-border)",
                      borderRadius: "var(--radius-elem)",
                      padding: "7px 13px",
                      color: "var(--althy-text-2)",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: C.orange }}>{s.icon}</span>
                    {s.label}
                  </div>
                ))}
              </div>
            )}

            {/* Équipements */}
            {equipements.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--althy-text)",
                    margin: "0 0 10px",
                  }}
                >
                  Équipements
                </h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {equipements.map((eq) => (
                    <span
                      key={eq}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        background: "var(--althy-green-bg)",
                        color: "var(--althy-green)",
                        fontSize: 12,
                        padding: "5px 12px",
                        borderRadius: 20,
                      }}
                    >
                      <Check size={11} /> {eq}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {bien.description && (
              <div style={{ marginBottom: 22 }}>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--althy-text)",
                    margin: "0 0 10px",
                  }}
                >
                  Description
                </h3>
                <p
                  style={{
                    color: "var(--althy-text-2)",
                    fontSize: 14,
                    lineHeight: 1.75,
                    margin: 0,
                  }}
                >
                  {bien.description}
                </p>
              </div>
            )}

            {/* Mini-map */}
            {bien.lat && bien.lng && (
              <div>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--althy-text)",
                    margin: "0 0 10px",
                  }}
                >
                  Localisation
                </h3>
                <div
                  ref={mapContainerRef}
                  style={{
                    height: 200,
                    borderRadius: "var(--radius-card)",
                    overflow: "hidden",
                    border: "1px solid var(--althy-border)",
                  }}
                />
                <p
                  style={{
                    color: "var(--althy-text-3)",
                    fontSize: 11,
                    margin: "6px 0 0",
                  }}
                >
                  📍 {bien.adresse_affichee} — localisation approximative
                </p>
              </div>
            )}
          </div>

          {/* Droite : carte contact sticky */}
          <div style={{ width: 292, flexShrink: 0, position: "sticky", top: 70 }}>
            <div
              style={{
                background: "var(--althy-surface)",
                border: "1px solid var(--althy-border)",
                borderRadius: "var(--radius-card)",
                padding: 20,
                boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
              }}
            >
              {/* Prix */}
              {bien.prix && (
                <div style={{ marginBottom: 18 }}>
                  <div
                    style={{
                      fontSize: 30,
                      fontWeight: 700,
                      color: C.orange,
                      lineHeight: 1,
                    }}
                  >
                    {fmt(bien.prix)}
                    {(bien.transaction_type === "location" ||
                      bien.transaction_type === "colocation") && (
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 400,
                          color: "var(--althy-text-3)",
                        }}
                      >
                        /mois
                      </span>
                    )}
                  </div>
                  {bien.charges && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--althy-text-3)",
                        margin: "5px 0 0",
                      }}
                    >
                      + {fmt(bien.charges)} de charges
                    </p>
                  )}
                  {bien.caution && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--althy-text-3)",
                        margin: "3px 0 0",
                      }}
                    >
                      Caution : {fmt(bien.caution)}
                    </p>
                  )}
                </div>
              )}

              {/* CTAs */}
              <button
                onClick={() => setInteretOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: C.orange,
                  color: "#fff",
                  padding: "11px 18px",
                  borderRadius: "var(--radius-elem)",
                  border: "none",
                  fontSize: 14,
                  fontWeight: 600,
                  width: "100%",
                  boxSizing: "border-box",
                  marginBottom: 9,
                  cursor: "pointer",
                }}
              >
                Je suis intéressé — contacter <ArrowRight size={15} />
              </button>

              {isLoggedIn ? (
                <Link
                  href={`/postuler/${bien.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1.5px solid var(--althy-border)",
                    color: "var(--althy-text-2)",
                    padding: "9px 18px",
                    borderRadius: "var(--radius-elem)",
                    textDecoration: "none",
                    fontSize: 13,
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  Envoyer mon dossier complet <ArrowRight size={13} />
                </Link>
              ) : (
                <Link
                  href={`/login?callbackUrl=/postuler/${bien.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1.5px solid var(--althy-border)",
                    color: "var(--althy-text-2)",
                    padding: "9px 18px",
                    borderRadius: "var(--radius-elem)",
                    textDecoration: "none",
                    fontSize: 13,
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  Déjà inscrit ? Se connecter
                </Link>
              )}

              {interetOpen && (
                <InteretModal
                  bienId={bien.id}
                  titre={bien.titre}
                  isLoggedIn={isLoggedIn}
                  onClose={() => setInteretOpen(false)}
                />
              )}

              {/* Signaux de confiance */}
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px solid var(--althy-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "var(--althy-text-3)",
                    fontSize: 11,
                  }}
                >
                  <Shield size={12} style={{ color: C.orange, flexShrink: 0 }} />
                  Dossier locataire sécurisé Althy
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: "var(--althy-text-3)",
                    fontSize: 11,
                  }}
                >
                  <Check size={12} style={{ color: "var(--althy-green)", flexShrink: 0 }} />
                  CHF 90 de frais uniquement si retenu
                </div>
              </div>
            </div>

            {bien.vues > 0 && (
              <p
                style={{
                  textAlign: "center",
                  color: "var(--althy-text-3)",
                  fontSize: 11,
                  marginTop: 8,
                }}
              >
                👁 {bien.vues} vue{bien.vues > 1 ? "s" : ""}
              </p>
            )}

            <AlthyIAWidget bien={bien} />
            <ShareButtons bienId={bien.id} titre={bien.titre} />
          </div>
        </div>
      </div>
    </div>
  );
}
