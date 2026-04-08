"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, ChevronDown, Loader2, Send, Sparkles, X } from "lucide-react";
import { baseURL } from "@/lib/api";
import { useUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

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
          className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
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
            <Bot className="h-3.5 w-3.5 text-primary-600" />
            <span className="text-xs font-medium text-primary-700">Althy IA</span>
          </div>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-primary-600 text-white rounded-tr-sm"
              : "bg-gray-100 text-gray-800 rounded-tl-sm"
          }`}
        >
          {display}
        </div>
        {msg.action && (
          msg.action.requires_validation ? (
            <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-1.5">
              <p className="text-xs text-amber-700 font-medium">Validation requise</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onValidate?.(msg.action!)}
                  className="flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  {msg.action.label}
                </button>
                <button
                  onClick={() => onAction(msg.action!.path)}
                  className="rounded-md border border-amber-300 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  Voir
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onAction(msg.action!.path)}
              className="mt-1 flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 transition-colors"
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
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all ${
          open ? "bg-gray-700 hover:bg-gray-800" : "bg-primary-600 hover:bg-primary-700"
        }`}
        aria-label="Ouvrir Althy IA"
      >
        {open ? (
          <ChevronDown className="h-6 w-6 text-white" />
        ) : (
          <Bot className="h-6 w-6 text-white" />
        )}
        {!open && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white">
            AI
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-[360px] flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-primary-600 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-white" />
              <div>
                <p className="text-sm font-semibold text-white">Althy IA</p>
                <p className="text-xs text-primary-200 capitalize">
                  {role ? `Copilote ${role}` : "Copilote immobilier"}
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-primary-500">
              <X className="h-4 w-4 text-white" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4" style={{ maxHeight: 380 }}>
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.content === "" && msg.role === "assistant" && streaming ? (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-3.5 py-2.5">
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
            <div className="border-t border-gray-100 px-3 py-2">
              <p className="mb-1.5 text-xs text-gray-400">Suggestions</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    disabled={streaming}
                    className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 transition-colors disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-200 p-3">
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
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-primary-400 focus:bg-white disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!input.trim() || streaming}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-colors"
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
