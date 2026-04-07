"use client";

import { useRef, useState } from "react";
import { Bot, Send, Shield } from "lucide-react";

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
    <div className="mx-auto flex max-w-3xl flex-col" style={{ height: "calc(100vh - 120px)" }}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
          <Shield className="h-5 w-5 text-amber-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">AlthyLegal</h1>
          <p className="text-xs text-gray-500">Conseiller IA — Droit immobilier suisse (CO, LDTR)</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <Bot className="h-4 w-4 text-amber-700" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-amber-600 text-white rounded-tr-sm"
                  : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <Bot className="h-4 w-4 text-amber-700" />
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3">
              <span className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions (only when 1 message) */}
      {messages.length === 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 hover:bg-amber-100 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Posez votre question juridique ou sur votre portefeuille…"
          className="flex-1 border-none bg-transparent px-2 text-sm outline-none text-gray-900 placeholder:text-gray-400"
          disabled={loading}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white transition-opacity disabled:opacity-40 hover:bg-amber-700"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Disclaimer */}
      <p className="mt-2 text-center text-xs text-gray-400">
        Conseils indicatifs uniquement — consultez un juriste pour des décisions importantes
      </p>
    </div>
  );
}
