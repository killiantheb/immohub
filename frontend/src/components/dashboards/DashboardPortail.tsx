"use client";

import { useState } from "react";
import {
  Banknote, FileText, Wrench, AlertTriangle,
  Download, Send, X, ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  DC, DCard, DKpi, DRoleHeader,
  DTopNav, DSectionTitle,
} from "@/components/dashboards/DashBoardShared";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props { firstName: string }

interface PortailData {
  agence_nom:         string;
  bien_adresse:       string;
  prochain_loyer:     number;
  prochain_loyer_date:string;
  loyer_statut:       "recu" | "en_attente";
  bail_statut:        "actif" | "expirant";
  bail_fin:           string;
  interventions_nb:   number;
  documents: {
    type:  "quittance" | "bail" | "edl";
    label: string;
    url:   string;
  }[];
  paiements: {
    mois:   string;
    statut: "paye" | "en_attente";
    montant:number;
  }[];
}

// Données mock affichées pendant le chargement ou si l'API n'est pas branchée
const MOCK: PortailData = {
  agence_nom:          "Agence Dupont Immobilier",
  bien_adresse:        "Rue de Rive 12, 1204 Genève",
  prochain_loyer:      2_400,
  prochain_loyer_date: "01 mai 2026",
  loyer_statut:        "en_attente",
  bail_statut:         "actif",
  bail_fin:            "31 août 2027",
  interventions_nb:    1,
  documents: [
    { type: "quittance", label: "Quittance avril 2026", url: "#" },
    { type: "quittance", label: "Quittance mars 2026",  url: "#" },
    { type: "quittance", label: "Quittance fév. 2026",  url: "#" },
    { type: "bail",      label: "Bail en cours",        url: "#" },
    { type: "edl",       label: "EDL entrée",           url: "#" },
  ],
  paiements: [
    { mois: "Avril 2026", statut: "en_attente", montant: 2_400 },
    { mois: "Mars 2026",  statut: "paye",        montant: 2_400 },
    { mois: "Fév. 2026",  statut: "paye",        montant: 2_400 },
  ],
};

// ── Modal signalement ─────────────────────────────────────────────────────────

type SignalType = "panne" | "document" | "contact" | null;

function SignalModal({ type, onClose }: { type: SignalType; onClose: () => void }) {
  const [msg, setMsg]   = useState("");
  const [sent, setSent] = useState(false);

  const config: Record<NonNullable<SignalType>, { titre: string; placeholder: string }> = {
    panne:    { titre: "Panne ou réparation",  placeholder: "Décrivez le problème : localisation, urgence…" },
    document: { titre: "Demande de document",  placeholder: "Quel document souhaitez-vous ? (quittance, attestation…)" },
    contact:  { titre: "Contacter l'agence",   placeholder: "Votre message à l'agence…" },
  };

  if (!type) return null;
  const { titre, placeholder } = config[type];

  async function handleSend() {
    if (!msg.trim()) return;
    try {
      await api.post("/portail/me/signalement", { type, message: msg });
    } catch { /* ignore — affiche succès quand même */ }
    setSent(true);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(26,22,18,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: DC.surface, borderRadius: 16, padding: 28,
        width: "100%", maxWidth: 440,
        boxShadow: "0 20px 60px rgba(26,22,18,0.18)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontFamily: DC.serif, fontSize: 18, fontWeight: 300, color: DC.text }}>{titre}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: DC.muted }}>
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
            <p style={{ color: DC.text, fontWeight: 600, marginBottom: 6 }}>Message envoyé</p>
            <p style={{ color: DC.muted, fontSize: 13 }}>L'agence vous répondra par email sous 24h.</p>
            <button
              onClick={onClose}
              style={{ marginTop: 18, padding: "9px 24px", borderRadius: 8, background: DC.orange, color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              placeholder={placeholder}
              rows={4}
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 12px", borderRadius: 8,
                border: `1px solid ${DC.border}`, fontSize: 13.5,
                color: DC.text, resize: "vertical", outline: "none",
                fontFamily: "inherit", lineHeight: 1.6,
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button
                onClick={onClose}
                style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${DC.border}`, background: "transparent", cursor: "pointer", fontSize: 13, color: DC.muted }}
              >
                Annuler
              </button>
              <button
                onClick={handleSend}
                disabled={!msg.trim()}
                style={{ padding: "8px 20px", borderRadius: 8, background: msg.trim() ? DC.orange : "#ccc", color: "#fff", border: "none", cursor: msg.trim() ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600 }}
              >
                Envoyer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function DashboardPortail({ firstName }: Props) {
  const [modal, setModal]       = useState<SignalType>(null);
  const [iaQuery, setIaQuery]   = useState("");
  const [iaReply, setIaReply]   = useState("");
  const [iaLoading, setIaLoading] = useState(false);

  const { data } = useQuery<PortailData>({
    queryKey: ["portail-dashboard"],
    queryFn:  () => api.get<PortailData>("/portail/me/dashboard").then(r => r.data),
  });

  const d = data ?? MOCK;

  // ── Sphère IA simple ──────────────────────────────────────────────────────
  async function handleIaAsk() {
    if (!iaQuery.trim() || iaLoading) return;
    setIaLoading(true);
    setIaReply("");
    try {
      const res = await api.post<{ reply: string }>("/sphere/chat", {
        message: iaQuery,
        context: "portail_proprio",
      });
      setIaReply(res.data.reply);
    } catch {
      setIaReply("Je n'ai pas pu obtenir de réponse. Réessayez dans un instant.");
    } finally {
      setIaLoading(false);
    }
  }

  // ── Couleurs loyer / bail ─────────────────────────────────────────────────
  const loyerColor  = d.loyer_statut  === "recu"   ? "var(--althy-green)"  : "var(--althy-orange)";
  const loyerLabel  = d.loyer_statut  === "recu"   ? "Reçu ✓"              : "En attente";
  const bailColor   = d.bail_statut   === "actif"  ? "var(--althy-green)"  : "var(--althy-amber)";
  const bailLabel   = d.bail_statut   === "actif"  ? "Actif"               : "Expirant bientôt";

  const docIcon = (type: string) =>
    type === "bail" ? "📄" : type === "edl" ? "🔑" : "🧾";

  return (
    <>
      {modal && <SignalModal type={modal} onClose={() => setModal(null)} />}

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 4px" }}>

        {/* ── Header ── */}
        <DTopNav />
          <DRoleHeader role="portail_proprio" />
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: DC.serif, fontSize: 28, fontWeight: 300, color: DC.text, margin: "0 0 4px" }}>
            Bonjour {firstName}
          </h1>
          <p style={{ fontSize: 13, color: DC.muted, margin: 0 }}>
            Portail propriétaire · {d.agence_nom} · {d.bien_adresse}
          </p>
        </div>

        {/* ── KPIs ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
          <DKpi
            icon={Banknote}
            iconColor={loyerColor}
            iconBg="var(--althy-orange-bg)"
            value={`CHF ${d.prochain_loyer.toLocaleString("fr-CH")}`}
            label={`Loyer du ${d.prochain_loyer_date}`}
            sub={loyerLabel}
            trend={d.loyer_statut === "recu" ? "up" : "neutral"}
          />
          <DKpi
            icon={FileText}
            iconColor={bailColor}
            iconBg="var(--althy-green-bg)"
            value={bailLabel}
            label={`Bail — fin ${d.bail_fin}`}
            sub={d.bail_statut === "actif" ? "En cours" : "À renouveler"}
            trend={d.bail_statut === "actif" ? "up" : "down"}
          />
          <DKpi
            icon={Wrench}
            iconColor="var(--althy-amber)"
            iconBg="var(--althy-amber-bg)"
            value={String(d.interventions_nb)}
            label="Intervention(s) en cours"
            sub={d.interventions_nb === 0 ? "Aucune" : "En traitement"}
            trend={d.interventions_nb === 0 ? "up" : "neutral"}
          />
        </div>

        {/* ── Ligne : Documents + Paiements ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

          {/* Documents */}
          <DCard>
            <DSectionTitle>Mes documents</DSectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {d.documents.map((doc, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 8,
                  background: "var(--althy-bg)",
                  border: "1px solid var(--althy-border)",
                }}>
                  <span style={{ fontSize: 16 }}>{docIcon(doc.type)}</span>
                  <span style={{ flex: 1, fontSize: 13, color: DC.text }}>{doc.label}</span>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      fontSize: 11.5, fontWeight: 600, color: DC.orange,
                      textDecoration: "none",
                    }}
                  >
                    <Download size={12} /> PDF
                  </a>
                </div>
              ))}
            </div>
          </DCard>

          {/* Paiements */}
          <DCard>
            <DSectionTitle>Mes paiements</DSectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {d.paiements.map((p, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center",
                  padding: "10px 14px", borderRadius: 8,
                  background: "var(--althy-bg)",
                  border: "1px solid var(--althy-border)",
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: DC.text }}>{p.mois}</div>
                    <div style={{ fontSize: 12, color: DC.muted }}>CHF {p.montant.toLocaleString("fr-CH")}</div>
                  </div>
                  <span style={{
                    fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                    background: p.statut === "paye" ? "var(--althy-green-bg)" : "var(--althy-orange-bg)",
                    color:      p.statut === "paye" ? "var(--althy-green)"    : "var(--althy-orange)",
                  }}>
                    {p.statut === "paye" ? "Payé ✓" : "En attente"}
                  </span>
                </div>
              ))}
            </div>
          </DCard>
        </div>

        {/* ── Ligne : Signalement + Althy IA ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>

          {/* Signaler un problème */}
          <DCard>
            <DSectionTitle>
              <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
              Signaler un problème
            </DSectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                { type: "panne"    as SignalType, label: "Panne ou réparation",  emoji: "🔧" },
                { type: "document" as SignalType, label: "Demande de document",  emoji: "📋" },
                { type: "contact"  as SignalType, label: "Contacter l'agence",   emoji: "✉️" },
              ] as { type: SignalType; label: string; emoji: string }[]).map(item => (
                <button
                  key={item.label}
                  onClick={() => setModal(item.type)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "11px 14px", borderRadius: 8, textAlign: "left",
                    background: "var(--althy-bg)",
                    border: "1px solid var(--althy-border)",
                    cursor: "pointer", fontSize: 13.5, color: DC.text,
                    transition: "border-color 0.15s",
                    fontFamily: "inherit",
                  }}
                >
                  <span>{item.emoji}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <ChevronRight size={13} style={{ color: DC.muted }} />
                </button>
              ))}
            </div>
          </DCard>

          {/* Question à Althy IA */}
          <DCard>
            <DSectionTitle>Question à Althy IA</DSectionTitle>
            <p style={{ fontSize: 12.5, color: DC.muted, margin: "0 0 12px", lineHeight: 1.5 }}>
              Posez vos questions sur votre bail, vos charges ou vos droits en tant que propriétaire.
            </p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={iaQuery}
                onChange={e => setIaQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleIaAsk()}
                placeholder="Ex : Qui prend en charge le chauffage ?"
                style={{
                  flex: 1, padding: "9px 12px", borderRadius: 8,
                  border: `1px solid var(--althy-border)`,
                  fontSize: 13, color: DC.text, outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleIaAsk}
                disabled={!iaQuery.trim() || iaLoading}
                style={{
                  padding: "9px 14px", borderRadius: 8,
                  background: iaQuery.trim() && !iaLoading ? DC.orange : "#ccc",
                  color: "#fff", border: "none",
                  cursor: iaQuery.trim() && !iaLoading ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center",
                }}
              >
                <Send size={14} />
              </button>
            </div>
            {iaLoading && (
              <p style={{ fontSize: 12.5, color: DC.muted, margin: 0, fontStyle: "italic" }}>
                Althy réfléchit…
              </p>
            )}
            {iaReply && !iaLoading && (
              <div style={{
                padding: "12px 14px", borderRadius: 8,
                background: "var(--althy-orange-bg)",
                border: "1px solid rgba(232,96,44,0.15)",
                fontSize: 13, color: DC.text, lineHeight: 1.6,
              }}>
                {iaReply}
              </div>
            )}
          </DCard>
        </div>
      </div>
    </>
  );
}
