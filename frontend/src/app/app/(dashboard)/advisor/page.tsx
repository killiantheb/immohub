"use client";

import { useRef, useState } from "react";
import { Bot, Send, Shield } from "lucide-react";

// ── Althy tokens ──────────────────────────────────────────────────────────────
const S = {
  bg: "var(--althy-bg)",
  surface: "var(--althy-surface)",
  surface2: "var(--althy-surface-2)",
  border: "var(--althy-border)",
  text: "var(--althy-text)",
  text2: "var(--althy-text-2)",
  text3: "var(--althy-text-3)",
  orange: "var(--althy-orange)",
  orangeBg: "var(--althy-orange-bg)",
  green: "var(--althy-green)",
  greenBg: "var(--althy-green-bg)",
  red: "var(--althy-red)",
  redBg: "var(--althy-red-bg)",
  amber: "var(--althy-amber)",
  amberBg: "var(--althy-amber-bg)",
  blue: "var(--althy-blue)",
  blueBg: "var(--althy-blue-bg)",
  shadow: "var(--althy-shadow)",
  shadowMd: "var(--althy-shadow-md)",
} as const;

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Mon dépôt de garantie est-il conforme au CO ?",
  "Comment bien rédiger un état des lieux ?",
  "Quel préavis légal pour résilier un bail longue durée ?",
  "Quelles hausses de loyer sont autorisées en Suisse ?",
  "Ma commission de gérance est-elle dans les normes ?",
];

export default function AdvisorPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Bonjour ! Je suis AlthyLegal, votre conseiller en droit immobilier suisse. Je peux vous aider sur la conformité de vos baux, les états des lieux, les paiements, les commissions de gérance et bien plus. Comment puis-je vous aider ?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function handleSend(text?: string) {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }]);
    setLoading(true);

    try {
      const { api } = await import("@/lib/api");
      const { data } = await api.post<{ advice: string }>("/ai/agency-advisor", {
        question,
        context: {},
      });
      setMessages((m) => [...m, { role: "assistant", content: data.advice }]);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg =
        status === 403
          ? "Cette fonctionnalité est réservée aux agences et propriétaires."
          : "Une erreur est survenue. Réessayez dans un moment.";
      setMessages((m) => [...m, { role: "assistant", content: msg }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }

  return (
    <div style={{ maxWidth: 768, margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: S.amberBg, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${S.border}` }}>
          <Shield style={{ width: 20, height: 20, color: S.amber }} />
        </div>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontSize: 22, fontWeight: 400, color: S.text, margin: 0 }}>AlthyLegal</h1>
          <p style={{ fontSize: 12, color: S.text3, margin: 0 }}>Conseiller IA — Droit immobilier suisse (CO, LDTR)</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 16 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            {msg.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: S.amberBg, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 4, flexShrink: 0, border: `1px solid ${S.border}` }}>
                <Bot style={{ width: 16, height: 16, color: S.amber }} />
              </div>
            )}
            <div
              style={{
                maxWidth: "80%", borderRadius: 18, padding: "12px 16px", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
                ...(msg.role === "user"
                  ? { background: S.orange, color: "#fff", borderTopRightRadius: 4 }
                  : { background: S.surface, border: `1px solid ${S.border}`, color: S.text, borderTopLeftRadius: 4, boxShadow: S.shadow }),
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: S.amberBg, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 4, flexShrink: 0, border: `1px solid ${S.border}` }}>
              <Bot style={{ width: 16, height: 16, color: S.amber }} />
            </div>
            <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 18, borderTopLeftRadius: 4, padding: "12px 16px", boxShadow: S.shadow }}>
              <span style={{ display: "flex", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: S.text3, animation: "bounce 1s infinite", animationDelay: "0ms", display: "inline-block" }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: S.text3, animation: "bounce 1s infinite", animationDelay: "150ms", display: "inline-block" }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: S.text3, animation: "bounce 1s infinite", animationDelay: "300ms", display: "inline-block" }} />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions (only when 1 message) */}
      {messages.length === 1 && (
        <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              style={{ borderRadius: 20, border: `1px solid ${S.border}`, background: S.amberBg, padding: "6px 12px", fontSize: 12, color: S.amber, cursor: "pointer", fontFamily: "inherit" }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 18, border: `1px solid ${S.border}`, background: S.surface, padding: 8, boxShadow: S.shadow }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Posez votre question juridique ou sur votre portefeuille…"
          disabled={loading}
          style={{ flex: 1, border: "none", background: "transparent", padding: "0 8px", fontSize: 14, outline: "none", color: S.text, fontFamily: "inherit" }}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          style={{ width: 36, height: 36, borderRadius: 12, background: S.orange, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: (!input.trim() || loading) ? 0.4 : 1, flexShrink: 0 }}
        >
          <Send style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Disclaimer */}
      <p style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: S.text3 }}>
        Conseils indicatifs uniquement — consultez un juriste pour des décisions importantes
      </p>
    </div>
  );
}
