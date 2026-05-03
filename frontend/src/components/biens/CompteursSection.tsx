"use client";

/**
 * Section Compteurs inline (PR-A11.A.6.c).
 *
 * Affichée en bas du tab "Caractéristiques techniques" (Option B —
 * intégration sémantique avec chauffage / eau chaude).
 */

import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  type BienCompteur,
  type BienCompteurCreate,
  useBienCompteurs,
  useCreateBienCompteur,
  useDeleteBienCompteur,
  useUpdateBienCompteur,
} from "@/lib/hooks/useBienCompteurs";
import { C } from "@/lib/design-tokens";

interface Props {
  bienId: string;
}

const TYPE_OPTIONS: { value: string; label: string; defaultUnite: string }[] = [
  { value: "eau_froide", label: "Eau froide", defaultUnite: "m³" },
  { value: "eau_chaude", label: "Eau chaude", defaultUnite: "m³" },
  { value: "electricite", label: "Électricité", defaultUnite: "kWh" },
  { value: "gaz", label: "Gaz", defaultUnite: "m³" },
  { value: "mazout", label: "Mazout", defaultUnite: "litres" },
  { value: "chauffage", label: "Chauffage", defaultUnite: "kWh" },
  { value: "autre", label: "Autre", defaultUnite: "" },
];

const TYPE_BADGE: Record<string, { color: string; bg: string }> = {
  eau_froide: { color: C.blue, bg: C.blueBg },
  eau_chaude: { color: C.red, bg: C.redBg },
  electricite: { color: C.gold, bg: C.goldBg },
  gaz: { color: C.amber, bg: C.amberBg },
  mazout: { color: "#7c5a3a", bg: "#f5edd9" },
  chauffage: { color: C.red, bg: C.redBg },
  autre: { color: C.text3, bg: C.surface2 },
};

const PARTAGE_BADGE: Record<string, { color: string; bg: string; label: string }> = {
  proprietaire: { color: C.purple, bg: C.purpleBg, label: "Propriétaire" },
  locataire: { color: C.green, bg: C.greenBg, label: "Locataire" },
  divise: { color: C.text2, bg: C.surface2, label: "Divisé" },
};

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export function CompteursSection({ bienId }: Props) {
  const { data: compteurs = [], isLoading } = useBienCompteurs(bienId);
  const create = useCreateBienCompteur(bienId);
  const remove = useDeleteBienCompteur(bienId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = async (payload: BienCompteurCreate) => {
    await create.mutateAsync(payload);
    setShowForm(false);
  };
  const handleDelete = (id: string) => {
    if (!window.confirm("Supprimer ce compteur ?")) return;
    remove.mutate(id);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={headerRowStyle}>
        <h3 style={titleStyle}>
          Compteurs
          <span style={countStyle}>({compteurs.length})</span>
        </h3>
      </div>
      <p style={subtitleStyle}>
        Eau, électricité, gaz, mazout, chauffage. Conserve les relevés
        d&apos;entrée locataire pour comparaison.
      </p>

      {isLoading ? (
        <p style={loadingStyle}>Chargement…</p>
      ) : compteurs.length === 0 ? (
        <p style={emptyStyle}>
          Aucun compteur enregistré. Cliquez sur « Ajouter un compteur ».
        </p>
      ) : (
        <div style={gridStyle}>
          {compteurs.map((compteur) =>
            editingId === compteur.id ? (
              <CompteurEditForm
                key={compteur.id}
                bienId={bienId}
                compteur={compteur}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            ) : (
              <CompteurCard
                key={compteur.id}
                compteur={compteur}
                onEdit={() => setEditingId(compteur.id)}
                onDelete={() => handleDelete(compteur.id)}
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
            <CompteurCreateForm
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
          <Plus size={14} /> Ajouter un compteur
        </button>
      )}
    </div>
  );
}

function CompteurCard({
  compteur,
  onEdit,
  onDelete,
}: {
  compteur: BienCompteur;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const badge = TYPE_BADGE[compteur.type] ?? TYPE_BADGE.autre;
  const partageBadge = compteur.partage
    ? PARTAGE_BADGE[compteur.partage]
    : null;

  return (
    <div
      className="compteur-card"
      style={{
        position: "relative",
        background: "#fff",
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 10px",
            borderRadius: 999,
            background: badge.bg,
            color: badge.color,
          }}
        >
          {TYPE_LABEL[compteur.type] ?? compteur.type}
        </span>
        {partageBadge && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 10px",
              borderRadius: 999,
              background: partageBadge.bg,
              color: partageBadge.color,
            }}
          >
            {partageBadge.label}
          </span>
        )}
      </div>
      {compteur.numero_compteur && (
        <p style={cardLabelStyle}>
          N° <span style={cardValueStyle}>{compteur.numero_compteur}</span>
        </p>
      )}
      {compteur.emplacement && (
        <p style={cardLabelStyle}>
          Emplacement <span style={cardValueStyle}>{compteur.emplacement}</span>
        </p>
      )}
      {compteur.releve_initial != null && (
        <p style={cardLabelStyle}>
          Relevé initial{" "}
          <span style={cardValueStyle}>
            {Number(compteur.releve_initial).toLocaleString("fr-CH")}
            {compteur.unite ? ` ${compteur.unite}` : ""}
          </span>
          {compteur.date_releve_initial && (
            <span style={{ color: C.text3 }}>
              {" "}
              ({new Date(compteur.date_releve_initial).toLocaleDateString("fr-CH")})
            </span>
          )}
        </p>
      )}

      <div className="compteur-card-actions" style={cardActionsStyle}>
        <button type="button" onClick={onEdit} aria-label="Modifier" title="Modifier" style={iconBtnStyle}>
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

function CompteurCreateForm({
  onCancel,
  onSubmit,
  pending,
}: {
  onCancel: () => void;
  onSubmit: (payload: BienCompteurCreate) => Promise<void>;
  pending: boolean;
}) {
  const [form, setForm] = useState<BienCompteurCreate>({
    type: "eau_froide",
    numero_compteur: "",
    emplacement: "",
    unite: "m³",
    releve_initial: null,
    date_releve_initial: null,
    partage: "locataire",
    notes: "",
  });

  return (
    <FormShell
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        const cleaned: BienCompteurCreate = {
          type: form.type,
          numero_compteur: form.numero_compteur?.trim() || null,
          emplacement: form.emplacement?.trim() || null,
          unite: form.unite?.trim() || null,
          releve_initial:
            form.releve_initial != null
              ? Number(form.releve_initial)
              : null,
          date_releve_initial: form.date_releve_initial || null,
          partage: form.partage || null,
          notes: form.notes?.trim() || null,
        };
        onSubmit(cleaned);
      }}
      pending={pending}
      submitLabel="Ajouter"
    >
      <CompteurFormFields form={form} onChange={setForm} />
    </FormShell>
  );
}

function CompteurEditForm({
  bienId,
  compteur,
  onCancel,
  onSaved,
}: {
  bienId: string;
  compteur: BienCompteur;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const update = useUpdateBienCompteur(bienId);
  const [form, setForm] = useState<BienCompteurCreate>({
    type: compteur.type,
    numero_compteur: compteur.numero_compteur ?? "",
    emplacement: compteur.emplacement ?? "",
    unite: compteur.unite ?? "",
    releve_initial: compteur.releve_initial ?? null,
    date_releve_initial: compteur.date_releve_initial ?? null,
    partage: compteur.partage ?? "locataire",
    notes: compteur.notes ?? "",
  });

  return (
    <FormShell
      onCancel={onCancel}
      onSubmit={async (e) => {
        e.preventDefault();
        await update.mutateAsync({
          compteurId: compteur.id,
          patch: {
            type: form.type,
            numero_compteur: form.numero_compteur?.trim() || null,
            emplacement: form.emplacement?.trim() || null,
            unite: form.unite?.trim() || null,
            releve_initial:
              form.releve_initial != null
                ? Number(form.releve_initial)
                : null,
            date_releve_initial: form.date_releve_initial || null,
            partage: form.partage || null,
            notes: form.notes?.trim() || null,
          },
        });
        onSaved();
      }}
      pending={update.isPending}
      submitLabel="Sauver"
    >
      <CompteurFormFields form={form} onChange={setForm} />
    </FormShell>
  );
}

function CompteurFormFields({
  form,
  onChange,
}: {
  form: BienCompteurCreate;
  onChange: (f: BienCompteurCreate) => void;
}) {
  const set = <K extends keyof BienCompteurCreate>(
    key: K,
    value: BienCompteurCreate[K],
  ) => onChange({ ...form, [key]: value });

  const handleTypeChange = (newType: string) => {
    const def = TYPE_OPTIONS.find((o) => o.value === newType);
    onChange({
      ...form,
      type: newType,
      // Si l'unité est vide ou correspond à l'ancienne unité par défaut,
      // on la met à jour avec celle du nouveau type. Sinon on respecte
      // ce que l'utilisateur a saisi manuellement.
      unite:
        !form.unite ||
        TYPE_OPTIONS.some((o) => o.defaultUnite === form.unite)
          ? def?.defaultUnite || ""
          : form.unite,
    });
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={fieldLabelStyle}>Type</label>
          <select
            value={form.type}
            onChange={(e) => handleTypeChange(e.target.value)}
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
          <label style={fieldLabelStyle}>Partage</label>
          <select
            value={form.partage ?? ""}
            onChange={(e) => set("partage", e.target.value)}
            style={inputStyle}
          >
            <option value="locataire">Payé par le locataire</option>
            <option value="proprietaire">Payé par le propriétaire</option>
            <option value="divise">Divisé</option>
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={fieldLabelStyle}>N° compteur</label>
          <input
            type="text"
            value={form.numero_compteur ?? ""}
            onChange={(e) => set("numero_compteur", e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>Emplacement</label>
          <input
            type="text"
            value={form.emplacement ?? ""}
            onChange={(e) => set("emplacement", e.target.value)}
            placeholder="Ex : cave, cuisine"
            style={inputStyle}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>
          <label style={fieldLabelStyle}>Relevé initial</label>
          <input
            type="number"
            step="0.01"
            value={form.releve_initial ?? ""}
            onChange={(e) =>
              set(
                "releve_initial",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            style={inputStyle}
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>Unité</label>
          <input
            type="text"
            value={form.unite ?? ""}
            onChange={(e) => set("unite", e.target.value)}
            placeholder="m³ / kWh"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>Date relevé</label>
          <input
            type="date"
            value={form.date_releve_initial ?? ""}
            onChange={(e) => set("date_releve_initial", e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>
      <div>
        <label style={fieldLabelStyle}>Notes</label>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>
    </>
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

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 4,
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

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.text3,
  margin: "0 0 14px",
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
