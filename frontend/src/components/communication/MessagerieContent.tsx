// src/components/communication/MessagerieContent.tsx
"use client";

import { useEffect, useState } from "react";
import { Mail, RefreshCw, Inbox, Link2, Unlink, Info } from "lucide-react";
import { api, baseURL } from "@/lib/api";
import { createClient } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OAuthStatus {
  provider: string;
  connected: boolean;
  expired: boolean;
  updated_at: string | null;
}

interface EmailItem {
  id: string;
  subject: string;
  sender: string;
  received_at: string;
  body_preview: string;
  is_processed: boolean;
  labels: string[];
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

  badge: (connected: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: connected ? "rgba(34,197,94,0.1)" : "rgba(15,46,76,0.08)",
    color: connected ? "var(--althy-green)" : "var(--althy-orange)",
    border: `1px solid ${connected ? "rgba(34,197,94,0.2)" : "rgba(15,46,76,0.2)"}`,
  }),
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-CH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ── ProviderCard ──────────────────────────────────────────────────────────────

function ProviderCard({ status, provider, onConnect, onDisconnect }: {
  status: OAuthStatus | null;
  provider: "google" | "microsoft";
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const isGoogle  = provider === "google";
  const icon      = isGoogle ? "📧" : "📩";
  const name      = isGoogle ? "Gmail" : "Outlook";
  const connected = status?.connected && !status?.expired;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--althy-border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--althy-text)" }}>{name}</div>
          {connected && status?.updated_at && (
            <div style={{ fontSize: 11, color: "var(--althy-text-3)", marginTop: 2 }}>
              Synchronisé {formatDate(status.updated_at)}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={S.badge(!!connected)}>{connected ? "Connecté" : "Non connecté"}</span>
        {connected ? (
          <button
            onClick={onDisconnect}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--althy-border)", background: "var(--althy-bg)", color: "var(--althy-text-3)", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}
          >
            <Unlink size={12} /> Déconnecter
          </button>
        ) : (
          <button
            onClick={onConnect}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--althy-orange)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}
          >
            <Link2 size={12} /> Connecter
          </button>
        )}
      </div>
    </div>
  );
}

// ── MessagerieContent ─────────────────────────────────────────────────────────

export function MessagerieContent() {
  const [statuts, setStatuts] = useState<OAuthStatus[]>([]);
  const [emails,  setEmails]  = useState<EmailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const googleStatus  = statuts.find(s => s.provider === "google")    ?? null;
  const outlookStatus = statuts.find(s => s.provider === "microsoft") ?? null;
  const isConnected   = statuts.some(s => s.connected && !s.expired);

  useEffect(() => {
    api.get<OAuthStatus[]>("/oauth/statut")
      .then(r => setStatuts(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));

    api.get<EmailItem[]>("/messagerie/")
      .then(r => setEmails(r.data))
      .catch(() => {});
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

  async function handleDisconnect(provider: string) {
    try {
      await api.delete(`/oauth/${provider}`);
      setStatuts(prev => prev.filter(s => s.provider !== provider));
    } catch { /* ignore */ }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncToast(null);
    try {
      await api.post("/messagerie/synchroniser");
      setSyncToast("Synchronisation en cours, cela peut prendre quelques minutes.");
      setTimeout(() => setSyncToast(null), 6000);
      const r = await api.get<EmailItem[]>("/messagerie/");
      setEmails(r.data);
    } catch {
      setSyncToast("Erreur lors de la synchronisation.");
      setTimeout(() => setSyncToast(null), 5000);
    } finally { setSyncing(false); }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
        <div style={{ fontSize: 13, color: "var(--althy-text-3)" }}>Chargement…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860 }}>

      {/* Banner — sync pas encore implémentée */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px", marginBottom: 16,
        background: "rgba(15,46,76,0.06)", border: "1px solid rgba(15,46,76,0.15)",
        borderRadius: 10, fontSize: 13, color: "var(--althy-text-2)",
      }}>
        <Info size={15} color="var(--althy-orange)" style={{ flexShrink: 0 }} />
        Synchronisation email bientôt disponible. Nous vous enverrons un email dès l&apos;activation.
      </div>

      {/* Toast sync */}
      {syncToast && (
        <div style={{
          padding: "10px 16px", marginBottom: 12,
          background: "var(--althy-surface)", border: "1px solid var(--althy-border)",
          borderRadius: 10, fontSize: 13, color: "var(--althy-text)",
        }}>
          {syncToast}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        {isConnected && (
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, border: "1px solid var(--althy-border)", background: "var(--althy-surface)", cursor: "pointer", fontSize: 13, color: "var(--althy-text)", fontFamily: "inherit", opacity: syncing ? 0.6 : 1 }}
          >
            <RefreshCw size={14} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
            {syncing ? "Synchronisation…" : "Synchroniser"}
          </button>
        )}
      </div>

      {/* Connection cards */}
      <div style={{ ...S.card, marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--althy-text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
          Comptes connectés
        </p>
        <p style={{ fontSize: 12, color: "var(--althy-text-3)", marginBottom: 16 }}>
          Althy analyse vos emails immobiliers pour créer automatiquement des actions dans Althy IA.
        </p>
        <ProviderCard status={googleStatus}  provider="google"    onConnect={() => handleConnect("google")}    onDisconnect={() => handleDisconnect("google")} />
        <ProviderCard status={outlookStatus} provider="microsoft" onConnect={() => handleConnect("microsoft")} onDisconnect={() => handleDisconnect("microsoft")} />
      </div>

      {/* Email inbox */}
      {isConnected ? (
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Inbox size={15} color="var(--althy-text-3)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--althy-text)" }}>
              Boîte de réception immobilière
            </span>
            {emails.length > 0 && (
              <span style={{ padding: "1px 8px", borderRadius: 20, background: "var(--althy-orange-bg)", color: "var(--althy-orange)", fontSize: 11, fontWeight: 700 }}>
                {emails.length}
              </span>
            )}
          </div>

          {emails.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <Mail size={32} color="var(--althy-border)" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 13, color: "var(--althy-text-3)", margin: 0 }}>
                Aucun email immobilier détecté pour le moment.
              </p>
              <p style={{ fontSize: 12, color: "var(--althy-text-3)", marginTop: 6 }}>
                La prochaine synchronisation analysera vos emails récents.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {emails.map(email => (
                <div key={email.id} style={{ padding: "12px 14px", borderRadius: 10, background: email.is_processed ? "var(--althy-bg)" : "var(--althy-surface)", border: "1px solid var(--althy-border)", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: email.is_processed ? 400 : 600, color: "var(--althy-text)" }}>
                      {email.subject ?? "(Sans objet)"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--althy-text-3)", flexShrink: 0 }}>
                      {email.received_at ? formatDate(email.received_at) : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--althy-text-3)" }}>
                    {email.sender} — {email.body_preview?.slice(0, 80) ?? ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...S.card, textAlign: "center", padding: "40px 24px" }}>
          <Mail size={40} color="var(--althy-border)" style={{ marginBottom: 16 }} />
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 300, color: "var(--althy-text)", margin: "0 0 8px" }}>
            Connectez votre messagerie
          </h3>
          <p style={{ fontSize: 13, color: "var(--althy-text-3)", maxWidth: 420, margin: "0 auto 24px" }}>
            Althy analyse vos emails immobiliers et crée automatiquement des actions dans Althy IA.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => handleConnect("google")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "1px solid var(--althy-border)", background: "var(--althy-surface)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--althy-text)", fontFamily: "inherit" }}>
              📧 Connecter Gmail
            </button>
            <button onClick={() => handleConnect("microsoft")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "1px solid var(--althy-border)", background: "var(--althy-surface)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--althy-text)", fontFamily: "inherit" }}>
              📩 Connecter Outlook
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
