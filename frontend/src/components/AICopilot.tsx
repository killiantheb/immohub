"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Send, Sparkles, X } from "lucide-react";
import { baseURL } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:        "var(--althy-bg)",
  surface:   "var(--althy-surface)",
  surface2:  "var(--althy-surface-2)",
  border:    "var(--althy-border)",
  text:      "var(--althy-text)",
  text2:     "var(--althy-text-2)",
  text3:     "var(--althy-text-3)",
  orange:    "var(--althy-orange)",
  orangeBg:  "var(--althy-orange-bg)",
  amber:     "var(--althy-amber)",
  amberBg:   "var(--althy-amber-bg)",
  shadow:    "var(--althy-shadow)",
  shadowMd:  "var(--althy-shadow-md)",
  shadowLg:  "var(--althy-shadow-lg)",
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  action?: { type: string; path: string; label: string; requires_validation?: boolean };
}

type SphereState = "idle" | "listening" | "streaming";
type UserRole = "owner" | "agency" | "tenant" | "company" | "opener" | "super_admin";

// ── Contextual suggestions ────────────────────────────────────────────────────

const ROLE_SUGGESTIONS: Record<UserRole, string[]> = {
  owner:       ["Rédiger un bail", "Générer un état des lieux", "Analyser mes impayés", "Relancer un locataire"],
  agency:      ["Adapter le bail à l'agence", "Export comptabilité fiduciaire", "Analyse du portefeuille", "EDL professionnel"],
  tenant:      ["Expliquer mon bail", "Signaler un problème", "Contester une hausse de loyer", "Mes droits locataires"],
  company:     ["Rédiger un devis", "Nouvelles opportunités", "Rapport d'intervention", "Améliorer ma note"],
  opener:      ["Missions près de moi", "Rapport de visite", "Optimiser ma zone", "Aide état des lieux"],
  super_admin: ["Stats plateforme", "Transactions récentes", "Utilisateurs actifs", "Alertes système"],
};

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  "/app/biens":        ["Rédiger une annonce pour ce bien", "Générer un EDL d'entrée", "Historique complet"],
  "/app/contracts":    ["Rédiger un bail", "Explique ce bail", "Quand résilier ?"],
  "/app/transactions": ["Analyser mes impayés", "Relancer un locataire"],
  "/app/artisans/devis": ["Rédiger un appel d'offre", "Comparer les devis"],
  "/app/interventions":["Relancer l'artisan", "Rédiger un rapport", "Prioriser les urgences"],
};

function getSuggestions(pathname: string, role?: UserRole): string[] {
  for (const [path, suggestions] of Object.entries(PAGE_SUGGESTIONS)) {
    if (pathname.startsWith(path)) return suggestions;
  }
  if (role && ROLE_SUGGESTIONS[role]) return ROLE_SUGGESTIONS[role];
  return ["Comment puis-je vous aider ?", "Réglementation locative suisse", "Générer un document", "Analyser mes biens"];
}

// ── CSS keyframes (injected once) ─────────────────────────────────────────────

const SPHERE_CSS = `
@keyframes althy-sphere-idle {
  0%, 100% { transform: scale(1);    filter: brightness(1);   }
  50%       { transform: scale(1.04); filter: brightness(1.08); }
}
@keyframes althy-sphere-listen {
  0%, 100% { transform: scale(1);    filter: brightness(1.05); }
  50%       { transform: scale(1.07); filter: brightness(1.15); }
}
@keyframes althy-sphere-stream {
  0%   { transform: scale(1);    filter: brightness(1);    }
  25%  { transform: scale(1.06); filter: brightness(1.12); }
  50%  { transform: scale(1.02); filter: brightness(1.08); }
  75%  { transform: scale(1.08); filter: brightness(1.15); }
  100% { transform: scale(1);    filter: brightness(1);    }
}
@keyframes althy-ring-out {
  0%   { transform: scale(1);   opacity: 0.55; }
  100% { transform: scale(2.6); opacity: 0;    }
}
@keyframes althy-ring-out-2 {
  0%   { transform: scale(1);   opacity: 0.35; }
  100% { transform: scale(2.2); opacity: 0;    }
}
@keyframes althy-glow-pulse {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1;   }
}
@keyframes althy-dots {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40%           { transform: scale(1);   opacity: 1;   }
}
@keyframes althy-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0);   }
}
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = SPHERE_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ── Sphere orb visual ─────────────────────────────────────────────────────────

function SphereOrb({ state, size = 56 }: { state: SphereState; size?: number }) {
  const anim = {
    idle:      "althy-sphere-idle 3.5s ease-in-out infinite",
    listening: "althy-sphere-listen 1.8s ease-in-out infinite",
    streaming: "althy-sphere-stream 1.2s ease-in-out infinite",
  }[state];

  const glowColor = "rgba(232,96,44,";
  const glowIntensity = { idle: 0.4, listening: 0.55, streaming: 0.65 }[state];

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {/* Outer glow rings — only when listening or streaming */}
      {state !== "idle" && (
        <>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            backgroundColor: glowColor + "0.18)",
            animation: "althy-ring-out 1.8s ease-out infinite",
          }} />
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            backgroundColor: glowColor + "0.12)",
            animation: "althy-ring-out-2 1.8s ease-out 0.6s infinite",
          }} />
        </>
      )}

      {/* Ambient glow */}
      <div style={{
        position: "absolute",
        inset: -size * 0.18,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${glowColor}${glowIntensity}) 0%, transparent 70%)`,
        animation: "althy-glow-pulse 2.5s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* The sphere itself */}
      <div style={{
        position: "relative", width: size, height: size, borderRadius: "50%",
        background: "radial-gradient(circle at 33% 28%, #F9A06A 0%, #E86030 42%, #B83C12 78%, #6E2008 100%)",
        boxShadow: `
          0 ${size * 0.1}px ${size * 0.45}px ${glowColor}${glowIntensity + 0.05}),
          inset 0 -${size * 0.06}px ${size * 0.12}px rgba(0,0,0,0.32),
          inset 0  ${size * 0.04}px ${size * 0.10}px rgba(255,255,255,0.12)
        `,
        animation: anim,
        cursor: "pointer",
        overflow: "hidden",
      }}>
        {/* Glossy highlight */}
        <div style={{
          position: "absolute",
          top: "14%", left: "20%",
          width: "32%", height: "24%",
          background: "radial-gradient(ellipse, rgba(255,255,255,0.52) 0%, transparent 100%)",
          borderRadius: "50%",
          transform: "rotate(-25deg)",
          pointerEvents: "none",
        }} />

        {/* Secondary smaller highlight */}
        <div style={{
          position: "absolute",
          top: "52%", left: "58%",
          width: "14%", height: "10%",
          background: "radial-gradient(ellipse, rgba(255,255,255,0.18) 0%, transparent 100%)",
          borderRadius: "50%",
          pointerEvents: "none",
        }} />
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          display: "inline-block",
          width: 6, height: 6,
          borderRadius: "50%",
          backgroundColor: T.orange,
          animation: `althy-dots 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </span>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg, onAction, onValidate,
}: {
  msg: Message;
  onAction: (path: string) => void;
  onValidate?: (action: NonNullable<Message["action"]>) => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      style={{ animation: "althy-fade-up 0.25s ease-out" }}
    >
      <div style={{ maxWidth: "84%", display: "flex", flexDirection: "column", gap: 4 }}>
        {!isUser && (
          <span style={{ fontSize: 10, fontWeight: 600, color: T.orange, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Althy
          </span>
        )}
        <div style={{
          padding: "10px 14px",
          borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
          backgroundColor: isUser ? T.orange : T.surface2,
          color: isUser ? "#fff" : T.text,
          fontSize: 13.5,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {msg.content.replace(/\\n/g, "\n")}
        </div>

        {msg.action && (
          msg.action.requires_validation ? (
            <div style={{
              padding: "10px 12px", borderRadius: 10,
              border: `1px solid ${T.amber}`,
              backgroundColor: T.amberBg,
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: T.amber, margin: 0 }}>Validation requise</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => onValidate?.(msg.action!)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 10px", borderRadius: 7, border: "none",
                    backgroundColor: T.amber, color: "#fff",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  <Sparkles size={11} /> {msg.action.label}
                </button>
                <button
                  onClick={() => onAction(msg.action!.path)}
                  style={{
                    padding: "5px 10px", borderRadius: 7,
                    border: `1px solid ${T.amber}`, backgroundColor: "transparent",
                    color: T.amber, fontSize: 12, cursor: "pointer",
                  }}
                >
                  Voir
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onAction(msg.action!.path)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 8,
                border: `1px solid ${T.orange}`,
                backgroundColor: T.orangeBg, color: T.orange,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Sparkles size={12} /> {msg.action.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AICopilot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Bonjour ! Je suis Althy — votre assistant immobilier suisse. Parlez-moi, je m'occupe du reste.",
  }]);
  const [input, setInput] = useState("");
  const [sphereState, setSphereState] = useState<SphereState>("idle");

  const pathname  = usePathname();
  const router    = useRouter();
  const { data: profile } = useUser();
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const abortRef   = useRef<AbortController | null>(null);

  const role        = profile?.role as UserRole | undefined;
  const suggestions = getSuggestions(pathname, role);
  const streaming   = sphereState === "streaming";

  // Inject CSS once
  useEffect(() => { injectCSS(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;

    setMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");
    setSphereState("streaming");
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    abortRef.current = new AbortController();

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const url = new URL(`${baseURL}/sphere/chat`);
      url.searchParams.set("message", text);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader  = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";
      let actionData: Message["action"] | undefined;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") break;

          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) {
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: parsed.error };
                return next;
              });
              break;
            }
            if (parsed.text) {
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                const updated = last.content + (parsed.text as string);
                const actionMatch = updated.match(/<action>([\s\S]*?)<\/action>/);
                if (actionMatch) { try { actionData = JSON.parse(actionMatch[1]); } catch {} }
                next[next.length - 1] = {
                  ...last,
                  content: updated.replace(/<action>[\s\S]*?<\/action>/, "").trim(),
                  action: actionData,
                };
                return next;
              });
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: "Erreur de connexion. Réessayez." };
          return next;
        });
      }
    } finally {
      setSphereState("idle");
    }
  }

  return (
    <>
      {/* ── Chat panel ────────────────────────────────────────────────────── */}
      {open && (
        <div
          style={{
            position: "fixed", bottom: 88, right: 24, zIndex: 50,
            width: 368,
            display: "flex", flexDirection: "column",
            borderRadius: 20,
            border: `1px solid ${T.border}`,
            backgroundColor: T.surface,
            boxShadow: T.shadowLg,
            overflow: "hidden",
            animation: "althy-fade-up 0.2s ease-out",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "14px 16px",
            background: "radial-gradient(circle at 15% 50%, #F9A06A 0%, #E86030 45%, #C04010 100%)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SphereOrb state={sphereState} size={32} />
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
                  Althy IA
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.72)" }}>
                  {role ? `Copilote ${role}` : "Assistant immobilier suisse"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "rgba(255,255,255,0.15)", border: "none",
                borderRadius: 8, padding: 6, cursor: "pointer", color: "#fff",
                display: "flex", alignItems: "center",
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "16px 14px",
            display: "flex", flexDirection: "column", gap: 12,
            maxHeight: 380,
          }}>
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.content === "" && msg.role === "assistant" && streaming ? (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={{
                      padding: "10px 14px", borderRadius: "4px 16px 16px 16px",
                      backgroundColor: T.surface2,
                    }}>
                      <TypingDots />
                    </div>
                  </div>
                ) : (
                  <MessageBubble
                    msg={msg}
                    onAction={path => { router.push(path); setOpen(false); }}
                    onValidate={action => { router.push(action.path); setOpen(false); }}
                  />
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 2 && (
            <div style={{
              padding: "0 12px 8px",
              display: "flex", flexWrap: "wrap", gap: 6,
            }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  style={{
                    padding: "5px 10px", borderRadius: 20,
                    border: `1px solid ${T.border}`,
                    backgroundColor: T.surface2, color: T.text2,
                    fontSize: 11.5, cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = T.orange)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: "10px 12px",
            borderTop: `1px solid ${T.border}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                setSphereState(e.target.value ? "listening" : "idle");
              }}
              onBlur={() => { if (!streaming) setSphereState("idle"); }}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
              }}
              placeholder="Posez votre question..."
              disabled={streaming}
              style={{
                flex: 1, border: `1px solid ${T.border}`, borderRadius: 12,
                padding: "8px 12px", fontSize: 13.5,
                backgroundColor: T.surface2, color: T.text,
                outline: "none",
              }}
              onFocus={e => (e.target.style.borderColor = T.orange)}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              style={{
                width: 36, height: 36, borderRadius: 10, border: "none",
                backgroundColor: input.trim() && !streaming ? T.orange : T.surface2,
                color: input.trim() && !streaming ? "#fff" : T.text3,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: input.trim() && !streaming ? "pointer" : "default",
                transition: "background-color 0.15s",
                flexShrink: 0,
              }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Floating sphere button ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Althy IA"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 50,
          background: "none", border: "none", padding: 0, cursor: "pointer",
        }}
      >
        {open ? (
          /* Close state — small flat circle */
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "radial-gradient(circle at 33% 28%, #F9A06A, #E86030 45%, #B83C12 80%, #6E2008 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(232,96,44,0.45)",
          }}>
            <ChevronDown size={20} color="#fff" />
          </div>
        ) : (
          <SphereOrb state={sphereState} size={56} />
        )}
      </button>
    </>
  );
}
