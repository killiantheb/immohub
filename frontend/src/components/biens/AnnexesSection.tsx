"use client";

/**
 * Section Annexes inline (PR-A11.A.6.c).
 *
 * Affichée en bas du tab "Surface & Annexes" de la modale Caractéristiques.
 * Pattern : cards mini + form inline (slide-in framer-motion) avec save
 * explicite par sous-entité (pas auto-save, sub-form cohérent).
 */

import { motion, AnimatePresence } from "framer-motion";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  type BienAnnexe,
  type BienAnnexeCreate,
  useBienAnnexes,
  useCreateBienAnnexe,
  useDeleteBienAnnexe,
  useUpdateBienAnnexe,
} from "@/lib/hooks/useBienAnnexes";
import { C } from "@/lib/design-tokens";

interface Props {
  bienId: string;
}

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "cave", label: "Cave" },
  { value: "parking_couvert", label: "Parking couvert" },
  { value: "parking_exterieur", label: "Parking extérieur" },
  { value: "box", label: "Box" },
  { value: "garage", label: "Garage" },
  { value: "grenier", label: "Grenier" },
  { value: "autre", label: "Autre" },
];

const TYPE_BADGE: Record<string, { color: string; bg: string }> = {
  cave: { color: "#7c5a3a", bg: "#f5edd9" },
  parking_couvert: { color: C.prussian, bg: C.prussianBg },
  parking_exterieur: { color: C.prussian, bg: C.prussianBg },
  box: { color: C.purple, bg: C.purpleBg },
  garage: { color: C.text2, bg: C.surface2 },
  grenier: { color: C.amber, bg: C.amberBg },
  autre: { color: C.text3, bg: C.surface2 },
};

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export function AnnexesSection({ bienId }: Props) {
  const { data: annexes = [], isLoading } = useBienAnnexes(bienId);
  const create = useCreateBienAnnexe(bienId);
  const remove = useDeleteBienAnnexe(bienId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = async (payload: BienAnnexeCreate) => {
    await create.mutateAsync(payload);
    setShowForm(false);
  };
  const handleDelete = (id: string) => {
    if (!window.confirm("Supprimer cette annexe ?")) return;
    remove.mutate(id);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={headerRowStyle}>
        <h3 style={titleStyle}>
          Annexes du bien
          <span style={countStyle}>({annexes.length})</span>
        </h3>
      </div>

      {isLoading ? (
        <p style={loadingStyle}>Chargement…</p>
      ) : annexes.length === 0 ? (
        <p style={emptyStyle}>
          Aucune annexe enregistrée. Cliquez sur « Ajouter une annexe » pour
          déclarer une cave, un parking, un box, etc.
        </p>
      ) : (
        <div style={gridStyle}>
          {annexes.map((annexe) =>
            editingId === annexe.id ? (
              <AnnexeEditForm
                key={annexe.id}
                bienId={bienId}
                annexe={annexe}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            ) : (
              <AnnexeCard
                key={annexe.id}
                annexe={annexe}
                onEdit={() => setEditingId(annexe.id)}
                onDelete={() => handleDelete(annexe.id)}
              />
            ),
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden", marginTop: 12 }}
          >
            <AnnexeCreateForm
              onCancel={() => setShowForm(false)}
              onSubmit={handleCreate}
              pending={create.isPending}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={addBtnStyle}
        >
          <Plus size={14} /> Ajouter une annexe
        </button>
      )}
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

function AnnexeCard({
  annexe,
  onEdit,
  onDelete,
}: {
  annexe: BienAnnexe;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const badge = TYPE_BADGE[annexe.type] ?? TYPE_BADGE.autre;
  return (
    <div
      className="annexe-card"
      style={{
        position: "relative",
        background: "#fff",
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 120,
      }}
    >
      <span
        style={{
          alignSelf: "flex-start",
          fontSize: 11,
          fontWeight: 600,
          padding: "2px 10px",
          borderRadius: 999,
          background: badge.bg,
          color: badge.color,
        }}
      >
        {TYPE_LABEL[annexe.type] ?? annexe.type}
      </span>
      {annexe.numero && (
        <p style={cardLabelStyle}>
          N° <span style={cardValueStyle}>{annexe.numero}</span>
        </p>
      )}
      {annexe.surface_m2 != null && (
        <p style={cardLabelStyle}>
          Surface <span style={cardValueStyle}>{Number(annexe.surface_m2)} m²</span>
        </p>
      )}
      <p style={{ ...cardLabelStyle, marginTop: "auto" }}>
        {annexe.inclus_dans_loyer ? (
          <span style={{ color: C.green, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Check size={13} /> Inclus dans le loyer
          </span>
        ) : annexe.loyer_supplement != null ? (
          <span style={{ color: C.amber }}>
            +{Number(annexe.loyer_supplement).toLocaleString("fr-CH")} CHF/mois
          </span>
        ) : (
          <span style={{ color: C.text3 }}>Loyer non précisé</span>
        )}
      </p>

      <div className="annexe-card-actions" style={cardActionsStyle}>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Modifier"
          title="Modifier"
          style={iconBtnStyle}
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Supprimer"
          title="Supprimer"
          style={{ ...iconBtnStyle, color: C.red }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── Forms ───────────────────────────────────────────────────────────────────

function AnnexeCreateForm({
  onCancel,
  onSubmit,
  pending,
}: {
  onCancel: () => void;
  onSubmit: (payload: BienAnnexeCreate) => Promise<void>;
  pending: boolean;
}) {
  const [form, setForm] = useState<BienAnnexeCreate>({
    type: "cave",
    numero: "",
    surface_m2: null,
    inclus_dans_loyer: true,
    loyer_supplement: null,
  });

  return (
    <FormShell
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        const payload: BienAnnexeCreate = {
          type: form.type,
          numero: form.numero?.trim() || null,
          surface_m2: form.surface_m2 != null ? Number(form.surface_m2) : null,
          inclus_dans_loyer: form.inclus_dans_loyer,
          loyer_supplement: !form.inclus_dans_loyer && form.loyer_supplement != null
            ? Number(form.loyer_supplement)
            : null,
        };
        onSubmit(payload);
      }}
      pending={pending}
      submitLabel="Ajouter"
    >
      <FormFields form={form} onChange={setForm} />
    </FormShell>
  );
}

function AnnexeEditForm({
  bienId,
  annexe,
  onCancel,
  onSaved,
}: {
  bienId: string;
  annexe: BienAnnexe;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const update = useUpdateBienAnnexe(bienId);
  const [form, setForm] = useState<BienAnnexeCreate>({
    type: annexe.type,
    numero: annexe.numero ?? "",
    surface_m2: annexe.surface_m2 ?? null,
    inclus_dans_loyer: annexe.inclus_dans_loyer,
    loyer_supplement: annexe.loyer_supplement ?? null,
  });

  return (
    <FormShell
      onCancel={onCancel}
      onSubmit={async (e) => {
        e.preventDefault();
        await update.mutateAsync({
          annexeId: annexe.id,
          patch: {
            type: form.type,
            numero: form.numero?.trim() || null,
            surface_m2: form.surface_m2 != null ? Number(form.surface_m2) : null,
            inclus_dans_loyer: form.inclus_dans_loyer,
            loyer_supplement: !form.inclus_dans_loyer && form.loyer_supplement != null
              ? Number(form.loyer_supplement)
              : null,
          },
        });
        onSaved();
      }}
      pending={update.isPending}
      submitLabel="Sauver"
    >
      <FormFields form={form} onChange={setForm} />
    </FormShell>
  );
}

function FormShell({
  onCancel,
  onSubmit,
  pending,
  submitLabel,
  children,
}: {
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  pending: boolean;
  submitLabel: string;
  children: React.ReactNode;
}) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: C.surface2,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {children}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={btnGhostStyle}>
          Annuler
        </button>
        <button
          type="submit"
          disabled={pending}
          style={{
            ...btnPrimaryStyle,
            opacity: pending ? 0.5 : 1,
            cursor: pending ? "not-allowed" : "pointer",
          }}
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function FormFields({
  form,
  onChange,
}: {
  form: BienAnnexeCreate;
  onChange: (next: BienAnnexeCreate) => void;
}) {
  const set = <K extends keyof BienAnnexeCreate>(
    key: K,
    value: BienAnnexeCreate[K],
  ) => onChange({ ...form, [key]: value });

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={fieldLabelStyle}>Type</label>
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
            style={inputStyle}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={fieldLabelStyle}>Numéro (optionnel)</label>
          <input
            type="text"
            value={form.numero ?? ""}
            onChange={(e) => set("numero", e.target.value)}
            placeholder="Ex : 12B"
            style={inputStyle}
          />
        </div>
      </div>
      <div>
        <label style={fieldLabelStyle}>Surface (m²)</label>
        <input
          type="number"
          step="0.01"
          min={0}
          value={form.surface_m2 ?? ""}
          onChange={(e) =>
            set("surface_m2", e.target.value === "" ? null : Number(e.target.value))
          }
          style={inputStyle}
        />
      </div>
      <label style={toggleRowStyle}>
        <input
          type="checkbox"
          checked={form.inclus_dans_loyer ?? true}
          onChange={(e) => set("inclus_dans_loyer", e.target.checked)}
          style={{ marginRight: 8, accentColor: C.prussian }}
        />
        <span>Inclus dans le loyer</span>
      </label>
      {!form.inclus_dans_loyer && (
        <div>
          <label style={fieldLabelStyle}>Loyer supplémentaire (CHF/mois)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={form.loyer_supplement ?? ""}
            onChange={(e) =>
              set(
                "loyer_supplement",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            style={inputStyle}
          />
        </div>
      )}
    </>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 18,
  fontWeight: 400,
  color: C.text,
  margin: 0,
};

const countStyle: React.CSSProperties = {
  marginLeft: 8,
  fontSize: 13,
  fontWeight: 400,
  color: C.text3,
};

const loadingStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.text3,
  margin: 0,
  padding: "16px 0",
};

const emptyStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.text3,
  margin: 0,
  padding: "12px 16px",
  background: C.surface2,
  borderRadius: 10,
  fontStyle: "italic",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 10,
};

const cardLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: C.text3,
};

const cardValueStyle: React.CSSProperties = {
  color: C.text,
  fontWeight: 500,
};

const cardActionsStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  display: "flex",
  gap: 4,
  opacity: 0,
  transition: "opacity 150ms ease",
};

const iconBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: 5,
  cursor: "pointer",
  color: C.text2,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const addBtnStyle: React.CSSProperties = {
  marginTop: 12,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 9,
  border: `1px dashed ${C.border}`,
  background: "transparent",
  color: C.prussian,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 500,
  color: C.text3,
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  color: C.text,
  fontFamily: "inherit",
  outline: "none",
};

const toggleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  fontSize: 13,
  color: C.text2,
  cursor: "pointer",
};

const btnPrimaryStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: C.prussian,
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnGhostStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  background: "transparent",
  color: C.text2,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};
