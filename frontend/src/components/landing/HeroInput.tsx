"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { C } from "@/lib/design-tokens";

/**
 * HeroInput — input ChatGPT-style massif au centre du hero.
 *
 * Titre serif × 2 lignes, sous-titre, input large arrondi, 4 chips de suggestion.
 * Pas de panneau latéral — le clic submit fait remonter la question au parent
 * qui swap ce composant pour <InlineChat /> à la même position.
 */

const sans  = "var(--font-sans)";
const serif = "var(--font-serif)";

const PLACEHOLDERS = [
  "Estime mon appartement à Genève...",
  "Trouve-moi un 4.5 pièces à Lausanne...",
  "Je cherche un studio à Fribourg...",
  "Comment fonctionne Althy Autonomie ?",
  "Combien je peux économiser sans agence ?",
];

const SUGGESTIONS = [
  "Estimer mon bien",
  "Chercher à louer",
  "Découvrir Althy Autonomie",
  "Voir les biens à Lausanne",
];

export function HeroInput({ onSubmit }: { onSubmit: (q: string) => void }) {
  const [value, setValue] = useState("");
  const [phIdx, setPhIdx]  = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 3500);
    return () => clearInterval(id);
  }, []);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t) return;
    onSubmit(t);
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 760,
        textAlign: "center",
        padding: "0 24px",
      }}
    >
      <h1
        className="hi-title"
        style={{
          fontFamily: serif,
          fontWeight: 300,
          color: "#fff",
          fontSize: "clamp(34px, 6vw, 64px)",
          lineHeight: 1.05,
          margin: 0,
          letterSpacing: "-0.02em",
          textShadow: "0 2px 30px rgba(0,0,0,0.4)",
        }}
      >
        L'immobilier suisse,
        <br />
        <span style={{ color: C.gold, fontStyle: "italic", fontWeight: 300 }}>réinventé</span>
      </h1>

      <p
        style={{
          marginTop: 16,
          fontFamily: sans,
          fontSize: "clamp(15px, 1.6vw, 18px)",
          color: "rgba(255,255,255,0.78)",
          lineHeight: 1.5,
          maxWidth: 520,
          margin: "16px auto 0",
        }}
      >
        Posez votre question. Althy IA répond.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        style={{
          marginTop: 38,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 10px 10px 22px",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 100,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={PLACEHOLDERS[phIdx]}
          maxLength={500}
          aria-label="Posez votre question à Althy IA"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "#fff",
            fontFamily: sans,
            fontSize: "clamp(15px, 1.5vw, 17px)",
            padding: "12px 0",
          }}
        />
        <button
          type="submit"
          aria-label="Envoyer"
          disabled={!value.trim()}
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: "none",
            background: value.trim() ? C.gold : "rgba(255,255,255,0.18)",
            color: value.trim() ? C.prussian : "rgba(255,255,255,0.5)",
            cursor: value.trim() ? "pointer" : "not-allowed",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 200ms, transform 200ms",
            boxShadow: value.trim() ? "0 4px 14px rgba(201,169,97,0.4)" : "none",
          }}
        >
          <ArrowUp size={20} strokeWidth={2.5} />
        </button>
      </form>

      <div
        style={{
          marginTop: 22,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "center",
        }}
      >
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            type="button"
            style={{
              padding: "8px 16px",
              borderRadius: 100,
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.85)",
              fontFamily: sans,
              fontSize: 13,
              cursor: "pointer",
              backdropFilter: "blur(12px)",
              transition: "background 200ms, border-color 200ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(201,169,97,0.18)";
              e.currentTarget.style.borderColor = "rgba(201,169,97,0.45)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <style>{`
        .hi-title { animation: hi-slide-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes hi-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
