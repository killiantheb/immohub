// src/components/communication/AgendaContent.tsx
"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Link2, RefreshCw, Clock, MapPin } from "lucide-react";
import { api, baseURL } from "@/lib/api";
import { createClient } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OAuthStatus {
  provider: string;
  connected: boolean;
  expired: boolean;
  updated_at: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  provider: string | null;
  contexte_type: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const S = {
  card: {
    background: "var(--althy-surface)",
    border: "1px solid var(--althy-border)",
    borderRadius: 14,
    padding: "20px 24px",
    boxShadow: "0 1px 4px rgba(26,22,18,0.04)",
  } as React.CSSProperties,
};

const DAYS   = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function groupByDay(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const groups: Record<string, CalendarEvent[]> = {};
  for (const e of events) {
    const key = e.start_at.slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }
  return groups;
}

const CONTEXTE_LABELS: Record<string, string> = {
  intervention: "Intervention",
  mission:      "Mission",
  location:     "Location",
  vente:        "Vente",
  expertise:    "Expertise",
};

// ── AgendaContent ─────────────────────────────────────────────────────────────

export function AgendaContent() {
  const [statuts, setStatuts] = useState<OAuthStatus[]>([]);
  const [events,  setEvents]  = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [today]               = useState(new Date());

  const isConnected = statuts.some(s => s.connected && !s.expired);

  useEffect(() => {
    Promise.all([
      api.get<OAuthStatus[]>("/oauth/statut").then(r => setStatuts(r.data)).catch(() => {}),
      api.get<CalendarEvent[]>("/agenda/").then(r => setEvents(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  async function handleConnect(provider: "google" | "microsoft") {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const res  = await fetch(`${baseURL}/oauth/${provider}/autoriser`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json() as { auth_url?: string; detail?: string };
      if (data.auth_url) window.location.href = data.auth_url;
      else alert(data.detail ?? "Impossible de lancer la connexion OAuth");
    } catch { alert("Erreur lors de la connexion"); }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await api.post("/agenda/synchroniser");
      const r = await api.get<CalendarEvent[]>("/agenda/");
      setEvents(r.data);
    } catch { /* ignore */ }
    finally { setSyncing(false); }
  }

  const upcomingEvents = events
    .filter(e => new Date(e.end_at) >= today)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const grouped = groupByDay(upcomingEvents);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
        <div style={{ fontSize: 13, color: "var(--althy-text-3)" }}>Chargement…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: "var(--althy-text-3)", margin: 0 }}>
          {DAYS[(today.getDay() + 6) % 7]} {today.getDate()} {MONTHS[today.getMonth()]} {today.getFullYear()}
        </p>
        {isConnected && (
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, border: "1px solid var(--althy-border)", background: "var(--althy-surface)", cursor: "pointer", fontSize: 13, color: "var(--althy-text)", fontFamily: "inherit", opacity: syncing ? 0.6 : 1 }}
          >
            <RefreshCw size={14} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
            {syncing ? "Synchro…" : "Synchroniser"}
          </button>
        )}
      </div>

      {/* Calendar connections */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {(["google", "microsoft"] as const).map(provider => {
          const status    = statuts.find(s => s.provider === provider);
          const connected = status?.connected && !status?.expired;
          const label     = provider === "google" ? "Google Agenda" : "Outlook Calendar";
          const icon      = provider === "google" ? "📅" : "📆";
          return (
            <div key={provider} style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, padding: "14px 18px" }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--althy-text)" }}>{label}</div>
                <div style={{ fontSize: 11, color: connected ? "#16a34a" : "var(--althy-text-3)", marginTop: 2 }}>
                  {connected ? "Synchronisé" : "Non connecté"}
                </div>
              </div>
              {!connected && (
                <button
                  onClick={() => handleConnect(provider)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8, border: "none", background: "var(--althy-orange)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}
                >
                  <Link2 size={11} /> Connecter
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Events */}
      {Object.keys(grouped).length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: "48px 24px" }}>
          <CalendarDays size={40} color="var(--althy-border)" style={{ marginBottom: 16 }} />
          <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22, fontWeight: 300, color: "var(--althy-text)", margin: "0 0 8px" }}>
            Aucun événement à venir
          </h3>
          <p style={{ fontSize: 13, color: "var(--althy-text-3)", maxWidth: 400, margin: "0 auto 24px" }}>
            {isConnected
              ? "Votre agenda est synchronisé. Aucun événement immobilier détecté pour les prochains jours."
              : "Connectez Google Agenda ou Outlook pour visualiser vos rendez-vous immobiliers directement ici."
            }
          </p>
          {!isConnected && (
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => handleConnect("google")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "1px solid var(--althy-border)", background: "var(--althy-surface)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--althy-text)", fontFamily: "inherit" }}>
                📅 Google Agenda
              </button>
              <button onClick={() => handleConnect("microsoft")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "1px solid var(--althy-border)", background: "var(--althy-surface)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--althy-text)", fontFamily: "inherit" }}>
                📆 Outlook Calendar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {Object.entries(grouped).map(([dateKey, dayEvents]) => {
            const d       = new Date(dateKey + "T00:00:00");
            const isToday = isSameDay(d, today);
            return (
              <div key={dateKey}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: isToday ? "var(--althy-orange)" : "var(--althy-surface)", border: `1px solid ${isToday ? "var(--althy-orange)" : "var(--althy-border)"}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: isToday ? "#fff" : "var(--althy-text)", lineHeight: 1 }}>{d.getDate()}</span>
                    <span style={{ fontSize: 9, color: isToday ? "rgba(255,255,255,0.8)" : "var(--althy-text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{MONTHS[d.getMonth()].slice(0, 3)}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--althy-text)" }}>
                      {isToday ? "Aujourd'hui" : formatDateLong(dateKey + "T00:00:00")}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--althy-text-3)" }}>
                      {dayEvents.length} événement{dayEvents.length > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 50 }}>
                  {dayEvents.map(event => (
                    <div key={event.id} style={{ ...S.card, padding: "14px 18px", borderLeft: "3px solid var(--althy-orange)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--althy-text)", marginBottom: 4 }}>{event.title}</div>
                          {event.description && (
                            <div style={{ fontSize: 12, color: "var(--althy-text-3)", marginBottom: 4 }}>{event.description}</div>
                          )}
                          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                            {!event.all_day && (
                              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--althy-text-3)" }}>
                                <Clock size={11} /> {formatTime(event.start_at)} – {formatTime(event.end_at)}
                              </span>
                            )}
                            {event.location && (
                              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--althy-text-3)" }}>
                                <MapPin size={11} /> {event.location}
                              </span>
                            )}
                          </div>
                        </div>
                        {event.contexte_type && (
                          <span style={{ padding: "2px 8px", borderRadius: 6, background: "var(--althy-orange-bg, rgba(232,96,44,0.08))", color: "var(--althy-orange)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
                            {CONTEXTE_LABELS[event.contexte_type] ?? event.contexte_type}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
