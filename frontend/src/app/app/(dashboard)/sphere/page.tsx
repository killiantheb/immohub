"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, LayoutGrid, RefreshCw, Send, Star, X } from "lucide-react";
import { AlthySphereCore } from "@/components/sphere/AlthySphereCore";
import { SphereInput } from "@/components/sphere/SphereInput";
import { SphereStream } from "@/components/sphere/SphereStream";
import { NotationModal } from "@/components/sphere/NotationModal";
import { useSphereStore, type SphereAction, type Urgence } from "@/lib/store/sphereStore";
import { useUser } from "@/lib/auth";
import { useRole, ROLE_LABELS } from "@/lib/hooks/useRole";
import { useAuthStore } from "@/lib/store/authStore";
import { api, baseURL } from "@/lib/api";
import { createClient } from "@/lib/supabase";

// ── Urgence helpers ──────────────────────────────────────────────────────────

const URGENCE_COLOR: Record<Urgence, string> = {
  haute:   "#DC3545",
  normale: "var(--althy-orange)",
  info:    "#3B82F6",
};
const URGENCE_BG: Record<Urgence, string> = {
  haute:   "rgba(220,53,69,0.08)",
  normale: "var(--althy-orange-bg, rgba(232,96,44,0.08))",
  info:    "rgba(59,130,246,0.08)",
};
const URGENCE_LABEL: Record<Urgence, string> = {
  haute:   "Urgent",
  normale: "À faire",
  info:    "Info",
};

// ── Role-aware greeting ──────────────────────────────────────────────────────

function getGreeting(role: string, firstName: string): { title: string; subtitle: string } {
  const name = firstName ? `, ${firstName}` : "";
  switch (role) {
    case "proprio_solo":
    case "agence":
    case "portail_proprio":
      return { title: `Bonjour${name}`, subtitle: "Voici votre briefing du jour." };
    case "opener":
      return { title: `Bonjour${name}`, subtitle: "Vos missions du jour." };
    case "artisan":
      return { title: `Bonjour${name}`, subtitle: "Vos devis et chantiers en attente." };
    case "expert":
      return { title: `Bonjour${name}`, subtitle: "Vos expertises et mandats." };
    case "hunter":
      return { title: `Bonjour${name}`, subtitle: "Vos leads et opportunités." };
    case "locataire":
      return { title: `Bonjour${name}`, subtitle: "Vos documents et demandes." };
    case "acheteur_premium":
      return { title: `Bonjour${name}`, subtitle: "Vos alertes et avant-premières." };
    default:
      return { title: `Bonjour${name}`, subtitle: "Que puis-je faire pour vous ?" };
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────

function UrgenceBadge({ urgence }: { urgence: Urgence }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 6, background: URGENCE_BG[urgence], color: URGENCE_COLOR[urgence], fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
      {URGENCE_LABEL[urgence]}
    </span>
  );
}


interface ModifiableTextProps {
  text: string;
  actionId: string;
  onRegenerate: (id: string) => void;
  onModified: (text: string) => void;
}
function ModifiableText({ text, actionId, onRegenerate, onModified }: ModifiableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [regen, setRegen] = useState(false);

  async function handleRegenerate() {
    setRegen(true);
    try { await onRegenerate(actionId); } catch { /* */ }
    setRegen(false);
  }

  return (
    <div style={{ marginTop: 10 }}>
      {editing ? (
        <textarea value={draft} onChange={e => { setDraft(e.target.value); onModified(e.target.value); }} rows={4}
          style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--althy-orange)", borderRadius: 8, fontSize: 12, background: "var(--althy-bg)", color: "var(--althy-text)", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
      ) : (
        <p style={{ fontSize: 13, color: "var(--althy-text)", lineHeight: 1.55, background: "var(--althy-bg)", padding: "10px 12px", borderRadius: 8, margin: 0, fontStyle: "italic" }}>{draft}</p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={() => setEditing(v => !v)} style={{ fontSize: 11, color: "var(--althy-orange)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
          {editing ? "Fermer" : "Modifier avant de valider"}
        </button>
        <button onClick={handleRegenerate} disabled={regen} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--althy-text-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <RefreshCw size={11} style={{ animation: regen ? "spin 1s linear infinite" : "none" }} /> Régénérer
        </button>
      </div>
    </div>
  );
}

// ── Fullscreen Modal ─────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(26,22,18,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--althy-surface)", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(26,22,18,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--althy-border)" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--althy-text)" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--althy-text-3)", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>{children}</div>
      </div>
    </div>
  );
}

// ── Right Panel ──────────────────────────────────────────────────────────────

function RightPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(26,22,18,0.4)" }} onClick={onClose} />
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 400, background: "var(--althy-surface)", boxShadow: "-8px 0 40px rgba(26,22,18,0.15)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--althy-border)" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--althy-text)" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--althy-text-3)", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>{children}</div>
      </div>
    </div>
  );
}

// ── Action Card ──────────────────────────────────────────────────────────────

interface ActionCardProps {
  action: SphereAction;
  onDismiss: (id: string) => void;
  onRegenerate: (id: string) => Promise<void>;
}

function ActionCardItem({ action, onDismiss, onRegenerate }: ActionCardProps) {
  const urgence: Urgence = action.urgence ?? "normale";
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel] = useState<"messagerie" | "whatsapp" | null>(null);
  const [modal, setModal] = useState<"document" | "ocr" | "validation" | null>(null);
  const [modifications, setModifications] = useState<string>("");
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  const [showNotationModal, setShowNotationModal] = useState(false);
  const [hov, setHov] = useState(false);

  const suggestedText = (action.payload?.texte as string) ?? (action.payload?.brouillon as string) ?? "";

  async function execute(ctaLabel?: string) {
    setExecuting(true);
    try {
      const body: Record<string, unknown> = { action_id: action.id };
      if (modifications && modifications !== suggestedText) {
        body.modifications = modifications;
        // Learn from modification
        await api.post("/sphere/preference", { cle: `${action.type}_style`, valeur: modifications }).catch(() => {});
      }
      if (ctaLabel) body.cta = ctaLabel;
      await api.post("/sphere/executer", body);
      setExecuted(true);
    } catch { /* ignore */ }
    finally { setExecuting(false); }
  }

  if (executed) {
    return (
      <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", fontSize: 13, color: "#16A34A" }}>
        ✓ Action exécutée
      </div>
    );
  }

  // NOTATION card — ouvre la NotationModal
  if (action.type === "notation_action" && !ratingDone) {
    const acteurPrenom = action.acteur_nom?.split(" ")[0] ?? "cet acteur";
    const acteurNom    = action.acteur_nom?.split(" ").slice(1).join(" ") ?? undefined;

    return (
      <>
        <div style={{ background: "#FFFFFF", border: "none", borderLeft: `3px solid ${URGENCE_COLOR[urgence]}`, borderRadius: 16, padding: "20px 22px", boxShadow: "0 2px 10px rgba(26,22,18,0.06)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: action.acteur_id ? 12 : 0 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <UrgenceBadge urgence={urgence} />
              </div>
              <p style={{ fontSize: 13, color: "var(--althy-text)", margin: 0, lineHeight: 1.5 }}>{action.titre ?? action.description}</p>
            </div>
            <button onClick={() => onDismiss(action.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--althy-text-3)", flexShrink: 0, padding: 2 }}><X size={14} /></button>
          </div>
          {action.acteur_id && (
            <button
              onClick={() => setShowNotationModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, background: "var(--althy-orange-bg)", border: "1px solid rgba(232,96,44,0.25)", color: "var(--althy-orange)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >
              <Star size={14} fill="var(--althy-orange)" strokeWidth={0} />
              Laisser un avis
            </button>
          )}
        </div>
        {showNotationModal && action.acteur_id && (
          <NotationModal
            acteur={{ id: action.acteur_id, prenom: acteurPrenom, nom: acteurNom, role: (action.payload?.acteur_role as string) ?? undefined }}
            contexteType={(action.payload?.contexte_type as string) ?? "mission"}
            contexteId={(action.payload?.contexte_id as string) ?? undefined}
            onClose={() => setShowNotationModal(false)}
            onDone={() => { setShowNotationModal(false); setRatingDone(true); onDismiss(action.id); }}
          />
        )}
      </>
    );
  }

  const cardShadow = hov
    ? "0 6px 20px rgba(26,22,18,0.12)"
    : "0 2px 10px rgba(26,22,18,0.06)";

  return (
    <>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{ background: "#FFFFFF", border: "none", borderLeft: `3px solid ${URGENCE_COLOR[urgence]}`, borderRadius: 16, overflow: "hidden", boxShadow: cardShadow, transform: hov ? "translateY(-2px)" : "translateY(0)", transition: "box-shadow 0.2s, transform 0.2s" }}
      >
        {/* Card header */}
        <div style={{ padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <UrgenceBadge urgence={urgence} />
                {action.type && (
                  <span style={{ fontSize: 10, color: "#B0A89E", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {action.type.replace("_action", "").replace("_", " ")}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1614", margin: "0 0 4px" }}>{action.titre ?? action.label}</p>
              <p style={{ fontSize: 12, color: "#A09890", margin: 0, lineHeight: 1.55 }}>{action.description}</p>
            </div>
            <button onClick={() => onDismiss(action.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#B0A89E", flexShrink: 0, padding: 2 }}><X size={14} /></button>
          </div>

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {action.href && !["document_action", "validation_action", "ocr_action", "messagerie_action", "whatsapp_action"].includes(action.type ?? "") ? (
              <Link
                href={action.href}
                style={{ padding: "8px 16px", borderRadius: 10, background: "#E8602C", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                {action.cta_principal ?? "Voir →"}
              </Link>
            ) : (
              <button
                onClick={() => {
                  if (action.type === "document_action" || action.type === "validation_action" || action.type === "ocr_action") {
                    setModal(action.type === "document_action" ? "document" : action.type === "validation_action" ? "validation" : "ocr");
                  } else if (action.type === "messagerie_action") {
                    setPanel("messagerie");
                  } else if (action.type === "whatsapp_action") {
                    setPanel("whatsapp");
                  } else if (action.type === "integration_action") {
                    window.location.href = "/admin/integration?" + new URLSearchParams(action.payload as Record<string, string>).toString();
                  } else {
                    setExpanded(v => !v);
                  }
                }}
                style={{ padding: "8px 16px", borderRadius: 10, background: "#E8602C", color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                {action.cta_principal ?? "Voir"}
              </button>
            )}

            {action.cta_secondaire && (
              <button onClick={() => execute(action.cta_secondaire)} disabled={executing}
                style={{ padding: "8px 16px", borderRadius: 10, background: "#FAFAF7", color: "#3D3830", border: "1px solid #EDE9E3", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {action.cta_secondaire}
              </button>
            )}

            <button onClick={() => onDismiss(action.id)}
              style={{ padding: "8px 14px", borderRadius: 10, background: "transparent", color: "#A09890", border: "none", fontSize: 12, cursor: "pointer" }}>
              Ignorer
            </button>
          </div>
        </div>

        {/* Expanded detail for paiement / intervention / agenda */}
        {expanded && (action.type === "paiement_action" || action.type === "intervention_action" || action.type === "agenda_action") && (
          <div style={{ borderTop: "1px solid #F0ECE6", padding: "16px 22px", background: "#FAFAF7" }}>
            {action.payload && Object.entries(action.payload).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#3D3830", marginBottom: 6 }}>
                <span style={{ color: "#A09890", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                <span style={{ fontWeight: 500 }}>{String(v)}</span>
              </div>
            ))}
            {suggestedText && (
              <ModifiableText text={suggestedText} actionId={action.id} onRegenerate={onRegenerate} onModified={setModifications} />
            )}
            <button onClick={() => execute(action.cta_principal)} disabled={executing}
              style={{ marginTop: 12, width: "100%", padding: "10px 0", borderRadius: 10, background: "#E8602C", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: executing ? 0.6 : 1 }}>
              {executing ? "En cours…" : (action.cta_principal ?? "Valider")}
            </button>
          </div>
        )}
      </div>

      {/* ── Messagerie panel ── */}
      {panel === "messagerie" && (
        <RightPanel title="Brouillon message" onClose={() => setPanel(null)}>
          <p style={{ fontSize: 12, color: "var(--althy-text-3)", marginBottom: 12 }}>
            Destinataire : <strong>{String(action.payload?.destinataire ?? "—")}</strong>
          </p>
          <ModifiableText text={suggestedText || String(action.payload?.brouillon ?? "Rédigez votre message ici.")} actionId={action.id} onRegenerate={onRegenerate} onModified={setModifications} />
          <button onClick={() => { execute(); setPanel(null); }} disabled={executing}
            style={{ marginTop: 16, width: "100%", padding: "10px 0", borderRadius: 8, background: "var(--althy-orange)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Envoyer le message
          </button>
        </RightPanel>
      )}

      {/* ── WhatsApp panel ── */}
      {panel === "whatsapp" && (
        <RightPanel title="Message WhatsApp" onClose={() => setPanel(null)}>
          <p style={{ fontSize: 12, color: "var(--althy-text-3)", marginBottom: 12 }}>
            Vers : <strong>{String(action.payload?.telephone ?? action.payload?.destinataire ?? "—")}</strong>
          </p>
          <ModifiableText text={suggestedText || String(action.payload?.message ?? "Bonjour,")} actionId={action.id} onRegenerate={onRegenerate} onModified={setModifications} />
          <button onClick={() => { execute(); setPanel(null); }} disabled={executing}
            style={{ marginTop: 16, width: "100%", padding: "10px 0", borderRadius: 8, background: "#25D366", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Envoyer via WhatsApp
          </button>
        </RightPanel>
      )}

      {/* ── Document modal ── */}
      {modal === "document" && (
        <Modal title={action.titre ?? "Document"} onClose={() => setModal(null)}>
          {!!action.payload?.url && (
            <div style={{ background: "var(--althy-bg)", borderRadius: 10, padding: 16, marginBottom: 16, minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <iframe src={String(action.payload.url)} style={{ width: "100%", height: 400, border: "none", borderRadius: 8 }} title="Document preview" />
            </div>
          )}
          <ModifiableText text={suggestedText || "Contenu du document"} actionId={action.id} onRegenerate={onRegenerate} onModified={setModifications} />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => { execute(); setModal(null); }}
              style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "var(--althy-orange)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Valider et envoyer
            </button>
            <button onClick={() => setModal(null)}
              style={{ padding: "10px 16px", borderRadius: 8, background: "var(--althy-bg)", color: "var(--althy-text)", border: "1px solid var(--althy-border)", fontSize: 13, cursor: "pointer" }}>
              Modifier
            </button>
          </div>
        </Modal>
      )}

      {/* ── OCR modal ── */}
      {modal === "ocr" && (
        <Modal title="Données extraites" onClose={() => setModal(null)}>
          <p style={{ fontSize: 13, color: "var(--althy-text-3)", marginBottom: 16 }}>Vérifiez et corrigez les données extraites avant import.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {action.payload && Object.entries(action.payload).filter(([k]) => k !== "url").map(([k, v]) => (
              <div key={k}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--althy-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{k.replace(/_/g, " ")}</label>
                <input defaultValue={String(v)} style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--althy-border)", borderRadius: 8, fontSize: 13, background: "var(--althy-bg)", color: "var(--althy-text)", outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
          <button onClick={() => { execute(); setModal(null); }}
            style={{ width: "100%", padding: "10px 0", borderRadius: 8, background: "var(--althy-orange)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Importer dans le bien
          </button>
        </Modal>
      )}

      {/* ── Validation modal ── */}
      {modal === "validation" && (
        <Modal title={action.titre ?? "Dossier à valider"} onClose={() => setModal(null)}>
          <p style={{ fontSize: 13, color: "var(--althy-text-3)", marginBottom: 16 }}>{action.description}</p>
          {action.payload && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {Object.entries(action.payload).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "var(--althy-bg)", borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--althy-text-3)", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--althy-text)" }}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
          <ModifiableText text={suggestedText} actionId={action.id} onRegenerate={onRegenerate} onModified={setModifications} />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => { execute(action.cta_principal); setModal(null); }}
              style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "var(--althy-orange)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {action.cta_principal ?? "Valider le dossier"}
            </button>
            {action.cta_secondaire && (
              <button onClick={() => { execute(action.cta_secondaire); setModal(null); }}
                style={{ padding: "10px 16px", borderRadius: 8, background: "var(--althy-bg)", color: "var(--althy-text)", border: "1px solid var(--althy-border)", fontSize: 13, cursor: "pointer" }}>
                {action.cta_secondaire}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SpherePage() {
  const store = useSphereStore();
  const { data: profile } = useUser();
  const { user } = useAuthStore();
  const { role } = useRole();
  const abortRef = useRef<AbortController | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const [briefingActions, setBriefingActions] = useState<SphereAction[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [briefingSummary, setBriefingSummary] = useState<string>("");

  const firstName = profile?.first_name ?? user?.user_metadata?.first_name ?? "";
  const roleKey = role ?? "proprio_solo";
  const { title, subtitle } = getGreeting(roleKey, firstName);

  // Fetch daily briefing
  useEffect(() => {
    api.get<{ actions: SphereAction[]; summary?: string }>("/sphere/briefing")
      .then(r => {
        const sorted = (r.data.actions ?? []).sort((a, b) => {
          const order: Record<Urgence, number> = { haute: 0, normale: 1, info: 2 };
          return (order[a.urgence ?? "info"] ?? 2) - (order[b.urgence ?? "info"] ?? 2);
        });
        setBriefingActions(sorted);
        setBriefingSummary(r.data.summary ?? "");
      })
      .catch(() => {});
  }, []);

  const isStreaming = store.state === "thinking" || store.state === "speaking";
  const remaining = store.canSend()
    ? 30 - (store.dailyDate === new Date().toISOString().slice(0, 10) ? store.dailyCount : 0)
    : 0;

  const lastAssistant = [...store.messages].reverse().find((m) => m.role === "assistant");
  const lastUser = [...store.messages].reverse().find((m) => m.role === "user");

  // Actions to show: briefing + any from last AI response
  const conversationActions = (!isStreaming && lastAssistant?.actions?.length) ? lastAssistant.actions : [];
  const allActions = [...briefingActions, ...conversationActions].filter(a => !dismissedIds.has(a.id));

  // Deduplicate by id
  const seen = new Set<string>();
  const visibleActions = allActions.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });

  function dismissAction(id: string) {
    setDismissedIds(prev => new Set([...prev, id]));
  }

  async function regenerateAction(id: string) {
    await api.post("/sphere/regenerer", { action_id: id });
  }

  const sendMessage = useCallback(
    async (text: string) => {
      if (!store.canSend() || isStreaming) return;
      store.incrementDaily();

      const userMsg = { id: crypto.randomUUID(), role: "user" as const, content: text, createdAt: Date.now() };
      store.addMessage(userMsg);
      const assistantMsg = { id: crypto.randomUUID(), role: "assistant" as const, content: "", createdAt: Date.now() };
      store.addMessage(assistantMsg);
      store.clearStreamingText();
      store.setState("thinking");

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      abortRef.current = new AbortController();

      try {
        const resp = await fetch(`${baseURL}/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ message: text, context: { session_id: store.sessionId ?? crypto.randomUUID(), page: "sphere", role: roleKey } }),
          signal: abortRef.current.signal,
        });

        if (!resp.ok || !resp.body) { store.updateLastAssistant("Erreur de connexion."); store.setState("idle"); return; }

        store.setState("speaking");
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "", fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;
            try {
              const ev = JSON.parse(raw) as { type?: string; text?: string; intent?: string; actions?: SphereAction[]; error?: string };
              if (ev.type === "intent" && ev.actions) store.setLastActions(ev.intent ?? "", ev.actions);
              else if (ev.type === "text" || ev.text) { const chunk = (ev.text ?? "").replace(/\\n/g, "\n"); fullText += chunk; store.appendStreamingText(chunk); store.updateLastAssistant(fullText); }
              else if (ev.type === "error" || ev.error) store.updateLastAssistant(ev.error ?? "Erreur IA.");
            } catch { /* ignore */ }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") store.updateLastAssistant("Connexion interrompue.");
      } finally {
        store.clearStreamingText();
        store.setState("idle");
      }
    },
    [store, isStreaming, roleKey]
  );

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await sendMessage(`[Photo] ${file.name} — Analysez cette image et extrayez les informations pertinentes.`);
    e.target.value = "";
  }

  // Glassmorphism button style
  const glassBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6,
    padding: "8px 16px", borderRadius: 10,
    background: "rgba(255,255,255,0.70)",
    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    border: "1px solid #EDE9E3",
    color: "#3D3830", fontSize: 13, fontWeight: 500,
    textDecoration: "none", cursor: "pointer",
  };

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes sphereBreath {
          0%,100% { transform: scale(1); filter: drop-shadow(0 12px 40px rgba(232,96,44,0.22)); }
          50%      { transform: scale(1.025); filter: drop-shadow(0 16px 52px rgba(232,96,44,0.32)); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Page wrapper ── */}
      <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 16px 140px" }}>

        {/* ── Top bar minimale ── */}
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 56, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <Link href="/app" style={glassBtn}>
            ← Retour
          </Link>
          <Link href="/app" style={{ ...glassBtn, padding: "8px 12px" }} title="Tableau de bord">
            <LayoutGrid size={16} />
          </Link>
        </div>

        <div style={{ width: "100%", maxWidth: 640, paddingTop: 56 }}>

          {/* ─────────────────── ZONE 1 : Sphere + greeting ─────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 48, paddingBottom: 28, textAlign: "center" }}>

            {/* Sphere 170px + breath animation */}
            <div style={{ marginBottom: 28, animation: "sphereBreath 4s ease-in-out infinite" }}>
              <AlthySphereCore state={store.state} size={170} />
            </div>

            <div style={{ animation: "fadeIn 0.5s ease" }}>
              <h1 style={{ fontFamily: "var(--font-serif, 'Cormorant Garamond', serif)", fontSize: 28, fontWeight: 300, color: "#1A1614", margin: "0 0 6px", letterSpacing: "-0.01em" }}>
                {title}
              </h1>
              <p style={{ fontSize: 14, color: "#A09890", margin: "0 0 4px" }}>{subtitle}</p>

              {briefingSummary && (
                <p style={{ fontSize: 13, color: "#3D3830", maxWidth: 460, lineHeight: 1.65, margin: "12px auto 0", background: "#FFFFFF", border: "1px solid #EDE9E3", borderRadius: 12, padding: "11px 16px" }}>
                  {briefingSummary}
                </p>
              )}

              {ROLE_LABELS[roleKey as keyof typeof ROLE_LABELS] && (
                <span style={{ display: "inline-block", marginTop: 10, fontSize: 10, fontWeight: 700, color: "#E8602C", background: "#FEF0EA", padding: "4px 12px", borderRadius: 8, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                  {ROLE_LABELS[roleKey as keyof typeof ROLE_LABELS]}
                </span>
              )}
            </div>

            {/* Nouvelle conversation */}
            {store.messages.length > 0 && (
              <button onClick={() => store.clearMessages()} style={{ marginTop: 14, fontSize: 12, color: "#A09890", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Nouvelle conversation
              </button>
            )}
          </div>

          {/* ─────────────────── ZONE 2 : Action cards ──────────────────────── */}
          {visibleActions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#B0A89E", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
                {visibleActions.filter(a => a.urgence === "haute").length > 0 ? "Actions prioritaires" : "Actions suggérées"}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {visibleActions.map((action, i) => (
                  <div key={action.id} style={{
                    animation: "fadeSlideUp 0.35s ease both",
                    animationDelay: `${i * 60}ms`,
                  }}>
                    <ActionCardItem action={action} onDismiss={dismissAction} onRegenerate={regenerateAction} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lien tableau de bord */}
          {visibleActions.length > 0 && (
            <div style={{ textAlign: "center", marginTop: 20, marginBottom: 8 }}>
              <Link href="/app" style={{ fontSize: 12, color: "#B0A89E", textDecoration: "none" }}>
                Tableau de bord complet →
              </Link>
            </div>
          )}

          {/* SSE response */}
          {store.messages.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <SphereStream text={lastAssistant?.content ?? ""} isStreaming={isStreaming} userMessage={lastUser?.content} />
            </div>
          )}

          {/* Empty state */}
          {store.messages.length === 0 && visibleActions.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 0 32px", color: "#B0A89E", fontSize: 13 }}>
              Posez votre question ou parlez directement à Althy.
            </div>
          )}
        </div>

        {/* ─────────────────── ZONE 3 : Input bar fixée ───────────────────── */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "rgba(250,250,247,0.88)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid #EDE9E3",
          padding: "10px 16px 20px", zIndex: 100,
        }}>
          <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", gap: 8, alignItems: "flex-end" }}>
            {/* Camera button */}
            <button
              onClick={() => photoRef.current?.click()}
              title="Envoyer une photo"
              style={{
                flexShrink: 0, width: 44, height: 44, borderRadius: 12,
                background: "#FFFFFF", border: "1px solid #EDE9E3",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#A09890",
              }}
            >
              <Camera size={17} />
            </button>
            <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />

            {/* Text input + send — SphereInput gère le state interne */}
            <div style={{ flex: 1 }}>
              <SphereInput onSend={sendMessage} disabled={isStreaming} remainingToday={remaining} />
            </div>
          </div>
          <p style={{ textAlign: "center", fontSize: 11, color: "#A09890", margin: "7px 0 0", opacity: 0.6 }}>
            Althy suggère, vous validez. Vérifiez tout document légal avec un professionnel.
          </p>
        </div>

      </div>
    </>
  );
}
