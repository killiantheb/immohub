"use client";

import { useEffect, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { C } from "@/lib/design-tokens";

const serif = "var(--font-serif)";
const sans  = "var(--font-sans)";

const PLACEHOLDERS = [
  "Combien vaut mon 4.5 pièces à Genève ?",
  "Trouve-moi un 3 pièces à Lausanne sous 2'500 CHF",
  "Je suis propriétaire et je veux arrêter mon agence",
  "Quel rendement pour un investissement locatif à Fribourg ?",
];

const SUGGESTIONS = [
  "Estimer mon bien",
  "Chercher à louer",
  "Chercher à acheter",
  "Je suis propriétaire",
];

export function HeroConversational({
  onSubmit,
  visible = true,
}: {
  onSubmit: (question: string) => void;
  visible?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 500ms ease, transform 500ms ease",
        pointerEvents: visible ? "auto" : "none",
        width: "min(680px, calc(100vw - 32px))",
      }}
    >
      <h1
        style={{
          textAlign: "center",
          fontFamily: serif,
          fontSize: "clamp(34px, 5.2vw, 60px)",
          fontWeight: 300,
          letterSpacing: "-0.025em",
          lineHeight: 1.05,
          color: "#ffffff",
          margin: 0,
          textShadow: "0 2px 24px rgba(15,46,76,0.55)",
        }}
      >
        Posez votre question à
        <br />
        <span style={{ color: C.gold, fontStyle: "italic", fontWeight: 400 }}>
          Althy IA
        </span>
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) {
            onSubmit(query.trim());
            setQuery("");
          }
        }}
        style={{ width: "100%" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.4)",
            padding: 6,
            boxShadow: "0 20px 60px rgba(15,46,76,0.35), 0 4px 12px rgba(0,0,0,0.12)",
          }}
        >
          <Sparkles
            size={20}
            style={{ marginLeft: 14, flexShrink: 0, color: C.gold }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={PLACEHOLDERS[placeholderIndex]}
            maxLength={500}
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 16,
              fontFamily: sans,
              color: C.text,
              padding: "14px 4px",
            }}
          />
          <button
            type="submit"
            disabled={!query.trim()}
            aria-label="Envoyer"
            style={{
              flexShrink: 0,
              padding: "12px 18px",
              borderRadius: 14,
              border: "none",
              background: query.trim() ? C.prussian : "rgba(15,46,76,0.35)",
              color: "#fff",
              cursor: query.trim() ? "pointer" : "not-allowed",
              fontFamily: sans,
              fontWeight: 600,
              fontSize: 14,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "background 0.2s",
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </form>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSubmit(s)}
            style={{
              padding: "9px 16px",
              borderRadius: 100,
              border: "1px solid rgba(255,255,255,0.35)",
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              color: "#fff",
              fontFamily: sans,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.2s, border-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.22)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.55)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.12)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)";
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <p
        style={{
          color: "rgba(255,255,255,0.72)",
          fontSize: 12,
          fontFamily: sans,
          margin: 0,
          letterSpacing: "0.04em",
          textShadow: "0 1px 6px rgba(0,0,0,0.35)",
        }}
      >
        Gratuit · Aucune inscription requise · Réponse instantanée
      </p>
    </div>
  );
}
