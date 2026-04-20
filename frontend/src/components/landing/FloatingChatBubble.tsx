"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { C } from "@/lib/design-tokens";

/**
 * FloatingChatBubble — bouton flottant bottom-right.
 *
 * Visible uniquement quand le hero (#hero) n'est PAS dans le viewport
 * (IntersectionObserver). Cliquer scroll en haut + ouvre l'InlineChat
 * via le callback parent.
 */

const sans = "var(--font-sans)";

export function FloatingChatBubble({
  onOpen,
  hidden = false,
}: {
  onOpen: () => void;
  hidden?: boolean;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0.05 },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  const visible = show && !hidden;

  return (
    <button
      onClick={() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        onOpen();
      }}
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
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.92)",
        transition: "opacity 300ms ease, transform 300ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: C.gold,
          color: C.prussian,
        }}
      >
        <Sparkles size={15} />
      </span>
      Parler à Althy IA
    </button>
  );
}
