"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Send, Sparkles, X, ArrowRight } from "lucide-react";
import { C } from "@/lib/design-tokens";
import { BiensRecoCards } from "./BiensRecoCards";
import { EstimationRange } from "./EstimationRange";
import { AutonomieCalc } from "./AutonomieCalc";

/**
 * InlineChat — chat conversationnel CENTRÉ (pas de panneau latéral).
 *
 * Apparaît à la place de HeroInput une fois la première question posée.
 * Streaming SSE depuis /api/v1/landing/chat (rate limit 10/60s/IP, 4 tours,
 * cookie HMAC). Affiche les panneaux adaptatifs (biens / estimation /
 * autonomie) sous le dernier message assistant en fonction de l'intent.
 */

const sans  = "var(--font-sans)";
const serif = "var(--font-serif)";
const API   = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type LandingIntent = "estimation" | "recherche_bien" | "autonomie" | "hors_scope";

export type LandingEntities = {
  ville?: string;
  type?: string;
  budget?: string;
  surface?: string;
};

type Msg = { role: "user" | "assistant"; content: string };

const CTA_CONFIG: Record<string, { label: string; href: string }> = {
  estimation: { label: "Obtenir l'estimation complète gratuite",       href: "/estimation" },
  biens:      { label: "Voir tous les biens correspondants",            href: "/biens" },
  autonomie:  { label: "Découvrir Althy Autonomie (CHF 39/mois)",       href: "/autonomie" },
  register:   { label: "Créer un compte gratuit",                       href: "/register" },
};

export function InlineChat({
  initialQuestion,
  onClose,
}: {
  initialQuestion: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [messages, setMessages]       = useState<Msg[]>([]);
  const [input, setInput]             = useState("");
  const [streaming, setStreaming]     = useState(false);
  const [currentCta, setCurrentCta]   = useState<string>("register");
  const [turnsLeft, setTurnsLeft]     = useState(4);
  const [quotaReached, setQuotaReached] = useState(false);
  const [lastIntent, setLastIntent]   = useState<LandingIntent | null>(null);
  const [lastEntities, setLastEntities] = useState<LandingEntities>({});
  const scrollRef     = useRef<HTMLDivElement>(null);
  const initialSentRef = useRef<string | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch(`${API}/landing/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const line = block.trim();
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;

          try {
            const evt = JSON.parse(raw);
            if (evt.type === "text") {
              const chunk = (evt.text as string).replace(/\\n/g, "\n");
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") last.content += chunk;
                return next;
              });
            } else if (evt.type === "intent") {
              setLastIntent(evt.intent as LandingIntent);
              setLastEntities((p) => ({ ...p, ...(evt.entities ?? {}) }));
            } else if (evt.type === "done") {
              setCurrentCta(evt.cta ?? "register");
              setTurnsLeft(evt.turns_left ?? 0);
              if (evt.quota_reached) setQuotaReached(true);
            } else if (evt.type === "error") {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") last.content = "Désolé, une erreur temporaire est survenue.";
                return next;
              });
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant" && !last.content) {
          last.content = "Impossible de joindre Althy IA. Réessayez dans un instant.";
        }
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }, [streaming]);

  useEffect(() => {
    if (initialQuestion && initialSentRef.current !== initialQuestion) {
      initialSentRef.current = initialQuestion;
      void sendMessage(initialQuestion);
    }
  }, [initialQuestion, sendMessage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quotaReached) return;
    const text = input.trim();
    if (!text) return;
    setInput("");
    void sendMessage(text);
  };

  const cta = CTA_CONFIG[currentCta] ?? CTA_CONFIG.register;
  const hasOwnCta = ["recherche_bien", "estimation", "autonomie"].includes(lastIntent ?? "");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1,    y: 0 }}
      exit={{    opacity: 0, scale: 0.96, y: 12 }}
      transition={{ type: "spring", damping: 24, stiffness: 220 }}
      role="dialog"
      aria-label="Conversation avec Althy IA"
      style={{
        width: "100%",
        maxWidth: 640,
        height: "min(80vh, 720px)",
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        borderRadius: 24,
        boxShadow: "0 30px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.18)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          borderBottom: `1px solid ${C.border}`,
          background: C.prussian,
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Sparkles size={18} style={{ color: C.gold }} />
          <div>
            <div style={{ fontFamily: serif, fontSize: 16, fontWeight: 400, lineHeight: 1 }}>
              Althy IA
            </div>
            <div style={{ fontFamily: sans, fontSize: 11, opacity: 0.7, marginTop: 2, letterSpacing: "0.04em" }}>
              {quotaReached
                ? "Limite atteinte — créez un compte"
                : `${turnsLeft} question${turnsLeft > 1 ? "s" : ""} restante${turnsLeft > 1 ? "s" : ""}`}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(255,255,255,0.1)",
            color: "#fff",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={16} />
        </button>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          background: C.glacier,
        }}
      >
        {messages.map((m, i) => {
          const isLastAssistant =
            m.role === "assistant" &&
            i === messages.length - 1 &&
            !streaming &&
            m.content.length > 0;
          return (
            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "stretch",
                maxWidth: m.role === "user" ? "86%" : "100%",
              }}
            >
              <div
                style={{
                  maxWidth: m.role === "user" ? "100%" : "86%",
                  padding: "12px 16px",
                  borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: m.role === "user" ? C.prussian : "#fff",
                  color: m.role === "user" ? "#fff" : C.text,
                  fontFamily: sans,
                  fontSize: 14,
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                  boxShadow: m.role === "assistant" ? "0 1px 2px rgba(15,46,76,0.06)" : "none",
                  border: m.role === "assistant" ? `1px solid ${C.border}` : "none",
                }}
              >
                {m.content || (streaming && i === messages.length - 1 ? <TypingDots /> : null)}
              </div>
              {isLastAssistant && lastIntent === "recherche_bien" && (
                <BiensRecoCards entities={lastEntities} />
              )}
              {isLastAssistant && lastIntent === "estimation" && (
                <EstimationRange entities={lastEntities} />
              )}
              {isLastAssistant && lastIntent === "autonomie" && <AutonomieCalc />}
            </div>
          );
        })}
      </div>

      {/* CTA banner */}
      {messages.length >= 2 && !streaming && !hasOwnCta && (
        <button
          onClick={() => router.push(`${cta.href}?source=landing_chat`)}
          style={{
            margin: "0 16px 10px",
            padding: "14px 16px",
            borderRadius: 14,
            border: `1px solid ${C.goldBorder}`,
            background: C.goldBg,
            color: C.prussian,
            fontFamily: sans,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            textAlign: "left",
          }}
        >
          <span>{cta.label}</span>
          <ArrowRight size={16} style={{ flexShrink: 0 }} />
        </button>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: "12px 16px 16px",
          borderTop: `1px solid ${C.border}`,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={quotaReached ? "Créez un compte pour continuer" : "Continuez la conversation…"}
          maxLength={500}
          disabled={streaming || quotaReached}
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: quotaReached ? C.glacier : "#fff",
            fontFamily: sans,
            fontSize: 14,
            color: C.text,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={streaming || quotaReached || !input.trim()}
          aria-label="Envoyer"
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "none",
            background:
              streaming || quotaReached || !input.trim()
                ? "rgba(15,46,76,0.35)"
                : C.prussian,
            color: "#fff",
            cursor:
              streaming || quotaReached || !input.trim() ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Send size={16} />
        </button>
      </form>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: C.prussian,
            opacity: 0.4,
            animation: `althy-typing 1.2s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes althy-typing {
          0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
          30%           { opacity: 0.85; transform: translateY(-3px); }
        }
      `}</style>
    </span>
  );
}
