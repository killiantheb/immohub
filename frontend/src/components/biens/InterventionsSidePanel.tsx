"use client";

/**
 * Side panel droit 50% — gestion des interventions d'un bien (PR-A11.A.5).
 *
 * Pattern hérité de CaracteristiquesModal (PR-A11.A.4) pour `attemptClose`,
 * adapté en side panel droit conformément à 3-ARCHITECTURE.md §3.12 :
 * pilotage de sous-entité liée (interventions) sans rupture de contexte du
 * bien (la fiche reste visible derrière, masquée par un backdrop semi-
 * transparent à gauche).
 *
 * Deux modes :
 *   - mode `list`   : liste filtrable (statut, urgence) + bouton « Signaler »
 *   - mode `detail` : détail / édition / création d'une intervention avec
 *                     champs métier + photos jointes (relation
 *                     `intervention_photos`)
 *
 * Lift state au niveau page :
 *   const [interventionsPanelOpen, setInterventionsPanelOpen] = useState(false);
 *   const [selectedInterventionId, setSelectedInterventionId] = useState(null);
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  interventionKeys,
  useCreateIntervention,
  useDeleteInterventionPhoto,
  useIntervention,
  useInterventionsByBien,
  useUpdateIntervention,
  useUploadInterventionPhoto,
} from "@/lib/hooks/useInterventions";
import type {
  Intervention,
  InterventionCategorie,
  InterventionStatut,
  InterventionUrgence,
} from "@/lib/types";
import { C } from "@/lib/design-tokens";

// ── Constantes UI ────────────────────────────────────────────────────────────

const STATUT_LABELS: Record<InterventionStatut, string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  planifie: "Planifié",
  resolu: "Terminée",
};

const STATUT_BADGE: Record<
  InterventionStatut,
  { color: string; bg: string }
> = {
  nouveau: { color: C.text2, bg: C.surface2 },
  en_cours: { color: C.gold, bg: C.goldBg },
  planifie: { color: C.blue, bg: C.blueBg },
  resolu: { color: C.green, bg: C.greenBg },
};

const URGENCE_LABELS: Record<InterventionUrgence, string> = {
  faible: "Faible",
  moderee: "Modérée",
  urgente: "Urgente",
  tres_urgente: "Très urgente",
};

const URGENCE_BADGE: Record<
  InterventionUrgence,
  { color: string; bg: string }
> = {
  faible: { color: C.text2, bg: C.surface2 },
  moderee: { color: C.blue, bg: C.blueBg },
  urgente: { color: C.amber, bg: C.amberBg },
  tres_urgente: { color: C.red, bg: C.redBg },
};

const CATEGORIE_LABELS: Record<InterventionCategorie, string> = {
  plomberie: "Plomberie",
  electricite: "Électricité",
  menuiserie: "Menuiserie",
  peinture: "Peinture",
  serrurerie: "Serrurerie",
  chauffage: "Chauffage",
  autre: "Autre",
};

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 10 * 1024 * 1024;

interface Props {
  bienId: string;
  open: boolean;
  onClose: () => void;
  /** ID de l'intervention à afficher en détail à l'ouverture, ou null pour la liste. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Si true, ouvre directement le mode création. */
  initialCreate?: boolean;
}

type Mode = "list" | "detail";

export function InterventionsSidePanel({
  bienId,
  open,
  onClose,
  selectedId,
  onSelect,
  initialCreate = false,
}: Props) {
  const [mode, setMode] = useState<Mode>("list");
  const [creating, setCreating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [hasUploadInFlight, setHasUploadInFlight] = useState(false);

  // Sync mode quand le parent change selectedId / initialCreate.
  useEffect(() => {
    if (!open) return;
    if (initialCreate) {
      setMode("detail");
      setCreating(true);
    } else if (selectedId) {
      setMode("detail");
      setCreating(false);
    } else {
      setMode("list");
      setCreating(false);
    }
    setDirty(false);
  }, [open, selectedId, initialCreate]);

  const attemptClose = useCallback(() => {
    if (dirty) {
      const ok = window.confirm("Annuler les modifications en cours ?");
      if (!ok) return;
    }
    if (hasUploadInFlight) {
      const ok = window.confirm(
        "Un upload est en cours. Fermer maintenant ne l'annulera pas. Continuer ?",
      );
      if (!ok) return;
    }
    setDirty(false);
    setHasUploadInFlight(false);
    onClose();
  }, [dirty, hasUploadInFlight, onClose]);

  // ESC + scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, attemptClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Gestion des interventions"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={backdropStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) attemptClose();
          }}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.24, ease: "easeOut" }}
            style={shellStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {mode === "list" ? (
              <ListView
                bienId={bienId}
                onClose={attemptClose}
                onSelect={(id) => {
                  onSelect(id);
                  setCreating(false);
                  setMode("detail");
                }}
                onCreate={() => {
                  onSelect(null);
                  setCreating(true);
                  setMode("detail");
                }}
              />
            ) : (
              <DetailView
                bienId={bienId}
                interventionId={creating ? null : selectedId}
                creating={creating}
                onClose={attemptClose}
                onBack={() => {
                  setCreating(false);
                  onSelect(null);
                  setMode("list");
                  setDirty(false);
                }}
                onDirtyChange={setDirty}
                onUploadFlightChange={setHasUploadInFlight}
                onCreated={(id) => {
                  setCreating(false);
                  onSelect(id);
                  setDirty(false);
                }}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Mode liste ──────────────────────────────────────────────────────────────

function ListView({
  bienId,
  onClose,
  onSelect,
  onCreate,
}: {
  bienId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const [statutFilter, setStatutFilter] = useState<"all" | "open" | "closed">(
    "all",
  );
  const [urgenceFilter, setUrgenceFilter] = useState<InterventionUrgence | "">(
    "",
  );

  const filters = useMemo(() => {
    const f: { statut?: InterventionStatut; urgence?: InterventionUrgence } = {};
    if (urgenceFilter) f.urgence = urgenceFilter;
    return f;
  }, [urgenceFilter]);

  const { data, isLoading } = useInterventionsByBien(bienId, filters);

  const interventions = useMemo(() => {
    if (!data) return [];
    if (statutFilter === "open") {
      return data.filter((i) => i.statut !== "resolu");
    }
    if (statutFilter === "closed") {
      return data.filter((i) => i.statut === "resolu");
    }
    return data;
  }, [data, statutFilter]);

  return (
    <>
      <PanelHeader
        title="Interventions"
        subtitle={
          isLoading
            ? "Chargement…"
            : `${interventions.length} intervention${interventions.length > 1 ? "s" : ""}${urgenceFilter || statutFilter !== "all" ? " (filtrées)" : ""}`
        }
        onClose={onClose}
        rightAction={
          <button type="button" onClick={onCreate} style={btnPrimaryStyle}>
            <Plus size={14} /> Signaler
          </button>
        }
      />

      <div style={bodyStyle}>
        {/* Filtres */}
        <div style={filtersRowStyle}>
          <select
            value={statutFilter}
            onChange={(e) =>
              setStatutFilter(e.target.value as "all" | "open" | "closed")
            }
            style={selectStyle}
            aria-label="Filtre statut"
          >
            <option value="all">Toutes</option>
            <option value="open">En cours</option>
            <option value="closed">Clôturées</option>
          </select>
          <select
            value={urgenceFilter}
            onChange={(e) =>
              setUrgenceFilter(e.target.value as InterventionUrgence | "")
            }
            style={selectStyle}
            aria-label="Filtre urgence"
          >
            <option value="">Toute urgence</option>
            <option value="faible">Faible</option>
            <option value="moderee">Modérée</option>
            <option value="urgente">Urgente</option>
            <option value="tres_urgente">Très urgente</option>
          </select>
        </div>

        {/* Liste */}
        {isLoading ? (
          <p style={loadingStyle}>Chargement…</p>
        ) : interventions.length === 0 ? (
          <EmptyState onCreate={onCreate} />
        ) : (
          <ul style={listStyle}>
            {interventions.map((inter) => (
              <li key={inter.id}>
                <button
                  type="button"
                  onClick={() => onSelect(inter.id)}
                  style={interventionRowStyle}
                >
                  <Wrench
                    size={16}
                    style={{ color: C.prussian, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={interventionTitleStyle}>{inter.titre}</p>
                    <div style={badgesRowStyle}>
                      <Badge
                        label={URGENCE_LABELS[inter.urgence]}
                        color={URGENCE_BADGE[inter.urgence].color}
                        bg={URGENCE_BADGE[inter.urgence].bg}
                      />
                      <Badge
                        label={STATUT_LABELS[inter.statut]}
                        color={STATUT_BADGE[inter.statut].color}
                        bg={STATUT_BADGE[inter.statut].bg}
                      />
                      <span style={metaStyle}>
                        {fmtRelativeDate(inter.created_at)}
                      </span>
                      {inter.cout != null && inter.statut === "resolu" && (
                        <span style={metaStyle}>
                          {fmtCHF(inter.cout)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    size={18}
                    style={{ color: C.text3, flexShrink: 0 }}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={emptyStateStyle}>
      <div style={emptyIconStyle}>
        <Wrench size={28} style={{ color: C.prussian, opacity: 0.55 }} />
      </div>
      <p style={emptyTitleStyle}>Aucune intervention pour ce bien</p>
      <p style={emptySubStyle}>
        Cliquez sur « Signaler » pour créer une intervention.
      </p>
      <button
        type="button"
        onClick={onCreate}
        style={{ ...btnPrimaryStyle, marginTop: 16 }}
      >
        <Plus size={14} /> Signaler une intervention
      </button>
    </div>
  );
}

// ── Mode détail / édition / création ─────────────────────────────────────────

interface FormValues {
  titre: string;
  description: string;
  categorie: InterventionCategorie;
  urgence: InterventionUrgence;
  statut: InterventionStatut;
  cout: string;
  note_cloture: string;
}

const EMPTY_FORM: FormValues = {
  titre: "",
  description: "",
  categorie: "autre",
  urgence: "moderee",
  statut: "nouveau",
  cout: "",
  note_cloture: "",
};

function interventionToForm(inter: Intervention): FormValues {
  return {
    titre: inter.titre,
    description: inter.description ?? "",
    categorie: inter.categorie,
    urgence: inter.urgence,
    statut: inter.statut,
    cout: inter.cout != null ? String(inter.cout) : "",
    note_cloture: inter.note_cloture ?? "",
  };
}

function DetailView({
  bienId,
  interventionId,
  creating,
  onClose,
  onBack,
  onDirtyChange,
  onUploadFlightChange,
  onCreated,
}: {
  bienId: string;
  interventionId: string | null;
  creating: boolean;
  onClose: () => void;
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onUploadFlightChange: (uploading: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { data: intervention, isLoading } = useIntervention(
    creating ? null : interventionId,
  );
  const create = useCreateIntervention(bienId);
  const update = useUpdateIntervention(interventionId ?? "", bienId);

  const initial = useMemo<FormValues>(
    () => (intervention ? interventionToForm(intervention) : EMPTY_FORM),
    [intervention],
  );
  const [form, setForm] = useState<FormValues>(initial);
  const [serverError, setServerError] = useState<string | null>(null);

  // Resync form quand l'intervention change.
  useEffect(() => {
    setForm(initial);
    setServerError(null);
  }, [initial]);

  // Suivi dirty (création OU modif sur édition).
  const isDirty = useMemo(() => {
    if (creating) {
      return form.titre.trim().length > 0 || form.description.trim().length > 0;
    }
    return JSON.stringify(form) !== JSON.stringify(initial);
  }, [creating, form, initial]);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async () => {
    setServerError(null);
    if (form.titre.trim().length < 3) {
      setServerError("Le titre doit comporter au moins 3 caractères.");
      return;
    }
    try {
      if (creating) {
        const created = await create.mutateAsync({
          bien_id: bienId,
          titre: form.titre.trim(),
          description: form.description.trim() || null,
          categorie: form.categorie,
          urgence: form.urgence,
          statut: form.statut,
        });
        onCreated(created.id);
      } else if (interventionId) {
        const payload: Record<string, unknown> = {};
        if (form.titre !== initial.titre) payload.titre = form.titre.trim();
        if (form.description !== initial.description) {
          payload.description = form.description.trim() || null;
        }
        if (form.categorie !== initial.categorie) payload.categorie = form.categorie;
        if (form.urgence !== initial.urgence) payload.urgence = form.urgence;
        if (form.statut !== initial.statut) payload.statut = form.statut;
        if (form.cout !== initial.cout) {
          payload.cout = form.cout.trim() === "" ? null : Number(form.cout);
        }
        if (form.note_cloture !== initial.note_cloture) {
          payload.note_cloture = form.note_cloture.trim() || null;
        }
        if (Object.keys(payload).length > 0) {
          await update.mutateAsync(payload);
        }
        onDirtyChange(false);
      }
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail;
      setServerError(detail ?? "Erreur lors de l'enregistrement. Réessayez.");
    }
  };

  const isClosed = form.statut === "resolu";
  const pending = create.isPending || update.isPending;

  return (
    <>
      <PanelHeader
        title={
          creating
            ? "Nouvelle intervention"
            : intervention
              ? intervention.titre
              : "Chargement…"
        }
        subtitle={
          creating
            ? "Décrivez le problème pour un suivi traçable"
            : intervention
              ? `Créée ${fmtRelativeDate(intervention.created_at)}`
              : ""
        }
        onClose={onClose}
        leftAction={
          <button
            type="button"
            onClick={onBack}
            style={btnGhostStyle}
            aria-label="Retour à la liste"
          >
            <ArrowLeft size={16} />
            Liste
          </button>
        }
      />

      <div style={bodyStyle}>
        {!creating && isLoading && !intervention ? (
          <p style={loadingStyle}>Chargement…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {serverError && (
              <div role="alert" style={alertStyle}>
                <AlertCircle size={16} />
                {serverError}
              </div>
            )}

            <Field label="Titre*">
              <input
                type="text"
                value={form.titre}
                onChange={(e) => set("titre", e.target.value)}
                placeholder="Ex : fuite robinet salle de bain"
                style={inputStyle}
                maxLength={300}
              />
            </Field>

            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={4}
                placeholder="Détails du problème, accès, créneaux préférés…"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
              <Field label="Urgence">
                <select
                  value={form.urgence}
                  onChange={(e) =>
                    set("urgence", e.target.value as InterventionUrgence)
                  }
                  style={inputStyle}
                >
                  {(Object.keys(URGENCE_LABELS) as InterventionUrgence[]).map(
                    (u) => (
                      <option key={u} value={u}>
                        {URGENCE_LABELS[u]}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <Field label="Catégorie">
                <select
                  value={form.categorie}
                  onChange={(e) =>
                    set("categorie", e.target.value as InterventionCategorie)
                  }
                  style={inputStyle}
                >
                  {(Object.keys(CATEGORIE_LABELS) as InterventionCategorie[]).map(
                    (c) => (
                      <option key={c} value={c}>
                        {CATEGORIE_LABELS[c]}
                      </option>
                    ),
                  )}
                </select>
              </Field>
            </div>

            {!creating && (
              <Field label="Statut">
                <select
                  value={form.statut}
                  onChange={(e) =>
                    set("statut", e.target.value as InterventionStatut)
                  }
                  style={inputStyle}
                >
                  {(Object.keys(STATUT_LABELS) as InterventionStatut[]).map(
                    (s) => (
                      <option key={s} value={s}>
                        {STATUT_LABELS[s]}
                      </option>
                    ),
                  )}
                </select>
              </Field>
            )}

            {!creating && isClosed && (
              <>
                <Field label="Coût final (CHF)">
                  <input
                    type="number"
                    step={1}
                    min={0}
                    value={form.cout}
                    onChange={(e) => set("cout", e.target.value)}
                    placeholder="0"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Note de clôture">
                  <textarea
                    value={form.note_cloture}
                    onChange={(e) => set("note_cloture", e.target.value)}
                    rows={3}
                    placeholder="Comment la situation a été résolue, suite à donner…"
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </Field>
              </>
            )}

            {/* Photos — uniquement quand l'intervention existe (pas en création) */}
            {!creating && intervention && (
              <PhotosSection
                interventionId={intervention.id}
                photos={intervention.images ?? []}
                onUploadFlightChange={onUploadFlightChange}
              />
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div style={footerStyle}>
        {!creating && form.statut !== "resolu" && (
          <button
            type="button"
            onClick={() => set("statut", "resolu")}
            style={btnSecondaryStyle}
          >
            <CheckCircle2 size={14} />
            Marquer terminée
          </button>
        )}
        <button type="button" onClick={onBack} style={btnGhostStyle}>
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !isDirty}
          style={{
            ...btnPrimaryStyle,
            opacity: pending || !isDirty ? 0.5 : 1,
            cursor: pending || !isDirty ? "not-allowed" : "pointer",
          }}
        >
          {pending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : null}
          {creating ? "Créer" : "Enregistrer"}
        </button>
      </div>
    </>
  );
}

// ── Section photos ──────────────────────────────────────────────────────────

function PhotosSection({
  interventionId,
  photos,
  onUploadFlightChange,
}: {
  interventionId: string;
  photos: { id: string; url: string }[];
  onUploadFlightChange: (uploading: boolean) => void;
}) {
  const upload = useUploadInterventionPhoto(interventionId);
  const remove = useDeleteInterventionPhoto(interventionId);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inFlightRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateFlight = (delta: number) => {
    inFlightRef.current = Math.max(0, inFlightRef.current + delta);
    onUploadFlightChange(inFlightRef.current > 0);
  };

  const handleFiles = (files: FileList | File[]) => {
    setUploadError(null);
    for (const file of Array.from(files)) {
      if (!ALLOWED_MIME.has(file.type)) {
        setUploadError("Format non supporté (JPG, PNG, WebP, GIF).");
        continue;
      }
      if (file.size > MAX_BYTES) {
        setUploadError("Fichier trop volumineux (max 10 MB).");
        continue;
      }
      updateFlight(+1);
      upload
        .mutateAsync(file)
        .catch((err: unknown) => {
          const detail =
            (err as { response?: { data?: { detail?: string } } })?.response
              ?.data?.detail;
          setUploadError(detail ?? "Échec de l'upload.");
        })
        .finally(() => updateFlight(-1));
    }
  };

  const handleDelete = (photoId: string) => {
    if (!window.confirm("Supprimer cette photo ?")) return;
    remove.mutate(photoId);
  };

  return (
    <Field label={`Photos (${photos.length})`}>
      <div style={photosGridStyle}>
        {photos.map((p) => (
          <div key={p.id} style={photoTileStyle}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" style={photoImgStyle} />
            <button
              type="button"
              onClick={() => handleDelete(p.id)}
              aria-label="Supprimer cette photo"
              title="Supprimer"
              style={photoDeleteBtnStyle}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={photoAddBtnStyle}
          aria-label="Ajouter une photo"
        >
          {upload.isPending || inFlightRef.current > 0 ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              <Upload size={18} />
              <span style={{ fontSize: 11, marginTop: 4 }}>Ajouter</span>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {uploadError && (
        <p style={{ fontSize: 12, color: C.red, margin: "6px 0 0" }}>
          {uploadError}
        </p>
      )}
    </Field>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PanelHeader({
  title,
  subtitle,
  onClose,
  leftAction,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
}) {
  return (
    <div style={headerStyle}>
      <div style={{ minWidth: 0, flex: 1 }}>
        {leftAction && <div style={{ marginBottom: 6 }}>{leftAction}</div>}
        <h2 style={titleStyle}>{title}</h2>
        {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {rightAction}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          style={closeBtnStyle}
        >
          <X size={22} />
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
    </div>
  );
}

function Badge({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        color,
        background: bg,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtRelativeDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diff < day) return "aujourd'hui";
  if (diff < 2 * day) return "hier";
  const days = Math.floor(diff / day);
  if (days < 30) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  return `il y a ${Math.floor(months / 12)} an${months >= 24 ? "s" : ""}`;
}

function fmtCHF(n: number): string {
  return `CHF ${Number(n).toLocaleString("fr-CH")}`;
}

// Garde une référence à `interventionKeys` pour éviter le purge de l'import
// par les linters strict mode (utilisé via les hooks au runtime).
void interventionKeys;

// ── Styles ──────────────────────────────────────────────────────────────────

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  zIndex: 100,
  display: "flex",
  justifyContent: "flex-end",
};

const shellStyle: React.CSSProperties = {
  background: "#fff",
  width: "50%",
  minWidth: 480,
  maxWidth: 720,
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.12)",
};

const headerStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: "16px 24px",
  borderBottom: "1px solid var(--border-subtle)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  background: "#fff",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 20,
  color: C.prussian,
  margin: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.text3,
  margin: "4px 0 0",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: C.text3,
  padding: 4,
  lineHeight: 0,
  flexShrink: 0,
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "20px 24px",
};

const filtersRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginBottom: 16,
};

const selectStyle: React.CSSProperties = {
  flex: 1,
  background: "#fff",
  border: `1px solid ${C.border}`,
  borderRadius: 9,
  padding: "8px 10px",
  fontSize: 13,
  color: C.text,
  fontFamily: "inherit",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
  border: `1px solid ${C.border}`,
  borderRadius: 9,
  padding: "9px 12px",
  fontSize: 14,
  color: C.text,
  fontFamily: "inherit",
  outline: "none",
};

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  color: C.text3,
  marginBottom: 6,
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const interventionRowStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  background: "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
};

const interventionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: C.text,
  margin: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const badgesRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 6,
};

const metaStyle: React.CSSProperties = {
  fontSize: 11,
  color: C.text3,
};

const loadingStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.text3,
  textAlign: "center",
  padding: 32,
  margin: 0,
};

const emptyStateStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "48px 24px",
};

const emptyIconStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  background: C.prussianBg,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 14,
};

const emptyTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: C.text,
  margin: "0 0 4px",
};

const emptySubStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.text3,
  margin: 0,
  maxWidth: 320,
};

const footerStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: "12px 24px",
  borderTop: "1px solid var(--border-subtle)",
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 8,
  background: "#fff",
};

const btnPrimaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 16px",
  borderRadius: 10,
  border: "none",
  background: C.prussian,
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnSecondaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 14px",
  borderRadius: 10,
  border: `1px solid ${C.green}`,
  background: C.greenBg,
  color: C.green,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  marginRight: "auto",
};

const btnGhostStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 9,
  border: `1px solid ${C.border}`,
  background: "transparent",
  color: C.text2,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};

const alertStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 10,
  background: C.redBg,
  color: C.red,
  fontSize: 13,
  border: `1px solid ${C.red}55`,
};

const photosGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 10,
};

const photoTileStyle: React.CSSProperties = {
  position: "relative",
  aspectRatio: "1 / 1",
  borderRadius: 10,
  overflow: "hidden",
  background: C.surface2,
  border: `1px solid ${C.border}`,
};

const photoImgStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const photoDeleteBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 6,
  right: 6,
  background: "rgba(15, 23, 42, 0.7)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: 6,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "inherit",
};

const photoAddBtnStyle: React.CSSProperties = {
  aspectRatio: "1 / 1",
  borderRadius: 10,
  border: `2px dashed ${C.border2}`,
  background: C.surface2,
  color: C.prussian,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  cursor: "pointer",
  fontFamily: "inherit",
};
