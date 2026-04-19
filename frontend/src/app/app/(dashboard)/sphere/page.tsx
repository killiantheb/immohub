"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, LayoutGrid, RefreshCw, Star, X } from "lucide-react";
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

// ── Constantes ────────────────────────────────────────────────────────────────

const URGENCE_COLOR: Record<Urgence, string> = {
  haute:   "var(--althy-red)",
  normale: "var(--terracotta-primary)",
  info:    "var(--sky)",
};
const URGENCE_BG: Record<Urgence, string> = {
  haute:   "var(--urgent-bg)",
  normale: "var(--terracotta-ghost)",
  info:    "var(--info-bg)",
};
const URGENCE_LABEL: Record<Urgence, string> = {
  haute:   "Urgent",
  normale: "À faire",
  info:    "Info",
};

const PLAN_LABELS: Record<string, string> = {
  proprio_solo:    "SOLO",
  agence:          "AGENCE",
  locataire:       "Gratuit",
  hunter:          "Referral",
  opener:          "Gratuit",
  artisan:         "Gratuit",
  expert:          "Gratuit",
  acheteur_premium:"Premium",
  super_admin:     "Admin",
};

const SUGGESTIONS = [
  "Quels loyers sont en retard ?",
  "Génère un bail pour mon bien",
  "Résume mon mois",
  "Trouver un ouvreur à Genève",
];

// ── OrganicSphere ─────────────────────────────────────────────────────────────

function OrganicSphere({ state }: { state: string }) {
  const isActive    = state === "thinking" || state === "speaking";
  const isListening = state === "listening";

  return (
    <div style={{ position: "relative", width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Outer glow */}
      <div style={{
        position: "absolute", inset: -24,
        background: "radial-gradient(circle, rgba(232,96,44,0.10) 0%, transparent 70%)",
        borderRadius: "50%",
        animation: "sphereGlow 4s ease-in-out infinite",
      }} />

      {/* Pulsing rings */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: "absolute",
          width:  140 + i * 28,
          height: 140 + i * 28,
          borderRadius: "50%",
          border: `1px solid rgba(232,96,44,${0.18 - i * 0.05})`,
          animation: "pulseRing 3s ease-in-out infinite",
          animationDelay: `${i * 0.7}s`,
          opacity: isActive ? 1 : 0.6,
          transition: "opacity 0.4s",
        }} />
      ))}

      {/* Core sphere */}
      <div style={{
        width: 120, height: 120,
        borderRadius: "50%",
        background: isListening
          ? "radial-gradient(circle at 35% 35%, #FF9066 0%, #E8602C 45%, #C84E1E 100%)"
          : "radial-gradient(circle at 35% 35%, #FF8055 0%, #E8602C 40%, #C84E1E 100%)",
        boxShadow: isActive
          ? "0 0 60px rgba(232,96,44,0.45), 0 0 30px rgba(232,96,44,0.25), inset 0 2px 6px rgba(255,255,255,0.30)"
          : "0 0 40px rgba(232,96,44,0.25), 0 0 20px rgba(232,96,44,0.15), inset 0 2px 4px rgba(255,255,255,0.25)",
        animation: isActive ? "spherePulse 1.5s ease-in-out infinite" : "sphereBreath 4s ease-in-out infinite",
        position: "relative",
        overflow: "hidden",
        transition: "box-shadow 0.4s",
      }}>
        <div style={{ position: "absolute", top: 14, left: 18, width: 28, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.32)", transform: "rotate(-30deg)" }} />
        <div style={{ position: "absolute", top: 28, left: 28, width: 10, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.18)" }} />
      </div>
    </div>
  );
}

// ── UrgenceBadge ──────────────────────────────────────────────────────────────

function UrgenceBadge({ urgence }: { urgence: Urgence }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 99,
      background: URGENCE_BG[urgence],
      color: URGENCE_COLOR[urgence],
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    }}>
      {URGENCE_LABEL[urgence]}
    </span>
  );
}

// ── ModifiableText ────────────────────────────────────────────────────────────

interface ModifiableTextProps {
  text: string;
  actionId: string;
  onRegenerate: (id: string) => void;
  onModified: (text: string) => void;
}

function ModifiableText({ text, actionId, onRegenerate, onModified }: ModifiableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(text);
  const [regen, setRegen]     = useState(false);

  async function handleRegenerate() {
    setRegen(true);
    try { await onRegenerate(actionId); } catch { /* */ }
    setRegen(false);
  }

  return (
    <div style={{ marginTop: 10 }}>
      {editing ? (
        <textarea
          value={draft}
          onChange={e => { setDraft(e.target.value); onModified(e.target.value); }}
          rows={4}
          style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--terracotta-primary)", borderRadius: 10, fontSize: 13, background: "var(--cream)", color: "var(--text-primary)", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
        />
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, background: "var(--cream)", padding: "10px 14px", borderRadius: 10, margin: 0, fontStyle: "italic", border: "1px solid var(--border-subtle)" }}>{draft}</p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button onClick={() => setEditing(v => !v)} style={{ fontSize: 11, color: "var(--terracotta-primary)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
          {editing ? "Fermer" : "Modifier avant de valider"}
        </button>
        <button onClick={handleRegenerate} disabled={regen} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--text-tertiary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <RefreshCw size={11} style={{ animation: regen ? "spin 1s linear infinite" : "none" }} /> Régénérer
        </button>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(43,43,43,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--althy-surface)", borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(43,43,43,0.20)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-serif)" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

// ── RightPanel ────────────────────────────────────────────────────────────────

function RightPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(43,43,43,0.4)" }} onClick={onClose} />
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 400, background: "var(--althy-surface)", boxShadow: "-8px 0 40px rgba(43,43,43,0.12)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-serif)" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

// ── ActionCardItem ────────────────────────────────────────────────────────────

interface ActionCardProps {
  action: SphereAction;
  onDismiss: (id: string) => void;
  onRegenerate: (id: string) => Promise<void>;
}

function ActionCardItem({ action, onDismiss, onRegenerate }: ActionCardProps) {
  const urgence: Urgence = action.urgence ?? "normale";
  const [expanded, setExpanded]   = useState(false);
  const [panel, setPanel]         = useState<"messagerie" | "whatsapp" | null>(null);
  const [modal, setModal]         = useState<"document" | "ocr" | "validation" | null>(null);
  const [modifications, setModifications] = useState<string>("");
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted]   = useState(false);
  const [ratingDone, setRatingDone]     = useState(false);
  const [showNotationModal, setShowNotationModal] = useState(false);
  const [hov, setHov]             = useState(false);

  const suggestedText = (action.payload?.texte as string) ?? (action.payload?.brouillon as string) ?? "";

  async function execute(ctaLabel?: string) {
    setExecuting(true);
    try {
      const body: Record<string, unknown> = { action_id: action.id };
      if (modifications && modifications !== suggestedText) {
        body.modifications = modifications;
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
      <div style={{ padding: "14px 18px", borderRadius: 16, background: "var(--success-bg)", border: "1px solid rgba(34,181,115,0.2)", fontSize: 13, color: "var(--sage)", fontWeight: 500 }}>
        ✓ Action exécutée
      </div>
    );
  }

  // NOTATION card
  if (action.type === "notation_action" && !ratingDone) {
    const acteurPrenom = action.acteur_nom?.split(" ")[0] ?? "cet acteur";
    const acteurNom    = action.acteur_nom?.split(" ").slice(1).join(" ") ?? undefined;
    return (
      <>
        <div style={{ background: "var(--althy-surface)", borderRadius: 16, padding: 24, border: "1px solid var(--border-subtle)", boxShadow: "0 2px 8px rgba(43,43,43,0.04)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: action.acteur_id ? 16 : 0 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <UrgenceBadge urgence={urgence} />
              </div>
              <p style={{ fontSize: 14, color: "var(--text-primary)", margin: 0, lineHeight: 1.6 }}>{action.titre ?? action.description}</p>
            </div>
            <button onClick={() => onDismiss(action.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", flexShrink: 0, padding: 2 }}><X size={14} /></button>
          </div>
          {action.acteur_id && (
            <button
              onClick={() => setShowNotationModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 99, background: "var(--terracotta-ghost)", border: "1px solid rgba(232,96,44,0.15)", color: "var(--terracotta-primary)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
            >
              <Star size={13} fill="var(--terracotta-primary)" strokeWidth={0} />
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

  return (
    <>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          background: "var(--althy-surface)",
          borderRadius: 16,
          border: "1px solid var(--border-subtle)",
          overflow: "hidden",
          boxShadow: hov ? "0 8px 32px rgba(43,43,43,0.10)" : "0 2px 8px rgba(43,43,43,0.04)",
          transform: hov ? "translateY(-2px)" : "translateY(0)",
          transition: "box-shadow 0.2s, transform 0.2s",
        }}
      >
        <div style={{ padding: 24 }}>
          {/* Badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <UrgenceBadge urgence={urgence} />
            {action.type && (
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {action.type.replace("_action", "").replace("_", " ")}
              </span>
            )}
            <button onClick={() => onDismiss(action.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)", padding: 2, marginLeft: "auto" }}><X size={14} /></button>
          </div>

          {/* Title */}
          <p style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px", fontFamily: "var(--font-serif)", lineHeight: 1.3 }}>
            {action.titre ?? action.label}
          </p>
          {/* Description */}
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 18px", lineHeight: 1.6 }}>
            {action.description}
          </p>

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(() => {
              const PANEL_TYPES = ["document_action", "validation_action", "ocr_action", "messagerie_action", "whatsapp_action"];
              const API_VERBS   = ["relancer", "générer", "generer", "envoyer", "créer", "creer"];
              const isNav = action.href
                && !PANEL_TYPES.includes(action.type ?? "")
                && !API_VERBS.some(v => action.cta_principal?.toLowerCase().startsWith(v));
              return isNav;
            })() ? (
              <Link
                href={action.href!}
                style={{ padding: "10px 20px", borderRadius: 99, background: "var(--terracotta-primary)", color: "#fff", fontSize: 13, fontWeight: 500, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
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
                style={{ padding: "10px 20px", borderRadius: 99, background: "var(--terracotta-primary)", color: "#fff", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
              >
                {action.cta_principal ?? "Voir"}
              </button>
            )}

            {action.cta_secondaire && (
              <button onClick={() => execute(action.cta_secondaire)} disabled={executing}
                style={{ padding: "10px 20px", borderRadius: 99, background: "#fff", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                {action.cta_secondaire}
              </button>
            )}

            <button onClick={() => onDismiss(action.id)}
              style={{ padding: "10px 16px", borderRadius: 99, background: "transparent", color: "var(--text-tertiary)", border: "none", fontSize: 13, cursor: "pointer" }}>
              Ignorer
            </button>
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (action.type === "paiement_action" || action.type === "intervention_action" || action.type === "agenda_action") && (
          <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "18px 24px", background: "var(--cream)" }}>
            {action.payload && Object.entries(action.payload).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-primary)", marginBottom: 8 }}>
                <span style={{ color: "var(--text-tertiary)", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                <span style={{ fontWeight: 500 }}>{String(v)}</span>
              </div>
            ))}
            {suggestedText && (
              <ModifiableText text={suggestedText} actionId={action.id} onRegenerate={onRegenerate} onModified={setModifications} />
            )}
            <button onClick={() => execute(action.cta_principal)} disabled={executing}
              style={{ marginTop: 14, width: "100%", padding: "12px 0", borderRadius: 12, background: "var(--terracotta-primary)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: executing ? 0.6 : 1 }}>
              {executing ? "En cours…" : (action.cta_principal ?? "Valider")}
            </button>
          </div>
        )}
      </div>

      {/* Messagerie panel */}
      {panel === "messagerie" && (
        <RightPanel title="Brouillon message" onClose={() => setPanel(null)}>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 12 }}>
            Destinataire : <strong>{String(action.payload?.destinataire ?? "—")}</strong>
          </p>
          <ModifiableText text={suggestedText || String(action.payload?.brouillon ?? "Rédigez votre message ici.")} actionId={action.id} onRegenerate={onRegenerate} onModified={setModifications} />
          <button onClick={() => { execute(); setPanel(null); }} disabled={executing}
            style={{ marginTop: 16, width: "100%", padding: "12px 0", borderRadius: 12, background: "var(--terracotta-primary)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Envoyer le message
          </button>
        </RightPanel>
      )}

      {/* WhatsApp panel */}
      {panel === "whatsapp" && (
        <RightPanel title="Message WhatsApp" onClose={() => setPanel(null)}>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 12 }}>
            Vers : <strong>{String(action.payload?.telephone ?? action.payload?.destinataire ?? "—")}</strong>
          </p>
          <ModifiableText text={suggestedText || String(action.payload?.message ?? "Bonjour,")} actionId={action.id} onRegenerate={onRegenerate} onModified={setModifications} />
          <button onClick={() => { execute(); setPanel(null); }} disabled={executing}
            style={{ marginTop: 16, width: "100%", padding: "12px 0", borderRadius: 12, background: "var(--whatsapp-green)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Envoyer via WhatsApp
          </button>
        </RightPanel>
      )}

      {/* Document modal */}
      {modal === "document" && (
        <Modal title={action.titre ?? "Document"} onClose={() => setModal(null)}>
          {!!action.payload?.url && (
            <div style={{ background: "var(--cream)", borderRadius: 12, padding: 16, marginBottom: 16, minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <iframe src={String(action.payload.url)} style={{ width: "100%", height: 400, border: "none", borderRadius: 8 }} title="Document preview" />
            </div>
          )}
          <ModifiableText text={suggestedText || "Contenu du document"} actionId={action.id} onRegenerate={onRegenerate} onModified={setModifications} />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => { execute(); setModal(null); }}
              style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: "var(--terracotta-primary)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Valider et envoyer
            </button>
            <button onClick={() => setModal(null)}
              style={{ padding: "12px 18px", borderRadius: 12, background: "var(--cream)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", fontSize: 13, cursor: "pointer" }}>
              Modifier
            </button>
          </div>
        </Modal>
      )}

      {/* OCR modal */}
      {modal === "ocr" && (
        <Modal title="Données extraites" onClose={() => setModal(null)}>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 16 }}>Vérifiez et corrigez les données extraites avant import.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {action.payload && Object.entries(action.payload).filter(([k]) => k !== "url").map(([k, v]) => (
              <div key={k}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{k.replace(/_/g, " ")}</label>
                <input defaultValue={String(v)} style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-subtle)", borderRadius: 10, fontSize: 13, background: "var(--cream)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} />
              </div>
            ))}
          </div>
          <button onClick={() => { execute(); setModal(null); }}
            style={{ width: "100%", padding: "12px 0", borderRadius: 12, background: "var(--terracotta-primary)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Importer dans le bien
          </button>
        </Modal>
      )}

      {/* Validation modal */}
      {modal === "validation" && (
        <Modal title={action.titre ?? "Dossier à valider"} onClose={() => setModal(null)}>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 16 }}>{action.description}</p>
          {action.payload && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {Object.entries(action.payload).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--cream)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-tertiary)", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
          <ModifiableText text={suggestedText} actionId={action.id} onRegenerate={onRegenerate} onModified={setModifications} />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => { execute(action.cta_principal); setModal(null); }}
              style={{ flex: 1, padding: "12px 0", borderRadius: 12, background: "var(--terracotta-primary)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {action.cta_principal ?? "Valider le dossier"}
            </button>
            {action.cta_secondaire && (
              <button onClick={() => { execute(action.cta_secondaire); setModal(null); }}
                style={{ padding: "12px 18px", borderRadius: 12, background: "var(--cream)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", fontSize: 13, cursor: "pointer" }}>
                {action.cta_secondaire}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SpherePage() {
  const store   = useSphereStore();
  const { data: profile } = useUser();
  const { user } = useAuthStore();
  const { role } = useRole();
  const abortRef  = useRef<AbortController | null>(null);
  const photoRef  = useRef<HTMLInputElement>(null);

  const [briefingActions, setBriefingActions] = useState<SphereAction[]>([]);
  const [dismissedIds, setDismissedIds]       = useState<Set<string>>(new Set());
  const [briefingSummary, setBriefingSummary] = useState<string>("");

  const firstName = profile?.first_name ?? user?.user_metadata?.first_name ?? "";
  const roleKey   = role ?? "proprio_solo";
  const planLabel = PLAN_LABELS[roleKey] ?? "";
  const date      = new Date().toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long" });

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
  const remaining   = store.canSend()
    ? 30 - (store.dailyDate === new Date().toISOString().slice(0, 10) ? store.dailyCount : 0)
    : 0;

  const lastAssistant = [...store.messages].reverse().find(m => m.role === "assistant");
  const lastUser      = [...store.messages].reverse().find(m => m.role === "user");

  const conversationActions = (!isStreaming && lastAssistant?.actions?.length) ? lastAssistant.actions : [];
  const allActions  = [...briefingActions, ...conversationActions].filter(a => !dismissedIds.has(a.id));
  const seen        = new Set<string>();
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

      const userMsg      = { id: crypto.randomUUID(), role: "user" as const, content: text, createdAt: Date.now() };
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
        const resp = await fetch(`${baseURL}/sphere/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ message: text, context: { session_id: store.sessionId ?? crypto.randomUUID(), page: "sphere", role: roleKey } }),
          signal: abortRef.current.signal,
        });

        if (!resp.ok || !resp.body) { store.updateLastAssistant("Erreur de connexion."); store.setState("idle"); return; }

        store.setState("speaking");
        const reader  = resp.body.getReader();
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

  // AlthySphereCore est gardé dans le code mais OrganicSphere est utilisé pour le rendu
  void AlthySphereCore;

  return (
    <>
      <style>{`
        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes sphereBreath { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }
        @keyframes spherePulse  { 0%,100% { transform: scale(1); } 50% { transform: scale(1.07); } }
        @keyframes sphereGlow   { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes pulseRing    { 0%,100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.06); opacity: 1; } }
        @keyframes fadeSlideUp  { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn       { from { opacity: 0; transform: translateY(8px);  } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="min-h-screen bg-white">

        {/* ── Header minimal ── */}
        <div className="fixed top-0 left-0 right-0 z-10 bg-white/70 backdrop-blur-xl border-b border-[var(--border-subtle)]">
          <div className="max-w-[800px] mx-auto px-8 py-5 flex justify-between items-center">
            <Link href="/app" className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--terracotta-primary)] transition-colors">
              <ArrowLeft size={16} strokeWidth={1.5} />
              <span className="font-medium">Retour</span>
            </Link>
            <Link href="/app" className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--terracotta-primary)] transition-colors">
              <LayoutGrid size={16} strokeWidth={1.5} />
              <span className="font-medium">Dashboard</span>
            </Link>
          </div>
        </div>

        {/* ── Contenu centré ── */}
        <div className="max-w-[800px] mx-auto px-8 pt-32 pb-48">

          {/* Zone 1 : Sphere + greeting */}
          <div className="flex flex-col items-center text-center mb-12" style={{ animation: "fadeIn 0.5s ease" }}>
            <div className="mb-8">
              <OrganicSphere state={store.state} />
            </div>

            <h1
              className="text-[56px] leading-[1.1] font-semibold text-[var(--charcoal)] mb-4"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Bonjour{firstName ? `, ${firstName}` : ""}
            </h1>

            <p className="text-[16px] text-[var(--text-secondary)] mb-6">
              Voici votre briefing du {date}.
            </p>

            {briefingSummary && (
              <div className="inline-block bg-[var(--cream)] rounded-2xl px-6 py-4 mb-6 border border-[var(--border-subtle)]">
                <p className="text-[14px] text-[var(--text-secondary)]">{briefingSummary}</p>
              </div>
            )}

            {ROLE_LABELS[roleKey as keyof typeof ROLE_LABELS] && (
              <span className="inline-block px-4 py-2 bg-[var(--terracotta-ghost)] text-[var(--terracotta-primary)] rounded-full text-[11px] font-medium uppercase tracking-wider border border-[rgba(232,96,44,0.15)]">
                {ROLE_LABELS[roleKey as keyof typeof ROLE_LABELS]}{planLabel ? ` · ${planLabel}` : ""}
              </span>
            )}

            {store.messages.length > 0 && (
              <button
                onClick={() => store.clearMessages()}
                className="mt-4 text-[12px] text-[var(--text-tertiary)] bg-transparent border-none cursor-pointer underline"
              >
                Nouvelle conversation
              </button>
            )}
          </div>

          {/* Zone 2 : Action cards */}
          {visibleActions.length > 0 && (
            <div className="mb-8">
              <p className="text-[11px] font-semibold text-[var(--text-tertiary)] tracking-widest uppercase mb-4">
                {visibleActions.filter(a => a.urgence === "haute").length > 0 ? "Actions prioritaires" : "Actions suggérées"}
              </p>
              <div className="flex flex-col gap-4">
                {visibleActions.map((action, i) => (
                  <div key={action.id} style={{ animation: "fadeSlideUp 0.35s ease both", animationDelay: `${i * 60}ms` }}>
                    <ActionCardItem action={action} onDismiss={dismissAction} onRegenerate={regenerateAction} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {visibleActions.length > 0 && (
            <div className="text-center mb-8">
              <Link href="/app" className="text-[12px] text-[var(--text-tertiary)]" style={{ textDecoration: "none" }}>
                Tableau de bord complet →
              </Link>
            </div>
          )}

          {/* SSE response */}
          {store.messages.length > 0 && (
            <div className="mb-6">
              <SphereStream text={lastAssistant?.content ?? ""} isStreaming={isStreaming} userMessage={lastUser?.content} />
            </div>
          )}

          {/* Empty state + suggestion chips */}
          {store.messages.length === 0 && visibleActions.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[14px] text-[var(--text-tertiary)] mb-6">
                Posez votre question ou parlez directement à Althy.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="px-5 py-2.5 bg-white border border-[var(--border-subtle)] rounded-full text-[13px] text-[var(--text-secondary)] hover:border-[var(--terracotta-primary)] hover:text-[var(--terracotta-primary)] transition-all cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Input bar fixée ── */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-[var(--border-subtle)] py-6">
          <div className="max-w-[800px] mx-auto px-8">
            <div className="flex items-center gap-3 mb-3">
              {/* Camera */}
              <button
                onClick={() => photoRef.current?.click()}
                title="Envoyer une photo"
                className="w-12 h-12 flex-shrink-0 rounded-2xl bg-[var(--cream)] border border-[var(--border-subtle)] flex items-center justify-center cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--terracotta-primary)] hover:border-[var(--terracotta-primary)] transition-colors"
              >
                <Camera size={18} />
              </button>
              <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />

              {/* Text input + send */}
              <div className="flex-1">
                <SphereInput onSend={sendMessage} disabled={isStreaming} remainingToday={remaining} />
              </div>
            </div>
            <p className="text-center text-[12px] text-[var(--text-tertiary)]">
              Althy suggère, vous validez · {remaining} messages restants
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
