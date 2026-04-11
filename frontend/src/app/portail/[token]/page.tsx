"use client";

import { useState, useEffect, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

// Public axios instance (no auth headers)
const pub = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? "https://api.althy.ch/api/v1" });

const S = {
  bg:      "#FAFAF8",
  surface: "#FFFFFF",
  surface2:"#F5F3EF",
  border:  "#E8E4DC",
  text:    "#3D3830",
  text2:   "#5A5248",
  text3:   "#7A7469",
  orange:  "var(--althy-orange)",
  orangeBg:"#FAE4D6",
  green:   "#5A7D54",
  greenBg: "#EBF2EA",
  amber:   "#B87333",
  amberBg: "#FEF3E2",
  red:     "#C0392B",
  redBg:   "#FEE8E6",
} as const;

function fmt(n: number | null | undefined) {
  if (!n) return "—";
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n);
}

interface PortailData {
  invitation_id: string;
  token: string;
  proprio_name: string | null;
  proprio_email: string;
  status: string;
  bien: {
    id: string;
    adresse: string;
    ville: string;
    type_bien: string;
    loyer_mensuel: number | null;
  } | null;
  paiements: Array<{ montant: number | null; date: string; statut: string; mois: string | null }>;
  interventions: Array<{ titre: string; statut: string; date: string | null; cout: number | null }>;
  documents: Array<{ titre: string; type: string; date: string; url: string | null }>;
  messages: Array<{ id: string; sender_type: string; content: string; created_at: string }>;
}

type TabId = "accueil" | "loyers" | "travaux" | "documents" | "messages";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "accueil",   label: "Accueil",   icon: "🏠" },
  { id: "loyers",    label: "Loyers",    icon: "💶" },
  { id: "travaux",   label: "Travaux",   icon: "🔧" },
  { id: "documents", label: "Documents", icon: "📄" },
  { id: "messages",  label: "Canal",     icon: "💬" },
];

const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  paye:      { label: "Payé",      color: S.green,  bg: S.greenBg  },
  en_attente:{ label: "En attente",color: S.amber,  bg: S.amberBg  },
  en_retard: { label: "En retard", color: S.red,    bg: S.redBg    },
  termine:   { label: "Terminé",   color: S.text3,  bg: S.surface2 },
  planifie:  { label: "Planifié",  color: S.orange, bg: S.orangeBg },
  en_cours:  { label: "En cours",  color: S.amber,  bg: S.amberBg  },
};

export default function PortailProprioPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>("accueil");
  const [message, setMessage] = useState("");
  const [question, setQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [askingAI, setAskingAI] = useState(false);

  const { data, isLoading, isError } = useQuery<PortailData>({
    queryKey: ["portail-view", token],
    queryFn: () => pub.get<PortailData>(`/portail/view/${token}`).then(r => r.data),
    staleTime: 30_000,
  });

  const sendMsgMut = useMutation({
    mutationFn: (content: string) =>
      pub.post(`/portail/messages/${data!.invitation_id}/proprio`, { content }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["portail-view", token] }); setMessage(""); },
  });

  async function askAI() {
    if (!question.trim()) return;
    setAskingAI(true);
    try {
      const r = await pub.post<{ answer: string }>("/portail/ai-question", { question: question.trim(), invitation_token: token });
      setAiAnswer(r.data.answer);
      qc.invalidateQueries({ queryKey: ["portail-view", token] });
    } finally {
      setAskingAI(false);
      setQuestion("");
    }
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: S.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: S.text3 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏠</div>
          <p>Chargement de votre portail…</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: S.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 40, maxWidth: 400 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h2 style={{ color: S.text, marginBottom: 8 }}>Lien invalide ou expiré</h2>
          <p style={{ color: S.text3, fontSize: 14 }}>Contactez votre agence pour obtenir un nouveau lien d&apos;accès.</p>
        </div>
      </div>
    );
  }

  const { bien, paiements, interventions, documents, messages } = data;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: S.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: '#fff', borderBottom: '1px solid #EAE3D9' }}>
        <a href="/" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300, letterSpacing: '4px', color: '#1A1612', textDecoration: 'none' }}>
          ALTHY
        </a>
        <a href="/login" style={{ fontSize: '13px', color: '#8A7A6A', textDecoration: 'none', padding: '7px 16px', border: '1px solid #EAE3D9', borderRadius: '8px' }}>
          Se connecter
        </a>
      </header>

      {/* Tabs */}
      <div style={{ backgroundColor: S.surface, borderBottom: `1px solid ${S.border}`, display: "flex", overflowX: "auto", padding: "0 4px" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "12px 16px", background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? S.orange : "transparent"}`, color: tab === t.id ? S.orange : S.text3, fontWeight: tab === t.id ? 700 : 500, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>

        {/* Accueil */}
        {tab === "accueil" && (
          <div>
            {bien ? (
              <>
                <div style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: "20px 24px", marginBottom: 20 }}>
                  <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: S.text }}>{bien.adresse}</h2>
                  <p style={{ margin: "0 0 16px", fontSize: 13, color: S.text3 }}>{bien.ville} · {bien.type_bien}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div style={{ padding: "12px 14px", backgroundColor: S.greenBg, borderRadius: 12 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: S.green }}>{fmt(bien.loyer_mensuel)}</div>
                      <div style={{ fontSize: 11, color: S.text3, marginTop: 2 }}>Loyer mensuel</div>
                    </div>
                    <div style={{ padding: "12px 14px", backgroundColor: S.surface2, borderRadius: 12 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: S.text }}>{paiements.filter(p => p.statut === "paye").length}</div>
                      <div style={{ fontSize: 11, color: S.text3, marginTop: 2 }}>Paiements reçus</div>
                    </div>
                    <div style={{ padding: "12px 14px", backgroundColor: S.surface2, borderRadius: 12 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: S.amber }}>{interventions.filter(i => i.statut !== "termine").length}</div>
                      <div style={{ fontSize: 11, color: S.text3, marginTop: 2 }}>Travaux actifs</div>
                    </div>
                  </div>
                </div>

                {/* Recent messages preview */}
                {messages.length > 0 && (
                  <div style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: S.text, marginBottom: 10 }}>💬 Dernier message de votre agence</div>
                    {messages.filter(m => m.sender_type === "agency").slice(-1).map(m => (
                      <div key={m.id} style={{ fontSize: 13, color: S.text2, backgroundColor: S.surface2, padding: "10px 14px", borderRadius: 10 }}>{m.content}</div>
                    ))}
                    <button onClick={() => setTab("messages")} style={{ marginTop: 8, fontSize: 12, color: S.orange, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Voir le canal complet →</button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px", color: S.text3 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🏠</div>
                <p>Aucun bien associé à ce portail</p>
              </div>
            )}

            {/* AI Q&A */}
            <div style={{ backgroundColor: S.orangeBg, border: `1px solid ${S.orange}`, borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.text, marginBottom: 4 }}>✨ Posez une question à Althy</div>
              <p style={{ margin: "0 0 12px", fontSize: 12.5, color: S.text3 }}>Questions simples sur votre bien, loyers ou documents. Non contractuel.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askAI(); } }}
                  placeholder="Ex: Quand est prévu le prochain paiement ?"
                  style={{ flex: 1, padding: "9px 12px", border: `1px solid ${S.border}`, borderRadius: 9, fontSize: 13, outline: "none", backgroundColor: S.surface, color: S.text }}
                />
                <button onClick={askAI} disabled={askingAI || !question.trim()}
                  style={{ padding: "9px 14px", backgroundColor: S.orange, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {askingAI ? "…" : "Demander"}
                </button>
              </div>
              {aiAnswer && (
                <div style={{ marginTop: 12, padding: "12px 14px", backgroundColor: S.surface, borderRadius: 10, fontSize: 13, color: S.text2, lineHeight: 1.6 }}>
                  <strong style={{ color: S.orange }}>Althy :</strong> {aiAnswer}
                  <div style={{ marginTop: 6, fontSize: 11, color: S.text3 }}>Réponse IA — non contractuelle.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loyers */}
        {tab === "loyers" && (
          <div style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${S.border}` }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: S.text }}>Historique des loyers</h3>
            </div>
            {paiements.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: S.text3, fontSize: 13 }}>Aucun paiement enregistré</div>
            ) : (
              paiements.map((p, i) => {
                const sc = STATUT_CFG[p.statut] ?? STATUT_CFG.en_attente;
                return (
                  <div key={i} style={{ padding: "14px 20px", borderBottom: `1px solid ${S.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: S.text }}>{p.mois ?? p.date}</div>
                      <div style={{ fontSize: 12, color: S.text3 }}>{new Date(p.date).toLocaleDateString("fr-CH")}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: S.text }}>{fmt(p.montant)}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Travaux */}
        {tab === "travaux" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {interventions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 20px", backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, color: S.text3, fontSize: 13 }}>
                Aucune intervention enregistrée
              </div>
            ) : interventions.map((intv, i) => {
              const sc = STATUT_CFG[intv.statut] ?? STATUT_CFG.planifie;
              return (
                <div key={i} style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 4 }}>{intv.titre}</div>
                    {intv.date && <div style={{ fontSize: 12, color: S.text3 }}>{new Date(intv.date).toLocaleDateString("fr-CH")}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {intv.cout && <div style={{ fontSize: 14, fontWeight: 700, color: S.text, marginBottom: 4 }}>{fmt(intv.cout)}</div>}
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Documents */}
        {tab === "documents" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {documents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 20px", backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, color: S.text3, fontSize: 13 }}>
                Aucun document disponible
              </div>
            ) : documents.map((doc, i) => (
              <div key={i} style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: S.text }}>{doc.titre}</div>
                  <div style={{ fontSize: 12, color: S.text3 }}>{doc.type} · {new Date(doc.date).toLocaleDateString("fr-CH")}</div>
                </div>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", backgroundColor: S.orangeBg, color: S.orange, border: `1px solid ${S.orange}`, borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                    Télécharger
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: S.text3 }}>Non disponible</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        {tab === "messages" && (
          <div style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${S.border}` }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: S.text }}>Canal avec votre agence</h3>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: S.text3 }}>Messages directs + réponses IA Althy</p>
            </div>
            <div style={{ padding: 16, minHeight: 300, maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0", color: S.text3, fontSize: 13 }}>
                  Aucun message pour l&apos;instant. Posez une question ci-dessous.
                </div>
              )}
              {messages.map(m => (
                <div key={m.id} style={{ display: "flex", justifyContent: m.sender_type === "proprio" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "75%", padding: "9px 13px",
                    borderRadius: m.sender_type === "proprio" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                    backgroundColor: m.sender_type === "proprio" ? S.orange : m.sender_type === "ai" ? S.amberBg : S.surface2,
                    color: m.sender_type === "proprio" ? "#fff" : S.text,
                    fontSize: 13, lineHeight: 1.5,
                  }}>
                    {m.sender_type === "ai" && <div style={{ fontSize: 10, fontWeight: 700, color: S.amber, marginBottom: 3 }}>✨ Althy IA</div>}
                    {m.sender_type === "agency" && <div style={{ fontSize: 10, fontWeight: 700, color: S.text3, marginBottom: 3 }}>Votre agence</div>}
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${S.border}`, display: "flex", gap: 8 }}>
              <input
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && message.trim()) { e.preventDefault(); sendMsgMut.mutate(message.trim()); } }}
                placeholder="Votre message…"
                style={{ flex: 1, padding: "9px 12px", border: `1px solid ${S.border}`, borderRadius: 9, fontSize: 13, outline: "none", backgroundColor: S.surface2, color: S.text }}
              />
              <button
                onClick={() => message.trim() && sendMsgMut.mutate(message.trim())}
                disabled={sendMsgMut.isPending || !message.trim()}
                style={{ padding: "9px 14px", backgroundColor: S.orange, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer" }}
              >
                ➤
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "20px", textAlign: "center", fontSize: 12, color: S.text3, borderTop: `1px solid ${S.border}`, marginTop: 40 }}>
        Portail propriétaire Althy · Accès sécurisé · Données chiffrées
      </div>
    </div>
  );
}
