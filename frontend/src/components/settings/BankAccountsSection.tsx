"use client";

/**
 * Section Comptes bancaires (PR-A11.A.6.c).
 *
 * Affichée dans le tab "Bancaire" de /app/settings. Source de vérité unique
 * pour les coordonnées bancaires côté Althy (BankAccount table livrée
 * A11.A.6.a). User.iban est déprécié (rétrocompat Phase 1).
 *
 * Note de divergence catalogue (à officialiser dans un sprint cohérence
 * doc) : `docs/7-CATALOGUE-DONNEES-ALTHY.md` place les comptes bancaires
 * sous `/app/profil` (l. 1353). Décision Killian : `/app/settings` (cohérent
 * avec §4.5 doc 4-PRODUIT « préférences + abonnement + paiement »).
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  type BankAccount,
  type BankAccountCreate,
  useBankAccounts,
  useCreateBankAccount,
  useDeleteBankAccount,
  useUpdateBankAccount,
} from "@/lib/hooks/useBankAccounts";
import { C } from "@/lib/design-tokens";

const USAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "general", label: "Général" },
  { value: "regie", label: "Loyers / régie" },
  { value: "cautions", label: "Cautions" },
  { value: "charges", label: "Charges" },
  { value: "travaux", label: "Travaux" },
];

const USAGE_BADGE: Record<string, { color: string; bg: string }> = {
  general: { color: C.text2, bg: C.surface2 },
  regie: { color: C.purple, bg: C.purpleBg },
  cautions: { color: C.gold, bg: C.goldBg },
  charges: { color: C.blue, bg: C.blueBg },
  travaux: { color: C.amber, bg: C.amberBg },
};

const USAGE_LABEL: Record<string, string> = Object.fromEntries(
  USAGE_OPTIONS.map((o) => [o.value, o.label]),
);

const COUNTRY_OPTIONS = [
  { value: "CH", label: "🇨🇭 Suisse" },
  { value: "FR", label: "🇫🇷 France" },
  { value: "DE", label: "🇩🇪 Allemagne" },
  { value: "IT", label: "🇮🇹 Italie" },
  { value: "AT", label: "🇦🇹 Autriche" },
  { value: "LI", label: "🇱🇮 Liechtenstein" },
];

// Validation IBAN simple (CH ou format générique IBAN — pas python-stdnum
// strict, sprint sécurité financière dédié).
const IBAN_REGEX = /^[A-Z]{2}\d{2}\s?(\d{4}\s?){2,7}(\d{1,4})?$/;

/**
 * Formate un IBAN en groupes de 4 caractères séparés par des espaces
 * (convention suisse / SEPA). Ex : "CH9300762011623852957"
 *   → "CH93 0076 2011 6238 5295 7".
 */
function formatIban(iban: string): string {
  const clean = iban.replace(/\s/g, "").toUpperCase();
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

function maskIban(iban: string): string {
  const clean = iban.replace(/\s/g, "");
  if (clean.length <= 4) return clean;
  const last4 = clean.slice(-4);
  const masked = clean.slice(0, 2) + "**".padEnd(clean.length - 6, "*");
  // Format en groupes de 4
  return (masked + last4).replace(/(.{4})/g, "$1 ").trim();
}

export function BankAccountsSection() {
  const { data: accounts = [], isLoading } = useBankAccounts();
  const create = useCreateBankAccount();
  const remove = useDeleteBankAccount();
  const update = useUpdateBankAccount();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCreate = async (payload: BankAccountCreate) => {
    await create.mutateAsync(payload);
    setShowForm(false);
  };

  const handleDelete = (id: string, isPrincipal: boolean) => {
    const msg = isPrincipal
      ? "Supprimer ce compte principal ? Vous devrez désigner un nouveau principal manuellement après suppression."
      : "Supprimer ce compte ?";
    if (!window.confirm(msg)) return;
    remove.mutate(id);
  };

  const handleSetPrincipal = (id: string) => {
    update.mutate({ accountId: id, patch: { est_principal: true } });
  };

  return (
    <div>
      <header style={headerStyle}>
        <h2 style={h2Style}>Comptes bancaires</h2>
        <p style={descStyle}>
          Gérez vos comptes bancaires pour la perception des loyers, le dépôt
          des cautions, etc. Le compte « principal » est celui utilisé par
          défaut pour les loyers Althy.
        </p>
      </header>

      {isLoading ? (
        <p style={loadingStyle}>Chargement…</p>
      ) : accounts.length === 0 ? (
        <div style={emptyStateStyle}>
          <p style={emptyStateTitleStyle}>
            Aucun compte bancaire enregistré
          </p>
          <p style={emptyStateBodyStyle}>
            Ajoutez votre premier compte pour recevoir les loyers.
          </p>
        </div>
      ) : (
        <div style={listStyle}>
          {accounts.map((account) =>
            editingId === account.id ? (
              <BankAccountEditForm
                key={account.id}
                account={account}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            ) : (
              <BankAccountCard
                key={account.id}
                account={account}
                onEdit={() => setEditingId(account.id)}
                onDelete={() => handleDelete(account.id, account.est_principal)}
                onSetPrincipal={() => handleSetPrincipal(account.id)}
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
            style={{ overflow: "hidden", marginTop: 16 }}
          >
            <BankAccountCreateForm
              onCancel={() => setShowForm(false)}
              onSubmit={handleCreate}
              pending={create.isPending}
              hasNoOtherAccounts={accounts.length === 0}
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
          <Plus size={14} /> Ajouter un compte bancaire
        </button>
      )}
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

function BankAccountCard({
  account,
  onEdit,
  onDelete,
  onSetPrincipal,
}: {
  account: BankAccount;
  onEdit: () => void;
  onDelete: () => void;
  onSetPrincipal: () => void;
}) {
  const badge = USAGE_BADGE[account.usage] ?? USAGE_BADGE.general;
  const country = COUNTRY_OPTIONS.find((c) => c.value === account.banque_pays);

  return (
    <div
      className="bank-account-card"
      style={{
        position: "relative",
        background: "#fff",
        border: `1px solid ${account.est_principal ? C.gold : C.border}`,
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 999,
            background: badge.bg,
            color: badge.color,
          }}
        >
          {USAGE_LABEL[account.usage] ?? account.usage}
        </span>
        {account.est_principal ? (
          <span style={principalBadgeStyle}>
            <Star size={12} fill={C.gold} stroke={C.gold} /> Compte principal
          </span>
        ) : null}
      </div>

      <p style={ibanStyle} title={`IBAN masqué — affiché : ${formatIban(account.iban)}`}>
        {maskIban(account.iban)}
      </p>

      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text }}>
          {account.titulaire}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: C.text3 }}>
          {account.banque_nom ? `${account.banque_nom} · ` : ""}
          {country?.label ?? account.banque_pays}
          {account.bic ? ` · BIC ${account.bic}` : ""}
        </p>
      </div>

      <div style={cardFooterStyle}>
        {!account.est_principal && (
          <button
            type="button"
            onClick={onSetPrincipal}
            style={setPrincipalBtnStyle}
          >
            <Star size={12} /> Définir comme principal
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          style={editBtnStyle}
        >
          <Pencil size={12} /> Modifier ce compte
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Supprimer ce compte"
          title="Supprimer ce compte"
          style={deleteBtnStyle}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Forms ───────────────────────────────────────────────────────────────────

function BankAccountCreateForm({
  onCancel,
  onSubmit,
  pending,
  hasNoOtherAccounts,
}: {
  onCancel: () => void;
  onSubmit: (payload: BankAccountCreate) => Promise<void>;
  pending: boolean;
  hasNoOtherAccounts: boolean;
}) {
  const [form, setForm] = useState<BankAccountCreate>({
    usage: "general",
    iban: "",
    bic: "",
    titulaire: "",
    banque_nom: "",
    banque_pays: "CH",
    est_principal: hasNoOtherAccounts, // 1er compte → principal d'office
  });
  const [ibanError, setIbanError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIbanError(null);
    if (!IBAN_REGEX.test(form.iban.toUpperCase().trim())) {
      setIbanError("Format IBAN invalide. Ex : CH00 0000 0000 0000 0000 0");
      return;
    }
    if (form.titulaire.trim().length < 2) {
      return;
    }
    const payload: BankAccountCreate = {
      ...form,
      iban: form.iban.toUpperCase().trim(),
      bic: form.bic?.trim() || null,
      titulaire: form.titulaire.trim(),
      banque_nom: form.banque_nom?.trim() || null,
    };
    onSubmit(payload);
  };

  return (
    <FormShell
      onCancel={onCancel}
      onSubmit={handleSubmit}
      pending={pending}
      submitLabel="Ajouter"
    >
      <FormFields form={form} onChange={setForm} ibanError={ibanError} />
    </FormShell>
  );
}

function BankAccountEditForm({
  account,
  onCancel,
  onSaved,
}: {
  account: BankAccount;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const update = useUpdateBankAccount();
  const [form, setForm] = useState<BankAccountCreate>({
    usage: account.usage,
    iban: account.iban,
    bic: account.bic ?? "",
    titulaire: account.titulaire,
    banque_nom: account.banque_nom ?? "",
    banque_pays: account.banque_pays,
    est_principal: account.est_principal,
  });
  const [ibanError, setIbanError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIbanError(null);
    if (!IBAN_REGEX.test(form.iban.toUpperCase().trim())) {
      setIbanError("Format IBAN invalide.");
      return;
    }
    await update.mutateAsync({
      accountId: account.id,
      patch: {
        usage: form.usage,
        iban: form.iban.toUpperCase().trim(),
        bic: form.bic?.trim() || null,
        titulaire: form.titulaire.trim(),
        banque_nom: form.banque_nom?.trim() || null,
        banque_pays: form.banque_pays,
        est_principal: form.est_principal,
      },
    });
    onSaved();
  };

  return (
    <FormShell
      onCancel={onCancel}
      onSubmit={handleSubmit}
      pending={update.isPending}
      submitLabel="Sauver"
    >
      <FormFields form={form} onChange={setForm} ibanError={ibanError} />
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
        borderRadius: 14,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
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
  ibanError,
}: {
  form: BankAccountCreate;
  onChange: (next: BankAccountCreate) => void;
  ibanError: string | null;
}) {
  const set = <K extends keyof BankAccountCreate>(
    key: K,
    value: BankAccountCreate[K],
  ) => onChange({ ...form, [key]: value });

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={fieldLabelStyle}>Usage</label>
          <select
            value={form.usage}
            onChange={(e) => set("usage", e.target.value)}
            style={inputStyle}
          >
            {USAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={fieldLabelStyle}>Pays banque</label>
          <select
            value={form.banque_pays ?? "CH"}
            onChange={(e) => set("banque_pays", e.target.value)}
            style={inputStyle}
          >
            {COUNTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label style={fieldLabelStyle}>IBAN*</label>
        <input
          type="text"
          value={form.iban}
          onChange={(e) => set("iban", e.target.value)}
          onBlur={(e) => set("iban", formatIban(e.target.value))}
          placeholder="CH00 0000 0000 0000 0000 0"
          required
          style={{
            ...inputStyle,
            borderColor: ibanError ? C.red : C.border,
            fontFamily: "monospace",
          }}
        />
        {ibanError ? (
          <p style={{ fontSize: 11, color: C.red, margin: "4px 0 0" }}>
            {ibanError}
          </p>
        ) : (
          <p style={{ fontSize: 11, color: C.text3, margin: "4px 0 0" }}>
            Format suisse : groupes de 4 caractères séparés par un espace.
          </p>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={fieldLabelStyle}>BIC (optionnel)</label>
          <input
            type="text"
            value={form.bic ?? ""}
            onChange={(e) => set("bic", e.target.value)}
            placeholder="UBSWCHZH80A"
            style={{ ...inputStyle, fontFamily: "monospace" }}
          />
        </div>
        <div>
          <label style={fieldLabelStyle}>Nom banque</label>
          <input
            type="text"
            value={form.banque_nom ?? ""}
            onChange={(e) => set("banque_nom", e.target.value)}
            placeholder="UBS, PostFinance, Raiffeisen…"
            style={inputStyle}
          />
        </div>
      </div>
      <div>
        <label style={fieldLabelStyle}>Titulaire*</label>
        <input
          type="text"
          value={form.titulaire}
          onChange={(e) => set("titulaire", e.target.value)}
          placeholder="Prénom Nom"
          required
          style={inputStyle}
        />
      </div>
      <label style={toggleRowStyle}>
        <input
          type="checkbox"
          checked={form.est_principal ?? false}
          onChange={(e) => set("est_principal", e.target.checked)}
          style={{ marginRight: 8, accentColor: C.gold }}
        />
        <span>Compte principal (utilisé par défaut pour les loyers)</span>
      </label>
    </>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  marginBottom: 24,
};

const h2Style: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 24,
  fontWeight: 400,
  color: C.text,
  margin: "0 0 6px",
};

const descStyle: React.CSSProperties = {
  fontSize: 14,
  color: C.text3,
  margin: 0,
  maxWidth: 640,
};

const loadingStyle: React.CSSProperties = {
  fontSize: 14,
  color: C.text3,
  padding: 24,
  margin: 0,
};

const emptyStateStyle: React.CSSProperties = {
  padding: "32px 24px",
  background: C.surface2,
  border: `1px dashed ${C.border}`,
  borderRadius: 14,
  textAlign: "center",
};

const emptyStateTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: C.text,
  margin: "0 0 6px",
};

const emptyStateBodyStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.text3,
  margin: 0,
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
  gap: 14,
};

const ibanStyle: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 14,
  letterSpacing: "0.04em",
  color: C.text2,
  margin: 0,
  padding: "8px 12px",
  background: C.surface2,
  borderRadius: 8,
};

const principalBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 10px",
  borderRadius: 999,
  background: C.goldBg,
  color: C.goldHover,
  border: `1px solid ${C.goldBorder}`,
};

const setPrincipalBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 500,
  padding: "3px 10px",
  borderRadius: 999,
  background: "transparent",
  color: C.text3,
  border: `1px solid ${C.border}`,
  cursor: "pointer",
  fontFamily: "inherit",
};

const cardFooterStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 6,
  paddingTop: 10,
  borderTop: `1px solid ${C.border}`,
};

const editBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 8,
  border: `1px solid ${C.prussian}`,
  background: C.prussianBg,
  color: C.prussian,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const deleteBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 7,
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  background: "transparent",
  color: C.red,
  cursor: "pointer",
  fontFamily: "inherit",
};

const addBtnStyle: React.CSSProperties = {
  marginTop: 16,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 16px",
  borderRadius: 10,
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
  padding: "10px 12px",
  fontSize: 14,
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
  padding: "10px 18px",
  borderRadius: 9,
  border: "none",
  background: C.prussian,
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnGhostStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 9,
  border: `1px solid ${C.border}`,
  background: "transparent",
  color: C.text2,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
};
