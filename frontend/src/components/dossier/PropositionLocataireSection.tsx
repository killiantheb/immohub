"use client";

/**
 * PropositionLocataireSection — étape 0 du dossier locataire (Sprint 4B Option C).
 *
 * Affiche le formulaire de proposition de dates + préférences OU le state
 * actuel du workflow (banner contextuel + CTA) selon `statut_proposition`.
 *
 * États gérés :
 *   - non_propose                  → formulaire complet (date + durée + préférences + commentaire)
 *   - propose_par_locataire        → banner Prussien "envoyée, en attente bailleur"
 *   - contre_propose_par_bailleur  → banner Or + 3 CTA (accepter / re-contre-proposer / refuser)
 *   - accepte                      → banner Vert "accord conclu"
 *   - refuse                       → banner Rouge + motif + bouton "Nouvelle proposition"
 *
 * Si `limite_atteinte` (>= 4 propositions cumulées) ET statut actif → banner
 * Or "Continuez par messagerie".
 *
 * Doctrine :
 *   - §B.4 palette stricte : Prussian (envoyée), Or (contre-prop / limite),
 *     Vert (accord), Rouge subtil (refus). Aucun orange.
 *   - §B.10 statuts honnêtes : pas d'affichage "envoyée" si pas envoyée. Les
 *     dates affichées viennent directement de la DB (PropositionStatusResponse).
 *   - §B.15 Phase 1.0 : pas de notif Resend obligatoire, pas d'IA.
 */

import { useState } from "react";
import {
  CheckCircle2,
  Edit3,
  Loader2,
  MailCheck,
  MessageCircle,
  PartyPopper,
  Send,
  XCircle,
} from "lucide-react";

import {
  ANIMAUX_LABELS,
  type AnimauxPreference,
  DUREE_LABELS,
  type DureeEnvisagee,
  FLEXIBILITE_LABELS,
  type FlexibiliteDate,
  MAX_PROPOSITIONS,
  MEUBLE_LABELS,
  type MeublePreference,
  type PropositionStatusResponse,
} from "@/lib/api/proposition";
import {
  useAccepterLocataire,
  useProposerDates,
  useReContreProposerLocataire,
  useRefuserProposition,
  useResetProposition,
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

export function PropositionLocataireSection({ locataireId, proposition }: Props) {
  const statut = proposition.statut_proposition;
  const limite = proposition.limite_atteinte;

  // Rendering par état
  if (statut === "non_propose") {
    return (
      <FormProposer
        locataireId={locataireId}
        initial={{
          date_entree_souhaitee: proposition.date_entree_souhaitee,
          duree_envisagee: proposition.duree_envisagee,
          preferences: proposition.preferences,
          commentaire: proposition.commentaire_locataire,
        }}
      />
    );
  }

  if (statut === "propose_par_locataire") {
    return (
      <ProposeBanner
        locataireId={locataireId}
        proposition={proposition}
        limiteAtteinte={limite}
      />
    );
  }

  if (statut === "contre_propose_par_bailleur") {
    return (
      <ContrePropositionBanner
        locataireId={locataireId}
        proposition={proposition}
      />
    );
  }

  if (statut === "accepte") {
    return <AccordBanner proposition={proposition} />;
  }

  if (statut === "refuse") {
    return <RefusBanner locataireId={locataireId} proposition={proposition} />;
  }

  return null;
}

// ── État non_propose : formulaire complet ────────────────────────────────────

function FormProposer({
  locataireId,
  initial,
}: {
  locataireId: string;
  initial: {
    date_entree_souhaitee: string | null;
    duree_envisagee: DureeEnvisagee | null;
    preferences: PropositionStatusResponse["preferences"];
    commentaire: string | null;
  };
}) {
  const mutation = useProposerDates(locataireId);
  const [date, setDate] = useState(initial.date_entree_souhaitee ?? "");
  const [duree, setDuree] = useState<DureeEnvisagee | "">(
    initial.duree_envisagee ?? "",
  );
  const [animaux, setAnimaux] = useState<AnimauxPreference | "">(
    initial.preferences.animaux ?? "",
  );
  const [flex, setFlex] = useState<FlexibiliteDate | "">(
    initial.preferences.flexibilite_date ?? "",
  );
  const [colocation, setColocation] = useState<"oui" | "non" | "">(
    initial.preferences.colocation === true
      ? "oui"
      : initial.preferences.colocation === false
        ? "non"
        : "",
  );
  const [meuble, setMeuble] = useState<MeublePreference | "">(
    initial.preferences.meuble ?? "",
  );
  const [commentaire, setCommentaire] = useState(initial.commentaire ?? "");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Boolean(date) && !mutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await mutation.mutateAsync({
        date_entree_souhaitee: date,
        duree_envisagee: duree || null,
        preferences: {
          animaux: animaux || null,
          flexibilite_date: flex || null,
          colocation: colocation === "" ? null : colocation === "oui",
          meuble: meuble || null,
        },
        commentaire: commentaire.trim() || null,
      });
    } catch (err) {
      const msg =
        (err as Error)?.message ??
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Échec de l'envoi de la proposition";
      setError(msg);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <h3 style={titleStyle}>Vos préférences de location</h3>
      <p style={subtitleStyle}>
        Aidez votre bailleur à valider les modalités de votre entrée dans le
        logement. La date est obligatoire ; les préférences ci-dessous sont
        optionnelles mais recommandées.
      </p>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
        <Field label="Quand souhaitez-vous emménager ? *">
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Combien de temps pensez-vous rester ?">
          <select
            value={duree}
            onChange={(e) => setDuree(e.target.value as DureeEnvisagee | "")}
            style={inputStyle}
          >
            <option value="">Choisir…</option>
            {Object.entries(DUREE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Vous avez un animal ?">
          <select
            value={animaux}
            onChange={(e) => setAnimaux(e.target.value as AnimauxPreference | "")}
            style={inputStyle}
          >
            <option value="">Choisir…</option>
            {Object.entries(ANIMAUX_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Flexibilité sur la date d'entrée">
          <select
            value={flex}
            onChange={(e) => setFlex(e.target.value as FlexibiliteDate | "")}
            style={inputStyle}
          >
            <option value="">Choisir…</option>
            {Object.entries(FLEXIBILITE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Colocation envisagée ?">
          <select
            value={colocation}
            onChange={(e) => setColocation(e.target.value as "oui" | "non" | "")}
            style={inputStyle}
          >
            <option value="">Choisir…</option>
            <option value="oui">Oui</option>
            <option value="non">Non</option>
          </select>
        </Field>
        <Field label="Préférence meublé / non meublé">
          <select
            value={meuble}
            onChange={(e) => setMeuble(e.target.value as MeublePreference | "")}
            style={inputStyle}
          >
            <option value="">Choisir…</option>
            {Object.entries(MEUBLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div style={{ marginTop: 14 }}>
        <Field label="Y a-t-il des informations à transmettre à votre bailleur ?">
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Ex : Je travaille à distance, je souhaiterais visiter le mardi..."
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

      <button type="submit" disabled={!canSubmit} style={submitBtnStyle(canSubmit)}>
        {mutation.isPending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Send size={14} />
        )}
        Proposer ces dates
      </button>
    </form>
  );
}

// ── État propose_par_locataire : banner attente bailleur ─────────────────────

function ProposeBanner({
  locataireId,
  proposition,
  limiteAtteinte,
}: {
  locataireId: string;
  proposition: PropositionStatusResponse;
  limiteAtteinte: boolean;
}) {
  const refuser = useRefuserProposition(locataireId);

  return (
    <div style={cardStyle}>
      <h3 style={titleStyle}>Proposition envoyée</h3>
      <div style={bannerStyle(C.prussian, C.prussianBg)}>
        <MailCheck size={20} style={{ color: C.prussian, flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.prussian, margin: "0 0 4px" }}>
            En attente de la réponse de votre bailleur
          </p>
          <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>
            Vous avez proposé le <strong>{fmtDateFr(proposition.date_entree_souhaitee)}</strong>
            {proposition.last_proposed_at && (
              <> · envoyé le {fmtDateFr(proposition.last_proposed_at)}</>
            )}
            . Tour {proposition.proposition_count}/{MAX_PROPOSITIONS}.
          </p>
        </div>
      </div>

      <ProposeRecap proposition={proposition} />

      {limiteAtteinte && <LimiteAtteinteBanner />}

      {/* Le locataire peut annuler/refuser sa propre proposition pour relancer
          un cycle (= passe en 'refuse' puis 'reset' immédiat possible). */}
      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Annuler votre proposition ?")) {
              void refuser.mutateAsync({ motif_refus: null });
            }
          }}
          disabled={refuser.isPending}
          style={{ ...ghostBtnStyle, color: C.text2, borderColor: C.border }}
        >
          {refuser.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <XCircle size={13} />
          )}
          Annuler ma proposition
        </button>
      </div>
    </div>
  );
}

// ── État contre_propose_par_bailleur : 3 CTA locataire ───────────────────────

function ContrePropositionBanner({
  locataireId,
  proposition,
}: {
  locataireId: string;
  proposition: PropositionStatusResponse;
}) {
  const accepter = useAccepterLocataire(locataireId);
  const refuser = useRefuserProposition(locataireId);
  const [showReContre, setShowReContre] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newComment, setNewComment] = useState("");
  const reContre = useReContreProposerLocataire(locataireId);

  const canReContre = proposition.peut_re_contre_proposer && !proposition.limite_atteinte;

  return (
    <div style={cardStyle}>
      <h3 style={titleStyle}>Réponse de votre bailleur</h3>
      <div style={bannerStyle(C.gold, C.goldBg)}>
        <Edit3 size={20} style={{ color: C.gold, flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: "0 0 4px" }}>
            Votre bailleur propose le {fmtDateFr(proposition.date_contre_proposee_bailleur)}
          </p>
          {proposition.commentaire_bailleur && (
            <p
              style={{
                fontSize: 13,
                color: C.text2,
                margin: "6px 0 0",
                lineHeight: 1.5,
                fontStyle: "italic",
              }}
            >
              « {proposition.commentaire_bailleur} »
            </p>
          )}
          <p style={{ fontSize: 12, color: C.text3, margin: "6px 0 0" }}>
            Tour {proposition.proposition_count}/{MAX_PROPOSITIONS}
            {proposition.limite_atteinte && " · limite atteinte"}
          </p>
        </div>
      </div>

      <ProposeRecap proposition={proposition} title="Pour rappel, votre proposition initiale" />

      {proposition.limite_atteinte && <LimiteAtteinteBanner />}

      {!showReContre && (
        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {proposition.peut_accepter_locataire && (
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
          {canReContre && (
            <button
              type="button"
              onClick={() => setShowReContre(true)}
              style={primaryBtnStyle(C.prussian)}
            >
              <Edit3 size={13} />
              Proposer une autre date
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Refuser et discuter par messagerie ?")) {
                void refuser.mutateAsync({ motif_refus: null });
              }
            }}
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
        </div>
      )}

      {showReContre && (
        <div style={{ marginTop: 14, padding: 14, background: C.surface2, borderRadius: 10 }}>
          <Field label="Votre nouvelle proposition de date *">
            <input
              type="date"
              required
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <div style={{ marginTop: 10 }}>
            <Field label="Commentaire (optionnel)">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                maxLength={500}
                rows={2}
                style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
              />
            </Field>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={!newDate || reContre.isPending}
              onClick={() =>
                void reContre.mutateAsync({
                  date_entree_souhaitee: newDate,
                  commentaire: newComment.trim() || null,
                })
              }
              style={primaryBtnStyle(C.prussian, !newDate || reContre.isPending)}
            >
              {reContre.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
              Envoyer ma nouvelle proposition
            </button>
            <button
              type="button"
              onClick={() => setShowReContre(false)}
              style={{ ...ghostBtnStyle, color: C.text2 }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── État accepte : accord conclu ─────────────────────────────────────────────

function AccordBanner({ proposition }: { proposition: PropositionStatusResponse }) {
  return (
    <div style={cardStyle}>
      <h3 style={titleStyle}>Accord conclu</h3>
      <div style={bannerStyle(C.green, C.greenBg)}>
        <PartyPopper size={20} style={{ color: C.green, flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.green, margin: "0 0 4px" }}>
            Date convenue : {fmtDateFr(proposition.date_accord)}
          </p>
          <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>
            Vous et votre bailleur êtes d&apos;accord sur cette date d&apos;entrée.
            Elle sera officiellement enregistrée à la finalisation de votre dossier
            (100% complété).
          </p>
        </div>
      </div>
      <ProposeRecap proposition={proposition} />
    </div>
  );
}

// ── État refuse : motif + nouveau cycle possible ─────────────────────────────

function RefusBanner({
  locataireId,
  proposition,
}: {
  locataireId: string;
  proposition: PropositionStatusResponse;
}) {
  const reset = useResetProposition(locataireId);
  return (
    <div style={cardStyle}>
      <h3 style={titleStyle}>Proposition refusée</h3>
      <div style={bannerStyle(C.red, C.redBg)}>
        <XCircle size={20} style={{ color: C.red, flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.red, margin: "0 0 4px" }}>
            La proposition n&apos;a pas abouti
            {proposition.last_proposed_at && (
              <> · {fmtDateFr(proposition.last_proposed_at)}</>
            )}
          </p>
          {proposition.motif_refus ? (
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
          ) : (
            <p style={{ fontSize: 13, color: C.text2, margin: "6px 0 0", lineHeight: 1.5 }}>
              Aucun motif n&apos;a été précisé.
            </p>
          )}
        </div>
      </div>
      {proposition.peut_reset && (
        <button
          type="button"
          onClick={() => void reset.mutateAsync()}
          disabled={reset.isPending}
          style={{ ...primaryBtnStyle(C.prussian), marginTop: 14 }}
        >
          {reset.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Edit3 size={13} />
          )}
          Nouvelle proposition
        </button>
      )}
    </div>
  );
}

// ── Sous-blocs ────────────────────────────────────────────────────────────────

function ProposeRecap({
  proposition,
  title = "Vos préférences saisies",
}: {
  proposition: PropositionStatusResponse;
  title?: string;
}) {
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
    <div style={{ marginTop: 14, padding: 12, background: C.surface2, borderRadius: 10 }}>
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
        {title}
      </p>
      <dl style={{ margin: 0, display: "grid", gap: 4 }}>
        {proposition.duree_envisagee && (
          <RecapRow label="Durée" value={DUREE_LABELS[proposition.duree_envisagee]} />
        )}
        {p.animaux && <RecapRow label="Animaux" value={ANIMAUX_LABELS[p.animaux]} />}
        {p.flexibilite_date && (
          <RecapRow label="Flexibilité" value={FLEXIBILITE_LABELS[p.flexibilite_date]} />
        )}
        {p.colocation != null && (
          <RecapRow label="Colocation" value={p.colocation ? "Oui" : "Non"} />
        )}
        {p.meuble && <RecapRow label="Meublé" value={MEUBLE_LABELS[p.meuble]} />}
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

function LimiteAtteinteBanner() {
  return (
    <div style={{ ...bannerStyle(C.gold, C.goldBg), marginTop: 12 }}>
      <MessageCircle size={18} style={{ color: C.gold, flexShrink: 0, marginTop: 2 }} />
      <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>
        <strong>Limite de {MAX_PROPOSITIONS} propositions atteinte.</strong>{" "}
        Continuez la discussion par messagerie pour trouver une date qui convient.
      </p>
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

// ── Styles ────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: "20px 24px",
  boxShadow: C.shadow,
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif, Georgia, serif)",
  fontSize: 16,
  fontWeight: 500,
  color: C.text,
  margin: "0 0 8px",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.text2,
  margin: 0,
  lineHeight: 1.5,
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

function submitBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 18px",
    borderRadius: 10,
    border: "none",
    background: enabled ? C.prussian : C.border,
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: enabled ? "pointer" : "not-allowed",
    fontFamily: "inherit",
    marginTop: 16,
  };
}

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
    marginTop: 12,
    padding: "12px 16px",
    borderRadius: 10,
    border: `1px solid ${borderColor}`,
    background: bg,
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  };
}
