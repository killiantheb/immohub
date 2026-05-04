"use client";

/**
 * Section Clés / badges inline (PR-A11.A.6.d).
 *
 * Affichée dans le tab "Identité" de la modale Caractéristiques (sous
 * "Sécurité opérationnelle"). Pattern identique à `AnnexesSection` /
 * `ContactsSection` / `CompteursSection` : cards mini + form inline ajout
 * et édition + delete avec confirm.
 *
 * À chaque create/delete, le backend recalcule `bien.keys_count` ; le
 * compteur affiché reste cohérent par invalidation `["biens", bienId]`.
 */

import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  useBienKeys,
  useCreateBienKey,
  useDeleteBienKey,
  useUpdateBienKey,
} from "@/lib/hooks/useBienKeys";
import type { BienKey, BienKeyCreate } from "@/lib/types";
import { C } from "@/lib/design-tokens";

interface Props {
  bienId: string;
}

const TYPE_OPTIONS: { value: string; label: string }[] = [
  // PR-A11.A.6.f : appartement ajouté en première position (default le plus
  // courant — la clé du logement lui-même).
  { value: "appartement", label: "Appartement" },
  { value: "entree", label: "Entrée immeuble" },
  { value: "cave", label: "Cave" },
  { value: "boite_aux_lettres", label: "Boîte aux lettres" },
  { value: "parking", label: "Parking" },
  { value: "garage", label: "Garage" },
  { value: "cadenas", label: "Cadenas" },
  { value: "autre", label: "Autre" },
];

const TYPE_BADGE: Record<string, { color: string; bg: string }> = {
  appartement: { color: C.prussian, bg: C.prussianBg },
  entree: { color: C.signature, bg: C.prussianBg },
  cave: { color: "#7c5a3a", bg: "#f5edd9" },
  boite_aux_lettres: { color: C.purple, bg: C.purpleBg },
  parking: { color: C.text2, bg: C.surface2 },
  garage: { color: C.text2, bg: C.surface2 },
  cadenas: { color: C.amber, bg: C.amberBg },
  autre: { color: C.text3, bg: C.surface2 },
};

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export function KeysSection({ bienId }: Props) {
  const { data: keys = [], isLoading } = useBienKeys(bienId);
  const create = useCreateBienKey(bienId);
  const remove = useDeleteBienKey(bienId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = async (payload: BienKeyCreate) => {
    await create.mutateAsync(payload);
    setShowForm(false);
  };
  const handleDelete = (id: string) => {
    if (!window.confirm("Supprimer cette clé / ce badge ?")) return;
    remove.mutate(id);
  };

  return (
    <div style={{ marginTop: 4 }}>
      <div style={headerRowStyle}>
        <h4 style={titleStyle}>
          Clés et badges
          <span style={countStyle}>({keys.length})</span>
        </h4>
      </div>

      {isLoading ? (
        <p style={loadingStyle}>Chargement…</p>
      ) : keys.length === 0 ? (
        <p style={emptyStyle}>
          Aucune clé enregistrée. Cliquez sur « Ajouter une clé ou un badge »
          pour déclarer une entrée, une cave, une boîte aux lettres, etc.
        </p>
      ) : (
        <div style={gridStyle}>
          {keys.map((key) =>
            editingId === key.id ? (
              <KeyEditForm
                key={key.id}
                bienId={bienId}
                bienKey={key}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            ) : (
              <KeyCard
                key={key.id}
                bienKey={key}
                onEdit={() => setEditingId(key.id)}
                onDelete={() => handleDelete(key.id)}
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
            <KeyCreateForm
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
          <Plus size={14} /> Ajouter une clé ou un badge
        </button>
      )}
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

function KeyCard({
  bienKey,
  onEdit,
  onDelete,
}: {
  bienKey: BienKey;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const badge = TYPE_BADGE[bienKey.type] ?? TYPE_BADGE.autre;
  return (
    <div
      className="key-card"
      style={{
        position: "relative",
        background: "#fff",
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 110,
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
        {TYPE_LABEL[bienKey.type] ?? bienKey.type}
      </span>
      {bienKey.numero_badge && (
        <p style={cardLabelStyle}>
          N° badge <span style={cardValueStyle}>{bienKey.numero_badge}</span>
        </p>
      )}
      {bienKey.description && (
        <p style={{ ...cardLabelStyle, color: C.text2 }}>
          {bienKey.description}
        </p>
      )}

      <div className="key-card-actions" style={cardActionsStyle}>
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

function KeyCreateForm({
  onCancel,
  onSubmit,
  pending,
}: {
  onCancel: () => void;
  onSubmit: (payload: BienKeyCreate) => Promise<void>;
  pending: boolean;
}) {
  const [form, setForm] = useState<BienKeyCreate>({
    type: "appartement",
    numero_badge: "",
    description: "",
  });

  return (
    <FormShell
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          type: form.type,
          numero_badge: form.numero_badge?.trim() || null,
          description: form.description?.trim() || null,
        });
      }}
      pending={pending}
      submitLabel="Ajouter"
    >
      <FormFields form={form} onChange={setForm} />
    </FormShell>
  );
}

function KeyEditForm({
  bienId,
  bienKey,
  onCancel,
  onSaved,
}: {
  bienId: string;
  bienKey: BienKey;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const update = useUpdateBienKey(bienId);
  const [form, setForm] = useState<BienKeyCreate>({
    type: bienKey.type,
    numero_badge: bienKey.numero_badge ?? "",
    description: bienKey.description ?? "",
  });

  return (
    <FormShell
      onCancel={onCancel}
      onSubmit={async (e) => {
        e.preventDefault();
        await update.mutateAsync({
          keyId: bienKey.id,
          patch: {
            type: form.type,
            numero_badge: form.numero_badge?.trim() || null,
            description: form.description?.trim() || null,
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
  form: BienKeyCreate;
  onChange: (next: BienKeyCreate) => void;
}) {
  const set = <K extends keyof BienKeyCreate>(
    key: K,
    value: BienKeyCreate[K],
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
          <label style={fieldLabelStyle}>Numéro de badge (optionnel)</label>
          <input
            type="text"
            value={form.numero_badge ?? ""}
            onChange={(e) => set("numero_badge", e.target.value)}
            placeholder="Ex : A412"
            style={inputStyle}
          />
        </div>
      </div>
      <div>
        <label style={fieldLabelStyle}>Description (optionnel)</label>
        <input
          type="text"
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Ex : code 95, double exemplaire, ouvre le local vélos"
          style={inputStyle}
        />
      </div>
    </>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 15,
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
  padding: "12px 0",
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
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
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

// PR-A11.A.6.f — actions toujours visibles (D6 fix). Avant : opacity 0 +
// révélé au :hover, ce qui les rendait inaccessibles sur tactile (mobile/
// tablette n'ont pas de hover) et peu découvrables sur desktop. Les actions
// sont maintenant rendues en permanence avec un fond semi-opaque.
const cardActionsStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  display: "flex",
  gap: 4,
  opacity: 1,
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
