// src/components/dashboards/DashboardPortail.tsx
// Vue LECTURE SEULE — portail_proprio — style Figma V2
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, CheckCircle2, Download, FileText, Send, Sparkles,
  MessageSquare, AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { DSectionTitle, DEmptyState } from "./DashBoardShared";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Bien     { id: string; adresse: string; type: string; loyer: number; loyer_statut: "recu" | "en_attente" | "retard" }
interface Doc      { id: string; label: string; type: string; url: string; bien_id?: string }
interface MsgItem  { id: string; sender: "proprio" | "agence" | "ai"; content: string; created_at: string }
interface PortailData { agence_nom: string; first_name: string; biens: Bien[]; documents: Doc[]; messages: MsgItem[] }

// ── Mock ──────────────────────────────────────────────────────────────────────

const MOCK: PortailData = {
  agence_nom: "Agence Dupont Immobilier",
  first_name: "",
  biens: [
    { id: "1", adresse: "Rue de Rive 12, 1204 Genève",     type: "Appartement", loyer: 2400, loyer_statut: "recu" },
    { id: "2", adresse: "Av. de la Gare 8, 1003 Lausanne", type: "Studio",      loyer: 1200, loyer_statut: "en_attente" },
  ],
  documents: [
    { id: "1", label: "Quittance avril 2026", type: "quittance", url: "#", bien_id: "1" },
    { id: "2", label: "Contrat de bail",      type: "bail",      url: "#", bien_id: "1" },
    { id: "3", label: "Quittance mars 2026",  type: "quittance", url: "#", bien_id: "2" },
  ],
  messages: [],
};

// ── KPI card (même style que UnifiedDashboard HKpiCard) ───────────────────────

const CARD_SHADOW     = "0 1px 3px rgba(43,43,43,0.04), 0 4px 16px rgba(43,43,43,0.03)";
const CARD_SHADOW_HOV = "0 8px 32px rgba(43,43,43,0.10), 0 2px 8px rgba(43,43,43,0.05)";

function KpiCard({ icon: Icon, iconColor, iconBg, value, label, sub }: {
  icon: LucideIcon; iconColor: string; iconBg: string;
  value: string; label: string; sub?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "#FFFFFF",
        borderRadius: 24,
        border: "1px solid var(--border-subtle)",
        boxShadow: hov ? CARD_SHADOW_HOV : CARD_SHADOW,
        padding: 24, position: "relative",
        transform: hov ? "translateY(-2px)" : "translateY(0)",
        transition: "box-shadow 0.2s, transform 0.2s",
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 16, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Icon size={22} color={iconColor} strokeWidth={1.6} />
      </div>
      <div style={{ fontSize: 36, fontWeight: 600, color: "var(--charcoal)", lineHeight: 1, marginBottom: 6, fontFamily: "var(--font-display)" }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── DashboardPortail ──────────────────────────────────────────────────────────

interface Props { firstName?: string }

export function DashboardPortail({ firstName = "" }: Props) {
  const [filterBien, setFilterBien] = useState<string | null>(null);
  const [msgInput,   setMsgInput]   = useState("");
  const [msgSent,    setMsgSent]    = useState(false);
  const [iaInput,    setIaInput]    = useState("");
  const [iaReply,    setIaReply]    = useState("");
  const [iaLoading,  setIaLoading]  = useState(false);

  const { data } = useQuery<PortailData>({
    queryKey: ["portail-me"],
    queryFn: () => api.get<PortailData>("/portail/me/dashboard").then(r => r.data),
  });
  const d    = data ?? MOCK;
  const name = firstName || d.first_name || "";
  const docsFiltres = filterBien ? d.documents.filter(doc => doc.bien_id === filterBien) : d.documents;

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

  const nbRecus = d.biens.filter(b => b.loyer_statut === "recu").length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>

      {/* ── Top bar ── */}
      <div style={{ height: 80, background: "#FFFFFF", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--cream)", borderRadius: 16, padding: "12px 20px", border: "1px solid var(--border-subtle)", width: 280 }}>
          <span style={{ fontSize: 14, color: "var(--text-tertiary)" }}>Portail propriétaire</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
          Géré par <span style={{ color: "var(--terracotta-primary)" }}>{d.agence_nom}</span>
        </div>
      </div>

      <div style={{ padding: "2rem 3rem", maxWidth: 960 }}>

        {/* Greeting */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: 48, fontWeight: 600, fontFamily: "var(--font-display)", color: "var(--charcoal)", marginBottom: 6, lineHeight: 1.1 }}>
            Bonjour{name ? `, ${name}` : ""}
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>
            Vos {d.biens.length} bien{d.biens.length !== 1 ? "s" : ""} en gestion
          </p>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          <KpiCard icon={Building2}     iconColor="var(--terracotta-primary)" iconBg="var(--terracotta-ghost)"
            value={String(d.biens.length)} label="Biens gérés" sub="En gestion agence" />
          <KpiCard icon={CheckCircle2}  iconColor="var(--sage)"  iconBg="var(--success-bg)"
            value={String(nbRecus)} label="Loyers reçus" sub="Ce mois" />
          <KpiCard icon={FileText}      iconColor="var(--sky)"   iconBg="var(--info-bg)"
            value={String(d.documents.length)} label="Documents" sub="Disponibles" />
        </div>

        {/* Section 1 — Mes biens */}
        <div style={{ marginBottom: "2rem" }}>
          <DSectionTitle>Mes biens</DSectionTitle>
          {d.biens.length === 0 ? (
            <DEmptyState icon={Building2} title="Aucun bien enregistré" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {d.biens.map(b => {
                const isRecu   = b.loyer_statut === "recu";
                const isRetard = b.loyer_statut === "retard";
                return (
                  <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "#FFFFFF", borderRadius: 16, border: "1px solid var(--border-subtle)", boxShadow: CARD_SHADOW }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: isRecu ? "var(--success-bg)" : isRetard ? "var(--urgent-bg)" : "var(--warning-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isRecu
                        ? <CheckCircle2 size={18} color="var(--sage)" strokeWidth={1.8} />
                        : <AlertTriangle size={18} color={isRetard ? "#DC3545" : "#D97706"} strokeWidth={1.8} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 2px" }}>{b.adresse}</p>
                      <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>{b.type} · CHF {b.loyer.toLocaleString("fr-CH")}/mois</p>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 99, flexShrink: 0,
                      background: isRecu ? "var(--success-bg)" : isRetard ? "var(--urgent-bg)" : "var(--warning-bg)",
                      color: isRecu ? "var(--sage)" : isRetard ? "#DC3545" : "#D97706",
                    }}>
                      {isRecu ? "Reçu ✓" : isRetard ? "En retard" : "En attente"}
                    </span>
                  </div>
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
              <button onClick={() => setFilterBien(null)} style={{ padding: "5px 12px", borderRadius: 99, border: "1px solid var(--border-subtle)", background: filterBien === null ? "var(--terracotta-primary)" : "transparent", color: filterBien === null ? "#fff" : "var(--text-tertiary)", fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}>
                Tous
              </button>
              {d.biens.map(b => (
                <button key={b.id} onClick={() => setFilterBien(filterBien === b.id ? null : b.id)}
                  style={{ padding: "5px 12px", borderRadius: 99, border: "1px solid var(--border-subtle)", background: filterBien === b.id ? "var(--terracotta-primary)" : "transparent", color: filterBien === b.id ? "#fff" : "var(--text-tertiary)", fontSize: 11, fontWeight: 500, cursor: "pointer", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                  {b.adresse.split(",")[0]}
                </button>
              ))}
            </div>
          </div>
          {docsFiltres.length === 0 ? (
            <DEmptyState icon={FileText} title="Aucun document" subtitle="Les documents apparaîtront ici." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {docsFiltres.map(doc => (
                <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "var(--cream)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--urgent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FileText size={16} color="#DC3545" strokeWidth={1.8} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", flex: 1, margin: 0 }}>{doc.label}</p>
                  <a href={doc.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 99, border: "1px solid var(--border-subtle)", fontSize: 12, fontWeight: 500, color: "var(--terracotta-primary)", textDecoration: "none", background: "#fff", flexShrink: 0 }}>
                    <Download size={12} /> PDF
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3 — Messagerie agence */}
        <div style={{ marginBottom: "2rem" }}>
          <DSectionTitle><MessageSquare size={14} style={{ marginRight: 6, display: "inline" }} />Contacter mon agence</DSectionTitle>
          <div style={{ background: "#FFFFFF", borderRadius: 20, border: "1px solid var(--border-subtle)", padding: 24, boxShadow: CARD_SHADOW }}>
            {d.messages.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "1rem", maxHeight: 200, overflowY: "auto" }}>
                {d.messages.map(m => (
                  <div key={m.id} style={{ display: "flex", justifyContent: m.sender === "agence" || m.sender === "ai" ? "flex-start" : "flex-end" }}>
                    <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: 12, background: m.sender === "proprio" ? "var(--terracotta-primary)" : "var(--cream)", color: m.sender === "proprio" ? "#fff" : "var(--text-primary)", fontSize: 13, border: m.sender !== "proprio" ? "1px solid var(--border-subtle)" : "none" }}>
                      {m.sender === "ai" && <div style={{ fontSize: 10, fontWeight: 600, color: "var(--terracotta-primary)", marginBottom: 2 }}>✨ Althy</div>}
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {msgSent ? (
              <p style={{ fontSize: 13, color: "var(--sage)", fontWeight: 600 }}>✓ Message envoyé — l'agence vous répondra sous 24h.</p>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={msgInput} onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  placeholder="Votre message à l'agence…"
                  style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border-subtle)", fontSize: 13, outline: "none", background: "var(--cream)", color: "var(--text-primary)", fontFamily: "inherit" }}
                />
                <button onClick={sendMessage} disabled={!msgInput.trim()}
                  style={{ padding: "12px 16px", borderRadius: 12, background: msgInput.trim() ? "var(--terracotta-primary)" : "var(--gray-light)", color: "#fff", border: "none", cursor: msgInput.trim() ? "pointer" : "not-allowed", display: "flex", alignItems: "center", transition: "background 0.15s" }}>
                  <Send size={15} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Section 4 — Althy IA FAQ */}
        <div style={{ marginBottom: "2rem" }}>
          <DSectionTitle><Sparkles size={14} style={{ marginRight: 6, display: "inline" }} />Question à Althy IA</DSectionTitle>
          <div style={{ background: "#FFFFFF", borderRadius: 20, border: "1px solid var(--border-subtle)", padding: 24, boxShadow: CARD_SHADOW }}>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "0 0 14px" }}>Posez une question sur vos biens, loyers ou contrats.</p>
            <div style={{ display: "flex", gap: 8, marginBottom: iaReply ? 12 : 0 }}>
              <input
                value={iaInput} onChange={e => setIaInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && askIA()}
                placeholder="Ex : Quand est le prochain loyer ?"
                style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border-subtle)", fontSize: 13, outline: "none", background: "var(--cream)", color: "var(--text-primary)", fontFamily: "inherit" }}
              />
              <button onClick={askIA} disabled={!iaInput.trim() || iaLoading}
                style={{ padding: "12px 16px", borderRadius: 12, background: iaInput.trim() && !iaLoading ? "var(--terracotta-primary)" : "var(--gray-light)", color: "#fff", border: "none", cursor: iaInput.trim() && !iaLoading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", transition: "background 0.15s" }}>
                {iaLoading ? <span style={{ fontSize: 12 }}>…</span> : <Sparkles size={15} />}
              </button>
            </div>
            {iaReply && (
              <div style={{ padding: "12px 16px", borderRadius: 12, background: "var(--terracotta-ghost)", border: "1px solid rgba(232,96,44,0.15)", fontSize: 13, color: "var(--text-primary)", lineHeight: 1.65 }}>
                {iaReply}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
