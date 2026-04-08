"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, ChevronDown, Loader2, Send, Sparkles, X } from "lucide-react";
import { baseURL } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  action?: { type: string; path: string; label: string; requires_validation?: boolean };
}

type UserRole = "owner" | "agency" | "tenant" | "company" | "opener" | "super_admin";

// ── Role-specific suggestions ─────────────────────────────────────────────────

const ROLE_SUGGESTIONS: Record<UserRole, string[]> = {
  owner: [
    "Rédiger un bail pour mon appartement",
    "Générer un état des lieux d'entrée",
    "Analyser mes impayés de loyer",
    "Historique complet de mon bien",
    "Relancer un locataire en retard",
    "Créer un post pour les réseaux sociaux",
  ],
  agency: [
    "Adapter le bail au profil de l'agence",
    "Exporter ma comptabilité pour le fiduciaire",
    "Analyser les performances du portefeuille",
    "Paramétrer mes commissions de gérance",
    "EDL professionnel pour un bien",
  ],
  tenant: [
    "Expliquer mon bail simplement",
    "Quels sont mes droits locataires ?",
    "Signaler un problème dans mon logement",
    "Comprendre mon état des lieux de sortie",
    "Comment contester une hausse de loyer ?",
  ],
  company: [
    "Rédiger un devis pour cet appel d'offre",
    "Voir les nouvelles opportunités",
    "Rédiger un rapport d'intervention",
    "Comment améliorer ma note ?",
  ],
  opener: [
    "Trouver des missions près de moi",
    "Rédiger mon rapport de visite",
    "Comment optimiser ma zone ?",
    "Aide pour un état des lieux",
  ],
  super_admin: [
    "Statistiques de la plateforme",
    "Analyser les transactions récentes",
    "Quels utilisateurs sont actifs ?",
  ],
};

const PAGE_SUGGESTIONS: Record<string, string[]> = {
  "/app/biens":            ["Rédiger une annonce pour ce bien", "Générer un EDL d'entrée", "Historique complet"],
  "/app/biens/new":        ["Quels documents fournir pour louer ?", "Comment fixer le loyer ?"],
  "/app/locataires":       ["Scorer ce locataire", "Générer une quittance", "Analyser les retards"],
  "/app/interventions":    ["Relancer l'artisan", "Rédiger un rapport", "Prioriser les urgences"],
  "/app/publications/new": ["Aide-moi à décrire la mission", "Quel budget prévoir ?"],
  "/app/settings":         ["Comment optimiser ma zone ?", "Configurer les notifications"],
  "/app/properties":       ["Rédiger une annonce", "Générer un EDL", "Historique du bien"],
  "/app/contracts":        ["Rédiger un bail", "Explique ce bail", "Quand résilier ?"],
  "/app/transactions":     ["Analyser mes impayés", "Relancer un locataire"],
  "/app/rfqs":             ["Rédiger un appel d'offre", "Comparer les devis"],
};

function getSuggestions(pathname: string, role?: UserRole): string[] {
  for (const [path, suggestions] of Object.entries(PAGE_SUGGESTIONS)) {
    if (pathname === path || (path !== "/" && pathname.startsWith(path))) {
      return suggestions;
    }
  }
  if (role && ROLE_SUGGESTIONS[role]) return ROLE_SUGGESTIONS[role].slice(0, 4);
  return ["Comment puis-je vous aider ?", "Réglementation locative suisse"];
}

// ── Typing dots ───────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full animate-bounce"
          style={{ backgroundColor: S.text3, animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onAction,
  onValidate,
}: {
  msg: Message;
  onAction: (path: string) => void;
  onValidate?: (action: NonNullable<Message["action"]>) => void;
}) {
  const isUser = msg.role === "user";
  const display = msg.content.replace(/\\n/g, "\n");

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] space-y-1">
        {!isUser && (
          <div className="flex items-center gap-1 mb-0.5">
            <Bot className="h-3.5 w-3.5" style={{ color: S.orange }} />
            <span className="text-xs font-medium" style={{ color: S.orange }}>Althy IA</span>
          </div>
        )}
        <div
          className="rounded-2xl px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap"
          style={{
            fontSize: 14,
            backgroundColor: isUser ? S.orange : S.surface2,
            color: isUser ? "#fff" : S.text,
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          }}
        >
          {display}
        </div>
        {msg.action && (
          msg.action.requires_validation ? (
            <div
              className="mt-1 rounded-lg px-3 py-2 space-y-1.5"
              style={{ border: `1px solid ${S.amber}`, backgroundColor: S.amberBg }}
            >
              <p className="text-xs font-medium" style={{ color: S.amber }}>Validation requise</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onValidate?.(msg.action!)}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                  style={{ backgroundColor: S.amber, color: "#fff" }}
                >
                  <Sparkles className="h-3 w-3" />
                  {msg.action.label}
                </button>
                <button
                  onClick={() => onAction(msg.action!.path)}
                  className="rounded-md px-2.5 py-1 text-xs transition-colors"
                  style={{ border: `1px solid ${S.amber}`, color: S.amber, backgroundColor: "transparent" }}
                >
                  Voir
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onAction(msg.action!.path)}
              className="mt-1 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ border: `1px solid ${S.orange}`, backgroundColor: S.orangeBg, color: S.orange }}
            >
              <Sparkles className="h-3 w-3" />
              {msg.action.label}
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
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Bonjour ! Je suis Althy IA, votre copilote immobilier suisse. Comment puis-je vous aider ?",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  const pathname = usePathname();
  const { data: profile } = useUser();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const role = profile?.role as UserRole | undefined;
  const suggestions = getSuggestions(pathname, role);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    abortRef.current = new AbortController();

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      // Use GET /ai/chat — backend auto-injects biens/locataires/interventions context
      const url = new URL(`${baseURL}/ai/chat`);
      url.searchParams.set("message", text);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: parsed.error };
                return next;
              });
              break;
            }
            if (parsed.text) {
              const chunk: string = parsed.text;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                const updated = last.content + chunk;

                const actionMatch = updated.match(/<action>([\s\S]*?)<\/action>/);
                if (actionMatch) {
                  try { actionData = JSON.parse(actionMatch[1]); } catch {}
                }

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
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: "Une erreur est survenue. Réessayez dans un instant.",
          };
          return next;
        });
      }
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full transition-all"
        style={{
          backgroundColor: open ? S.text2 : S.orange,
          boxShadow: S.shadowMd,
        }}
        aria-label="Ouvrir Althy IA"
      >
        {open ? (
          <ChevronDown className="h-6 w-6" style={{ color: "#fff" }} />
        ) : (
          <Bot className="h-6 w-6" style={{ color: "#fff" }} />
        )}
        {!open && (
          <span
            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
            style={{ backgroundColor: S.green, color: "#fff" }}
          >
            AI
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex w-[360px] flex-col rounded-2xl"
          style={{ border: `1px solid ${S.border}`, backgroundColor: S.surface, boxShadow: S.shadowMd }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between rounded-t-2xl px-4 py-3"
            style={{ backgroundColor: S.orange }}
          >
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" style={{ color: "#fff" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#fff" }}>Althy IA</p>
                <p className="text-xs capitalize" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {role ? `Copilote ${role}` : "Copilote immobilier"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 transition-colors"
              style={{ backgroundColor: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <X className="h-4 w-4" style={{ color: "#fff" }} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4" style={{ maxHeight: 380 }}>
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.content === "" && msg.role === "assistant" && streaming ? (
                  <div className="flex justify-start">
                    <div
                      className="rounded-2xl px-3.5 py-2.5"
                      style={{ backgroundColor: S.surface2, borderRadius: "16px 16px 16px 4px" }}
                    >
                      <TypingDots />
                    </div>
                  </div>
                ) : (
                  <MessageBubble
                    msg={msg}
                    onAction={(path) => { window.location.href = path; }}
                    onValidate={(action) => { window.location.href = action.path; }}
                  />
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="px-3 py-2" style={{ borderTop: `1px solid ${S.border}` }}>
              <p className="mb-1.5 text-xs" style={{ color: S.text3 }}>Suggestions</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    disabled={streaming}
                    className="rounded-full px-2.5 py-1 text-xs transition-colors disabled:opacity-50"
                    style={{ border: `1px solid ${S.border}`, backgroundColor: S.bg, color: S.text2 }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = S.orange;
                      e.currentTarget.style.backgroundColor = S.orangeBg;
                      e.currentTarget.style.color = S.orange;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = S.border;
                      e.currentTarget.style.backgroundColor = S.bg;
                      e.currentTarget.style.color = S.text2;
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-3" style={{ borderTop: `1px solid ${S.border}` }}>
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={streaming}
                placeholder="Posez votre question…"
                className="flex-1 rounded-xl px-3 py-2 outline-none disabled:opacity-60"
                style={{
                  fontSize: 14,
                  border: `1px solid ${S.border}`,
                  backgroundColor: S.bg,
                  color: S.text,
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || streaming}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors disabled:opacity-40"
                style={{ backgroundColor: S.orange, color: "#fff" }}
              >
                {streaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
