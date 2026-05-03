"use client";

/**
 * Section Contacts inline (PR-A11.A.6.c).
 *
 * Affichée dans le tab "Contacts" de la modale Caractéristiques.
 * Pattern symétrique de AnnexesSection (cards mini + form inline avec save
 * explicite par sub-form).
 */

import { motion, AnimatePresence } from "framer-motion";
import { Mail, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  type BienContact,
  type BienContactCreate,
  useBienContacts,
  useCreateBienContact,
  useDeleteBienContact,
  useUpdateBienContact,
} from "@/lib/hooks/useBienContacts";
import { C } from "@/lib/design-tokens";

interface Props {
  bienId: string;
}

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "regie_tierce", label: "Régie tierce" },
  { value: "syndic", label: "Syndic PPE" },
  { value: "concierge", label: "Concierge" },
  { value: "garant", label: "Garant" },
  { value: "voisin_cle", label: "Voisin avec clé" },
  { value: "proprietaire_voisin", label: "Propriétaire voisin" },
  { value: "autre", label: "Autre" },
];

const ROLE_BADGE: Record<string, { color: string; bg: string }> = {
  regie_tierce: { color: C.gold, bg: C.goldBg },
  syndic: { color: C.purple, bg: C.purpleBg },
  concierge: { color: C.green, bg: C.greenBg },
  garant: { color: C.amber, bg: C.amberBg },
  voisin_cle: { color: C.blue, bg: C.blueBg },
  proprietaire_voisin: { color: C.prussian, bg: C.prussianBg },
  autre: { color: C.text3, bg: C.surface2 },
};

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((o) => [o.value, o.label]),
);

export function ContactsSection({ bienId }: Props) {
  const { data: contacts = [], isLoading } = useBienContacts(bienId);
  const create = useCreateBienContact(bienId);
  const remove = useDeleteBienContact(bienId);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = async (payload: BienContactCreate) => {
    await create.mutateAsync(payload);
    setShowForm(false);
  };
  const handleDelete = (id: string) => {
    if (!window.confirm("Supprimer ce contact ?")) return;
    remove.mutate(id);
  };

  return (
    <div>
      <div style={headerRowStyle}>
        <h3 style={titleStyle}>
          Contacts externes
          <span style={countStyle}>({contacts.length})</span>
        </h3>
      </div>
      <p style={subtitleStyle}>
        Régie tierce, syndic, concierge, garant, voisin ayant une clé… Les
        contacts non-Althy liés au bien.
      </p>

      {isLoading ? (
        <p style={loadingStyle}>Chargement…</p>
      ) : contacts.length === 0 ? (
        <p style={emptyStyle}>
          Aucun contact enregistré. Cliquez sur « Ajouter un contact ».
        </p>
      ) : (
        <div style={gridStyle}>
          {contacts.map((contact) =>
            editingId === contact.id ? (
              <ContactEditForm
                key={contact.id}
                bienId={bienId}
                contact={contact}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            ) : (
              <ContactCard
                key={contact.id}
                contact={contact}
                onEdit={() => setEditingId(contact.id)}
                onDelete={() => handleDelete(contact.id)}
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
            <ContactCreateForm
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
          <Plus size={14} /> Ajouter un contact
        </button>
      )}
    </div>
  );
}

function ContactCard({
  contact,
  onEdit,
  onDelete,
}: {
  contact: BienContact;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const badge = ROLE_BADGE[contact.role] ?? ROLE_BADGE.autre;
  return (
    <div
      className="contact-card"
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
        {ROLE_LABEL[contact.role] ?? contact.role}
      </span>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text }}>
        {[contact.prenom, contact.nom].filter(Boolean).join(" ") || contact.nom}
      </p>
      {contact.societe && (
        <p style={{ margin: 0, fontSize: 12, color: C.text3 }}>
          {contact.societe}
        </p>
      )}
      {contact.email && (
        <p style={contactMetaStyle}>
          <Mail size={12} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {contact.email}
          </span>
        </p>
      )}
      {contact.telephone && (
        <p style={contactMetaStyle}>
          <Phone size={12} />
          <span>{contact.telephone}</span>
        </p>
      )}
      <div className="contact-card-actions" style={cardActionsStyle}>
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

function ContactCreateForm({
  onCancel,
  onSubmit,
  pending,
}: {
  onCancel: () => void;
  onSubmit: (payload: BienContactCreate) => Promise<void>;
  pending: boolean;
}) {
  const [form, setForm] = useState<BienContactCreate>({
    role: "regie_tierce",
    nom: "",
    prenom: "",
    societe: "",
    email: "",
    telephone: "",
    adresse: "",
    notes: "",
  });

  return (
    <FormShell
      onCancel={onCancel}
      onSubmit={(e) => {
        e.preventDefault();
        const cleaned: BienContactCreate = {
          role: form.role,
          nom: form.nom.trim(),
          prenom: form.prenom?.trim() || null,
          societe: form.societe?.trim() || null,
          email: form.email?.trim() || null,
          telephone: form.telephone?.trim() || null,
          adresse: form.adresse?.trim() || null,
          notes: form.notes?.trim() || null,
        };
        onSubmit(cleaned);
      }}
      pending={pending}
      submitLabel="Ajouter"
    >
      <ContactFormFields form={form} onChange={setForm} />
    </FormShell>
  );
}

function ContactEditForm({
  bienId,
  contact,
  onCancel,
  onSaved,
}: {
  bienId: string;
  contact: BienContact;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const update = useUpdateBienContact(bienId);
  const [form, setForm] = useState<BienContactCreate>({
    role: contact.role,
    nom: contact.nom,
    prenom: contact.prenom ?? "",
    societe: contact.societe ?? "",
    email: contact.email ?? "",
    telephone: contact.telephone ?? "",
    adresse: contact.adresse ?? "",
    notes: contact.notes ?? "",
  });

  return (
    <FormShell
      onCancel={onCancel}
      onSubmit={async (e) => {
        e.preventDefault();
        await update.mutateAsync({
          contactId: contact.id,
          patch: {
            role: form.role,
            nom: form.nom.trim(),
            prenom: form.prenom?.trim() || null,
            societe: form.societe?.trim() || null,
            email: form.email?.trim() || null,
            telephone: form.telephone?.trim() || null,
            adresse: form.adresse?.trim() || null,
            notes: form.notes?.trim() || null,
          },
        });
        onSaved();
      }}
      pending={update.isPending}
      submitLabel="Sauver"
    >
      <ContactFormFields form={form} onChange={setForm} />
    </FormShell>
  );
}

function ContactFormFields({
  form,
  onChange,
}: {
  form: BienContactCreate;
  onChange: (f: BienContactCreate) => void;
}) {
  const set = <K extends keyof BienContactCreate>(
    key: K,
    value: BienContactCreate[K],
  ) => onChange({ ...form, [key]: value });

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={fieldLabelStyle}>Rôle</label>
          <select
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
            style={inputStyle}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={fieldLabelStyle}>Société (optionnel)</label>
          <input
            type="text"
            value={form.societe ?? ""}
            onChange={(e) => set("societe", e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={fieldLabelStyle}>Nom*</label>
          <input
            type="text"
            value={form.nom}
            onChange={(e) => set("nom", e.target.value)}
            required
            style={inputStyle}
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>Prénom (optionnel)</label>
          <input
            type="text"
            value={form.prenom ?? ""}
            onChange={(e) => set("prenom", e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={fieldLabelStyle}>Email</label>
          <input
            type="email"
            value={form.email ?? ""}
            onChange={(e) => set("email", e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>Téléphone</label>
          <input
            type="tel"
            value={form.telephone ?? ""}
            onChange={(e) => set("telephone", e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>
      <div>
        <label style={fieldLabelStyle}>Adresse</label>
        <input
          type="text"
          value={form.adresse ?? ""}
          onChange={(e) => set("adresse", e.target.value)}
          style={inputStyle}
        />
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

const contactMetaStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: C.text2,
  display: "flex",
  alignItems: "center",
  gap: 6,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
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
