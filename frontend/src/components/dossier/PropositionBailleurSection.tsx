"use client";

/**
 * PropositionBailleurSection — vue bailleur du Module Proposition (Sprint 4B).
 *
 * Affiche la proposition reçue du locataire + 3 CTA (Accepter / Contre-proposer
 * / Refuser) avec 2 modals (contre-proposition + refus). Géré aussi le state
 * intermédiaire "en attente locataire" et les états finaux accepte / refuse.
 *
 * États gérés (RBAC backend déjà filtré : seul un bailleur du bien voit cette section) :
 *   - non_propose                  → message d'attente locataire
 *   - propose_par_locataire        → card complète + 3 CTA
 *   - contre_propose_par_bailleur  → "en attente réponse locataire"
 *   - accepte                      → banner Vert récap
 *   - refuse                       → banner Rouge + motif
 *
 * Doctrine §B.4/§B.10/§B.15 identiques à PropositionLocataireSection.
 */

import { useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit3,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";

import {
  ANIMAUX_LABELS,
  DUREE_LABELS,
  FLEXIBILITE_LABELS,
  MAX_PROPOSITIONS,
  MEUBLE_LABELS,
  type PropositionStatusResponse,
} from "@/lib/api/proposition";
import {
  useAccepterBailleur,
  useContreProposerBailleur,
  useRefuserProposition,
} from "@/lib/hooks/useProposition";
import { C } from "@/lib/design-tokens";

interface Props {
  locataireId: string;
  proposition: PropositionStatusResponse;
}

function fmtDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function PropositionBailleurSection({ locataireId, proposition }: Props) {
  const statut = proposition.statut_proposition;

  if (statut === "non_propose") {
    return (
      <Card>
        <Header />
        <div style={emptyStateStyle}>
          <Clock size={20} style={{ color: C.text3, marginBottom: 8 }} />
          <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>
            Le locataire n&apos;a pas encore proposé de date d&apos;entrée ni de
            préférences. Il pourra le faire depuis son espace dossier.
          </p>
        </div>
      </Card>
    );
  }

  if (statut === "propose_par_locataire") {
    return (
      <PropositionRecue locataireId={locataireId} proposition={proposition} />
    );
  }

  if (statut === "contre_propose_par_bailleur") {
    return (
      <Card>
        <Header />
        <div style={bannerStyle(C.prussian, C.prussianBg)}>
          <Send size={20} style={{ color: C.prussian, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.prussian, margin: "0 0 4px" }}>
              En attente de la réponse du locataire
            </p>
            <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>
              Vous avez contre-proposé le{" "}
              <strong>{fmtDateFr(proposition.date_contre_proposee_bailleur)}</strong>
              {proposition.last_proposed_at && (
                <> · envoyé le {fmtDateFr(proposition.last_proposed_at)}</>
              )}
              . Tour {proposition.proposition_count}/{MAX_PROPOSITIONS}.
            </p>
          </div>
        </div>
        <Recap proposition={proposition} />
      </Card>
    );
  }

  if (statut === "accepte") {
    return (
      <Card>
        <Header />
        <div style={bannerStyle(C.green, C.greenBg)}>
          <CheckCircle2 size={20} style={{ color: C.green, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.green, margin: "0 0 4px" }}>
              Accord conclu — entrée le {fmtDateFr(proposition.date_accord)}
            </p>
            <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>
              Cette date sera enregistrée comme date d&apos;entrée officielle du
              locataire à la finalisation du dossier (100% complété, après
              versement loyer + caution).
            </p>
          </div>
        </div>
        <Recap proposition={proposition} />
      </Card>
    );
  }

  if (statut === "refuse") {
    return (
      <Card>
        <Header />
        <div style={bannerStyle(C.red, C.redBg)}>
          <XCircle size={20} style={{ color: C.red, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.red, margin: "0 0 4px" }}>
              Proposition refusée
              {proposition.last_proposed_at && (
                <> · {fmtDateFr(proposition.last_proposed_at)}</>
              )}
            </p>
            {proposition.motif_refus && (
              <p
                style={{
                  fontSize: 13,
                  color: C.text2,
                  margin: "6px 0 0",
                  lineHeight: 1.5,
                  fontStyle: "italic",
                }}
              >
                Motif : « {proposition.motif_refus} »
              </p>
            )}
            <p style={{ fontSize: 13, color: C.text2, margin: "6px 0 0", lineHeight: 1.5 }}>
              Le locataire peut relancer une nouvelle proposition depuis son
              espace.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return null;
}

// ── État principal : proposition reçue, 3 CTA bailleur ───────────────────────

function PropositionRecue({
  locataireId,
  proposition,
}: {
  locataireId: string;
  proposition: PropositionStatusResponse;
}) {
  const accepter = useAccepterBailleur(locataireId);
  const refuser = useRefuserProposition(locataireId);
  const [showContre, setShowContre] = useState(false);
  const [showRefus, setShowRefus] = useState(false);

  return (
    <Card>
      <Header />
      <div style={bannerStyle(C.gold, C.goldBg)}>
        <CalendarDays size={20} style={{ color: C.gold, flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: "0 0 4px" }}>
            Le locataire propose le{" "}
            <strong>{fmtDateFr(proposition.date_entree_souhaitee)}</strong>
          </p>
          <p style={{ fontSize: 12, color: C.text3, margin: 0 }}>
            Tour {proposition.proposition_count}/{MAX_PROPOSITIONS}
            {proposition.last_proposed_at && (
              <> · reçue le {fmtDateFr(proposition.last_proposed_at)}</>
            )}
          </p>
        </div>
      </div>

      <Recap proposition={proposition} />

      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {proposition.peut_accepter_bailleur && (
          <button
            type="button"
            onClick={() => void accepter.mutateAsync()}
            disabled={accepter.isPending}
            style={primaryBtnStyle(C.green)}
          >
            {accepter.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <CheckCircle2 size={13} />
            )}
            Accepter cette date
          </button>
        )}
        {proposition.peut_contre_proposer && !proposition.limite_atteinte && (
          <button
            type="button"
            onClick={() => setShowContre(true)}
            style={primaryBtnStyle(C.prussian)}
          >
            <Edit3 size={13} />
            Proposer une autre date
          </button>
        )}
        {proposition.peut_refuser && (
          <button
            type="button"
            onClick={() => setShowRefus(true)}
            disabled={refuser.isPending}
            style={{ ...ghostBtnStyle, color: C.red, borderColor: `${C.red}55` }}
          >
            {refuser.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <XCircle size={13} />
            )}
            Refuser
          </button>
        )}
      </div>

      {proposition.limite_atteinte && (
        <div style={{ ...bannerStyle(C.gold, C.goldBg), marginTop: 12 }}>
          <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>
            <strong>Limite de {MAX_PROPOSITIONS} propositions atteinte.</strong>{" "}
            Continuez la discussion par messagerie.
          </p>
        </div>
      )}

      {showContre && (
        <ContreProposerModal
          locataireId={locataireId}
          onClose={() => setShowContre(false)}
        />
      )}
      {showRefus && (
        <RefuserModal
          locataireId={locataireId}
          onClose={() => setShowRefus(false)}
        />
      )}
    </Card>
  );
}

// ── Modal Contre-proposer ────────────────────────────────────────────────────

function ContreProposerModal({
  locataireId,
  onClose,
}: {
  locataireId: string;
  onClose: () => void;
}) {
  const mutation = useContreProposerBailleur(locataireId);
  const [date, setDate] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setError(null);
    try {
      await mutation.mutateAsync({
        date_contre_proposee: date,
        commentaire: commentaire.trim() || null,
      });
      onClose();
    } catch (err) {
      const msg =
        (err as Error)?.message ??
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Échec de la contre-proposition";
      setError(msg);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Proposer une autre date">
      <form onSubmit={handleSubmit}>
        <Field label="Nouvelle date d'entrée *">
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <div style={{ marginTop: 12 }}>
          <Field label="Commentaire pour le locataire (optionnel)">
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Ex : Le bien sera libre à cette date, suite à un préavis en cours…"
              maxLength={500}
              rows={3}
              style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
            />
            <p style={{ fontSize: 11, color: C.text3, margin: "4px 0 0" }}>
              {commentaire.length}/500 caractères
            </p>
          </Field>
        </div>
        {error && (
          <div role="alert" style={errorBoxStyle}>
            {error}
          </div>
        )}
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={!date || mutation.isPending}
            style={primaryBtnStyle(C.prussian, !date || mutation.isPending)}
          >
            {mutation.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Send size={13} />
            )}
            Envoyer contre-proposition
          </button>
          <button type="button" onClick={onClose} style={ghostBtnStyle}>
            Annuler
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Modal Refuser ────────────────────────────────────────────────────────────

function RefuserModal({
  locataireId,
  onClose,
}: {
  locataireId: string;
  onClose: () => void;
}) {
  const mutation = useRefuserProposition(locataireId);
  const [motif, setMotif] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await mutation.mutateAsync({ motif_refus: motif.trim() || null });
      onClose();
    } catch (err) {
      const msg =
        (err as Error)?.message ??
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Échec du refus";
      setError(msg);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Refuser cette proposition">
      <form onSubmit={handleSubmit}>
        <p style={{ fontSize: 13, color: C.text2, margin: "0 0 12px", lineHeight: 1.5 }}>
          Le motif est optionnel mais visible par le locataire. Soyez factuel
          pour qu&apos;il puisse adapter sa nouvelle proposition (ou continuer
          par messagerie).
        </p>
        <Field label="Motif du refus (optionnel)">
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex : Bien déjà engagé sur cette période…"
            maxLength={500}
            rows={3}
            style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
          />
          <p style={{ fontSize: 11, color: C.text3, margin: "4px 0 0" }}>
            {motif.length}/500 caractères
          </p>
        </Field>
        {error && (
          <div role="alert" style={errorBoxStyle}>
            {error}
          </div>
        )}
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={mutation.isPending}
            style={primaryBtnStyle(C.red, mutation.isPending)}
          >
            {mutation.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <XCircle size={13} />
            )}
            Confirmer le refus
          </button>
          <button type="button" onClick={onClose} style={ghostBtnStyle}>
            Annuler
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Sous-blocs ────────────────────────────────────────────────────────────────

function Header() {
  return (
    <h3 style={titleStyle}>Proposition de location</h3>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={cardStyle}>{children}</div>;
}

function Recap({ proposition }: { proposition: PropositionStatusResponse }) {
  const p = proposition.preferences;
  const hasAny =
    proposition.duree_envisagee ||
    p.animaux ||
    p.flexibilite_date ||
    p.colocation != null ||
    p.meuble ||
    proposition.commentaire_locataire;
  if (!hasAny) return null;
  return (
    <div style={{ marginTop: 14, padding: 14, background: C.surface2, borderRadius: 10 }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.text2,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          margin: "0 0 8px",
        }}
      >
        Préférences exprimées par le locataire
      </p>
      <dl style={{ margin: 0, display: "grid", gap: 4 }}>
        {proposition.duree_envisagee && (
          <RecapRow label="Durée envisagée" value={DUREE_LABELS[proposition.duree_envisagee]} />
        )}
        {p.animaux && <RecapRow label="Animaux" value={ANIMAUX_LABELS[p.animaux]} />}
        {p.flexibilite_date && (
          <RecapRow label="Flexibilité date" value={FLEXIBILITE_LABELS[p.flexibilite_date]} />
        )}
        {p.colocation != null && (
          <RecapRow label="Colocation" value={p.colocation ? "Oui" : "Non"} />
        )}
        {p.meuble && <RecapRow label="Meublé / non meublé" value={MEUBLE_LABELS[p.meuble]} />}
        {proposition.commentaire_locataire && (
          <RecapRow label="Commentaire" value={proposition.commentaire_locataire} />
        )}
      </dl>
    </div>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 12, color: C.text3 }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, textAlign: "right", maxWidth: "70%" }}>
        {value}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 11,
          color: C.text3,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 5,
          fontWeight: 600,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function ModalShell({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 46, 76, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface,
          borderRadius: 14,
          padding: "24px 28px",
          boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
          maxWidth: 520,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-serif, Georgia, serif)",
            fontSize: 18,
            fontWeight: 500,
            color: C.text,
            margin: "0 0 16px",
          }}
        >
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: "20px 24px",
  boxShadow: C.shadow,
  marginBottom: 24,
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif, Georgia, serif)",
  fontSize: 16,
  fontWeight: 500,
  color: C.text,
  margin: "0 0 12px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 12px",
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  fontSize: 13,
  fontFamily: "inherit",
  background: C.surface,
  color: C.text,
  outline: "none",
};

const errorBoxStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "8px 12px",
  background: C.redBg,
  color: C.red,
  fontSize: 12,
  borderRadius: 8,
  lineHeight: 1.4,
};

const emptyStateStyle: React.CSSProperties = {
  padding: "16px 18px",
  background: C.surface2,
  border: `1px dashed ${C.border}`,
  borderRadius: 10,
};

function primaryBtnStyle(color: string, disabled = false): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 16px",
    borderRadius: 10,
    border: "none",
    background: disabled ? C.border : color,
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  };
}

const ghostBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 16px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text2,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

function bannerStyle(borderColor: string, bg: string): React.CSSProperties {
  return {
    padding: "12px 16px",
    borderRadius: 10,
    border: `1px solid ${borderColor}`,
    background: bg,
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  };
}
