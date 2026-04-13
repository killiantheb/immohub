// src/components/dashboards/DashboardPortail.tsx
// Vue LECTURE SEULE — portail_proprio — max 200 lignes
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, FileText, Download, Send, Sparkles, MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import { DC, DCard, DKpi, DTopNav, DSectionTitle, DEmptyState } from "./DashBoardShared";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Bien  { id: string; adresse: string; type: string; loyer: number; loyer_statut: "recu" | "en_attente" | "retard" }
interface Doc   { id: string; label: string; type: string; url: string; bien_id?: string }
interface MsgItem { id: string; sender: "proprio" | "agence" | "ai"; content: string; created_at: string }
interface PortailData {
  agence_nom: string; first_name: string;
  biens: Bien[]; documents: Doc[]; messages: MsgItem[];
}

// ── Mock (fallback si API pas encore branchée) ────────────────────────────────

const MOCK: PortailData = {
  agence_nom: "Agence Dupont Immobilier", first_name: "",
  biens: [
    { id: "1", adresse: "Rue de Rive 12, 1204 Genève",        type: "Appartement", loyer: 2400, loyer_statut: "recu" },
    { id: "2", adresse: "Av. de la Gare 8, 1003 Lausanne",    type: "Studio",      loyer: 1200, loyer_statut: "en_attente" },
  ],
  documents: [
    { id: "1", label: "Quittance avril 2026",  type: "quittance", url: "#", bien_id: "1" },
    { id: "2", label: "Contrat de bail",        type: "bail",      url: "#", bien_id: "1" },
    { id: "3", label: "Quittance mars 2026",   type: "quittance", url: "#", bien_id: "2" },
  ],
  messages: [],
};

// ── Statut loyer badge ─────────────────────────────────────────────────────────

const LOYER_STATUT: Record<string, { emoji: string; color: string; bg: string }> = {
  recu:       { emoji: "✅", color: "var(--althy-green)",  bg: "var(--althy-green-bg)" },
  en_attente: { emoji: "⏳", color: "#D97706",             bg: "rgba(217,119,6,0.10)" },
  retard:     { emoji: "🔴", color: "var(--althy-red, #ef4444)", bg: "rgba(239,68,68,0.10)" },
};

// ── DashboardPortail ──────────────────────────────────────────────────────────

interface Props { firstName?: string }

export function DashboardPortail({ firstName = "" }: Props) {
  const [filterBien, setFilterBien]     = useState<string | null>(null);
  const [msgInput,   setMsgInput]       = useState("");
  const [msgSent,    setMsgSent]        = useState(false);
  const [iaInput,    setIaInput]        = useState("");
  const [iaReply,    setIaReply]        = useState("");
  const [iaLoading,  setIaLoading]      = useState(false);

  const { data } = useQuery<PortailData>({
    queryKey: ["portail-me"],
    queryFn: () => api.get<PortailData>("/portail/me/dashboard").then(r => r.data),
  });
  const d = data ?? MOCK;
  const name = firstName || d.first_name || "";

  const docsFiltres = filterBien
    ? d.documents.filter(doc => doc.bien_id === filterBien)
    : d.documents;

  async function sendMessage() {
    if (!msgInput.trim()) return;
    try { await api.post("/portail/me/signalement", { type: "contact", message: msgInput.trim() }); }
    catch { /* best-effort */ }
    setMsgInput(""); setMsgSent(true);
  }

  async function askIA() {
    if (!iaInput.trim() || iaLoading) return;
    setIaLoading(true); setIaReply("");
    try {
      const { data: r } = await api.post<{ reply: string }>("/ai/chat", { message: iaInput, context: "portail_proprio" });
      setIaReply(r.reply ?? "Je n'ai pas pu répondre, réessayez.");
    } catch { setIaReply("Service temporairement indisponible."); }
    finally { setIaLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: DC.bg, maxWidth: 820, margin: "0 auto" }}>
      <DTopNav />

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: 28, fontWeight: 300, fontFamily: DC.serif, color: DC.text, margin: "0 0 4px" }}>
          Bonjour{name ? `, ${name}` : ""}
        </h1>
        <p style={{ fontSize: 13, color: DC.muted, margin: 0 }}>
          Vos biens gérés par {d.agence_nom}
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <DKpi icon={Building2} iconColor="#2563EB" iconBg="rgba(37,99,235,0.10)"
          value={String(d.biens.length)} label="Biens gérés" sub="En gestion agence" trend="neutral" />
        <DKpi icon={FileText}  iconColor="var(--althy-green)" iconBg="var(--althy-green-bg)"
          value={String(d.biens.filter(b => b.loyer_statut === "recu").length)} label="Loyers reçus" sub="Ce mois" trend="neutral" />
        <DKpi icon={FileText}  iconColor="#D97706" iconBg="rgba(217,119,6,0.10)"
          value={String(d.documents.length)} label="Documents" sub="Disponibles" trend="neutral" />
      </div>

      {/* Section 1 — Mes biens */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle>Mes biens</DSectionTitle>
        {d.biens.length === 0 ? (
          <DEmptyState icon={Building2} title="Aucun bien enregistré" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {d.biens.map(b => {
              const st = LOYER_STATUT[b.loyer_statut] ?? LOYER_STATUT.en_attente;
              return (
                <DCard key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: DC.text, margin: "0 0 2px" }}>{b.adresse}</p>
                    <p style={{ fontSize: 11, color: DC.muted, margin: 0 }}>{b.type} · CHF {b.loyer.toLocaleString("fr-CH")}/mois</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, color: st.color, background: st.bg, flexShrink: 0 }}>
                    {st.emoji} Loyer {b.loyer_statut === "recu" ? "reçu" : b.loyer_statut === "retard" ? "en retard" : "en attente"}
                  </span>
                </DCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2 — Mes documents */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <DSectionTitle style={{ marginBottom: 0 }}>Mes documents</DSectionTitle>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setFilterBien(null)} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${DC.border}`, background: filterBien === null ? DC.orange : "transparent", color: filterBien === null ? "#fff" : DC.muted, fontSize: 11, cursor: "pointer" }}>
              Tous
            </button>
            {d.biens.map(b => (
              <button key={b.id} onClick={() => setFilterBien(filterBien === b.id ? null : b.id)}
                style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${DC.border}`, background: filterBien === b.id ? DC.orange : "transparent", color: filterBien === b.id ? "#fff" : DC.muted, fontSize: 11, cursor: "pointer", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {b.adresse.split(",")[0]}
              </button>
            ))}
          </div>
        </div>
        {docsFiltres.length === 0 ? (
          <DEmptyState icon={FileText} title="Aucun document" subtitle="Les documents apparaîtront ici." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {docsFiltres.map(doc => (
              <DCard key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.8rem 1.25rem" }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: DC.text, margin: 0 }}>{doc.label}</p>
                <a href={doc.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: DC.orange, textDecoration: "none" }}>
                  <Download size={13} /> PDF
                </a>
              </DCard>
            ))}
          </div>
        )}
      </div>

      {/* Section 3 — Messagerie agence */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle><MessageSquare size={14} style={{ marginRight: 6 }} />Contacter mon agence</DSectionTitle>
        <DCard>
          {d.messages.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1rem", maxHeight: 200, overflowY: "auto" }}>
              {d.messages.map(m => (
                <div key={m.id} style={{ display: "flex", justifyContent: m.sender === "agence" || m.sender === "ai" ? "flex-start" : "flex-end" }}>
                  <div style={{ maxWidth: "80%", padding: "8px 12px", borderRadius: 10, background: m.sender === "proprio" ? DC.orange : DC.border, color: m.sender === "proprio" ? "#fff" : DC.text, fontSize: 13 }}>
                    {m.sender === "ai" && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--althy-orange)", marginBottom: 2 }}>✨ Althy</div>}
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          )}
          {msgSent ? (
            <p style={{ fontSize: 13, color: "var(--althy-green)", fontWeight: 600 }}>✓ Message envoyé — l'agence vous répondra sous 24h.</p>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder="Votre message à l'agence…" style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: `1px solid ${DC.border}`, fontSize: 13, outline: "none", background: DC.bg, color: DC.text, fontFamily: "inherit" }} />
              <button onClick={sendMessage} disabled={!msgInput.trim()} style={{ padding: "9px 14px", borderRadius: 9, background: msgInput.trim() ? DC.orange : DC.border, color: "#fff", border: "none", cursor: msgInput.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center" }}>
                <Send size={14} />
              </button>
            </div>
          )}
        </DCard>
      </div>

      {/* Section 4 — Althy IA FAQ */}
      <div style={{ marginBottom: "2rem" }}>
        <DSectionTitle><Sparkles size={14} style={{ marginRight: 6 }} />Question à Althy IA</DSectionTitle>
        <DCard>
          <p style={{ fontSize: 12.5, color: DC.muted, margin: "0 0 12px" }}>Posez une question sur vos biens, loyers ou contrats.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: iaReply ? 10 : 0 }}>
            <input value={iaInput} onChange={e => setIaInput(e.target.value)} onKeyDown={e => e.key === "Enter" && askIA()} placeholder="Ex : Quand est le prochain loyer ?" style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: `1px solid ${DC.border}`, fontSize: 13, outline: "none", background: DC.bg, color: DC.text, fontFamily: "inherit" }} />
            <button onClick={askIA} disabled={!iaInput.trim() || iaLoading} style={{ padding: "9px 14px", borderRadius: 9, background: iaInput.trim() && !iaLoading ? DC.orange : DC.border, color: "#fff", border: "none", cursor: iaInput.trim() && !iaLoading ? "pointer" : "not-allowed", display: "flex", alignItems: "center" }}>
              {iaLoading ? <span style={{ fontSize: 11 }}>…</span> : <Sparkles size={14} />}
            </button>
          </div>
          {iaReply && (
            <div style={{ padding: "10px 14px", borderRadius: 9, background: "var(--althy-orange-bg, rgba(232,96,44,0.08))", border: "1px solid rgba(232,96,44,0.15)", fontSize: 13, color: DC.text, lineHeight: 1.6 }}>
              {iaReply}
            </div>
          )}
        </DCard>
      </div>
    </div>
  );
}
