// src/components/communication/WhatsAppContent.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Phone, Search, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  contact_phone: string;
  contact_name: string | null;
  last_message_at: string | null;
  unread_count: number;
  contexte_type: string | null;
  contexte_id: string | null;
}

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  status: string;
  sent_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const S = {
  card: {
    background: "var(--althy-surface)",
    border: "1px solid var(--althy-border)",
    borderRadius: 14,
    boxShadow: "0 1px 4px rgba(26,22,18,0.04)",
  } as React.CSSProperties,
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit" });
}

function initials(name: string | null, phone: string) {
  if (name) return name.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
  return phone.slice(-2);
}

// ── WhatsAppContent ───────────────────────────────────────────────────────────

export function WhatsAppContent() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [selected,      setSelected]      = useState<Conversation | null>(null);
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [search,        setSearch]        = useState("");
  const [aiSuggestion,  setAiSuggestion]  = useState<string | null>(null);
  const [aiLoading,     setAiLoading]     = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase  = createClient();

  // ── Load conversations ───────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const r = await api.get<Conversation[]>("/whatsapp/conversations");
      setConversations(r.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Supabase Realtime ────────────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, (payload) => {
        const msg = payload.new as { conversation_id: string; id: string; direction: "inbound" | "outbound"; body: string; status: string; sent_at: string };
        loadConversations();
        if (selected && msg.conversation_id === selected.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, { id: msg.id, direction: msg.direction, body: msg.body, status: msg.status, sent_at: msg.sent_at ?? new Date().toISOString() }];
          });
        }
        if (msg.direction === "inbound" && selected && msg.conversation_id === selected.id) {
          generateAiSuggestion(selected, msg.body);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // ── Load messages ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selected) return;
    setAiSuggestion(null);
    api.get<Message[]>(`/whatsapp/conversations/${selected.id}/messages`)
      .then(r => setMessages(r.data))
      .catch(() => setMessages([]));
    api.post(`/whatsapp/conversations/${selected.id}/lire`).catch(() => null);
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── AI suggestion ────────────────────────────────────────────────────────────

  async function generateAiSuggestion(conv: Conversation, lastMsg?: string) {
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const { data } = await api.post<{ suggestion: string }>("/whatsapp/suggestion-ia", {
        conversation_id: conv.id,
        dernier_message: lastMsg ?? messages[messages.length - 1]?.body,
        contact_name:    conv.contact_name,
      });
      setAiSuggestion(data.suggestion ?? null);
    } catch { /* ignore */ }
    finally { setAiLoading(false); }
  }

  // ── Send ─────────────────────────────────────────────────────────────────────

  async function handleSend() {
    if (!input.trim() || !selected || sending) return;
    const body = input.trim();
    setInput("");
    setSending(true);
    try {
      const res = await api.post<Message>(`/whatsapp/conversations/${selected.id}/messages`, { body });
      setMessages(prev => [...prev, res.data]);
      setAiSuggestion(null);
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  const filtered = conversations.filter(c =>
    (c.contact_name?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
    c.contact_phone.includes(search)
  );

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
        <div style={{ fontSize: 13, color: "var(--althy-text-3)" }}>Chargement…</div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div style={{ ...S.card, textAlign: "center", padding: "56px 24px" }}>
        <MessageCircle size={44} color="var(--althy-border)" style={{ marginBottom: 16 }} />
        <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22, fontWeight: 300, color: "var(--althy-text)", margin: "0 0 8px" }}>
          Aucune conversation WhatsApp
        </h3>
        <p style={{ fontSize: 13, color: "var(--althy-text-3)", maxWidth: 440, margin: "0 auto 20px", lineHeight: 1.6 }}>
          Vos conversations WhatsApp apparaîtront ici. Configurez votre numéro WhatsApp Business dans les paramètres.
        </p>
        <a href="/app/settings" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: "var(--althy-orange)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          Configurer WhatsApp →
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 0, ...S.card, overflow: "hidden", height: "calc(100vh - 260px)", minHeight: 500 }}>

      {/* Conversations list */}
      <div style={{ borderRight: "1px solid var(--althy-border)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--althy-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: "var(--althy-bg)", borderRadius: 10, border: "1px solid var(--althy-border)" }}>
            <Search size={13} color="var(--althy-text-3)" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--althy-text)", fontFamily: "inherit" }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.map(conv => {
            const active = selected?.id === conv.id;
            return (
              <button
                key={conv.id}
                onClick={() => setSelected(conv)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: active ? "var(--althy-orange-bg, rgba(232,96,44,0.06))" : "transparent", border: "none", borderBottom: "1px solid var(--althy-border)", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
              >
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: active ? "var(--althy-orange)" : "var(--althy-border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: active ? "#fff" : "var(--althy-text-3)" }}>
                    {initials(conv.contact_name, conv.contact_phone)}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: conv.unread_count > 0 ? 700 : 600, color: "var(--althy-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {conv.contact_name ?? conv.contact_phone}
                    </span>
                    {conv.last_message_at && (
                      <span style={{ fontSize: 10, color: "var(--althy-text-3)", flexShrink: 0, marginLeft: 8 }}>
                        {formatTime(conv.last_message_at)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: "var(--althy-text-3)" }}>{conv.contact_phone}</span>
                    {conv.unread_count > 0 && (
                      <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: "#25D366", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages panel */}
      {selected ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--althy-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--althy-orange)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{initials(selected.contact_name, selected.contact_phone)}</span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--althy-text)" }}>{selected.contact_name ?? selected.contact_phone}</div>
                <div style={{ fontSize: 11, color: "var(--althy-text-3)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Phone size={10} /> {selected.contact_phone}
                </div>
              </div>
            </div>
            <button
              onClick={() => generateAiSuggestion(selected)}
              disabled={aiLoading}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, border: "1px solid var(--althy-border)", background: "var(--althy-bg)", cursor: "pointer", fontSize: 12, color: "var(--althy-orange)", fontWeight: 600, opacity: aiLoading ? 0.6 : 1 }}
            >
              <Sparkles size={13} color="var(--althy-orange)" />
              {aiLoading ? "Génération…" : "Réponse IA"}
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
                <p style={{ fontSize: 13, color: "var(--althy-text-3)" }}>Aucun message dans cette conversation.</p>
              </div>
            ) : (
              messages.map(msg => {
                const isOut = msg.direction === "outbound";
                return (
                  <div key={msg.id} style={{ display: "flex", justifyContent: isOut ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "70%", padding: "9px 13px", borderRadius: isOut ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: isOut ? "#25D366" : "var(--althy-bg)", border: isOut ? "none" : "1px solid var(--althy-border)" }}>
                      <p style={{ fontSize: 13, color: isOut ? "#fff" : "var(--althy-text)", margin: 0, lineHeight: 1.5 }}>{msg.body}</p>
                      <p style={{ fontSize: 10, color: isOut ? "rgba(255,255,255,0.7)" : "var(--althy-text-3)", margin: "4px 0 0", textAlign: "right" }}>
                        {formatTime(msg.sent_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* AI suggestion banner */}
          {aiSuggestion && (
            <div style={{ margin: "0 16px 8px", padding: "10px 14px", background: "var(--althy-orange-bg, rgba(232,96,44,0.08))", border: "1px solid rgba(232,96,44,0.2)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <Sparkles size={14} color="var(--althy-orange)" />
              <p style={{ flex: 1, margin: 0, fontSize: 12, color: "var(--althy-text)", lineHeight: 1.5 }}>{aiSuggestion}</p>
              <button onClick={() => { setInput(aiSuggestion); setAiSuggestion(null); }} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "var(--althy-orange)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Utiliser
              </button>
              <button onClick={() => setAiSuggestion(null)} style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid var(--althy-border)", background: "transparent", cursor: "pointer", fontSize: 11, color: "var(--althy-text-3)" }}>
                ✕
              </button>
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--althy-border)", display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Écrire un message…"
              disabled={sending}
              style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: "1px solid var(--althy-border)", background: "var(--althy-bg)", fontSize: 13, color: "var(--althy-text)", outline: "none", fontFamily: "inherit" }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              style={{ padding: "9px 16px", borderRadius: 10, background: "#25D366", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: sending || !input.trim() ? 0.5 : 1 }}
            >
              <Send size={15} color="#fff" />
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div style={{ textAlign: "center" }}>
            <MessageCircle size={36} color="var(--althy-border)" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 13, color: "var(--althy-text-3)" }}>Sélectionnez une conversation</p>
          </div>
        </div>
      )}
    </div>
  );
}
