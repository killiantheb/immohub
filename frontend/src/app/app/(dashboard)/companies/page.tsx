"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building, Loader2, Mail, MapPin, Phone, Plus, Search, X } from "lucide-react";
import { useCompanies, useCreateCompany, useUpdateCompany, type Company } from "@/lib/hooks/useCompanies";

const S = {
  bg: "var(--althy-bg)",
  surface: "var(--althy-surface)",
  surface2: "var(--althy-surface-2)",
  border: "var(--althy-border)",
  text: "var(--althy-text)",
  text2: "var(--althy-text-2)",
  text3: "var(--althy-text-3)",
  orange: "var(--althy-orange)",
  orangeBg: "var(--althy-orange-bg)",
  green: "var(--althy-green)",
  greenBg: "var(--althy-green-bg)",
  red: "var(--althy-red)",
  redBg: "var(--althy-red-bg)",
  amber: "var(--althy-amber)",
  amberBg: "var(--althy-amber-bg)",
  blue: "var(--althy-blue)",
  blueBg: "var(--althy-blue-bg)",
  shadow: "var(--althy-shadow)",
  shadowMd: "var(--althy-shadow-md)",
} as const;

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: `1px solid var(--althy-border)`,
  borderRadius: 10,
  fontSize: 14,
  color: "var(--althy-text)",
  background: "var(--althy-surface)",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "var(--althy-text-3)",
  marginBottom: 6,
  fontWeight: 500,
};

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "Nom requis"),
  siret: z.string().length(14, "14 chiffres requis").optional().or(z.literal("")),
  vat_number: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zip_code: z.string().optional(),
  country: z.string().default("FR"),
  status: z.enum(["active", "inactive"]).default("active"),
});

type FormValues = z.infer<typeof schema>;

// ── Modal ─────────────────────────────────────────────────────────────────────

function CompanyModal({
  company,
  onClose,
}: {
  company?: Company;
  onClose: () => void;
}) {
  const create = useCreateCompany();
  const update = useUpdateCompany(company?.id ?? "");
  const isPending = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: company
      ? {
          name: company.name,
          siret: company.siret ?? "",
          vat_number: company.vat_number ?? "",
          email: company.email ?? "",
          phone: company.phone ?? "",
          address: company.address ?? "",
          city: company.city ?? "",
          zip_code: company.zip_code ?? "",
          country: company.country,
          status: company.status,
        }
      : { country: "FR", status: "active" },
  });

  const onSubmit = async (data: FormValues) => {
    const payload = {
      ...data,
      siret: data.siret || undefined,
      email: data.email || undefined,
    };
    if (company) {
      await update.mutateAsync(payload);
    } else {
      await create.mutateAsync(payload);
    }
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 520, borderRadius: 18, background: S.surface, boxShadow: S.shadowMd }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${S.border}`, padding: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: S.text, margin: 0 }}>
            {company ? "Modifier la société" : "Ajouter une société"}
          </h2>
          <button
            onClick={onClose}
            style={{ borderRadius: 8, padding: 6, background: "transparent", border: "none", cursor: "pointer", color: S.text3 }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name */}
          <div>
            <label style={labelStyle}>Nom de la société *</label>
            <input {...register("name")} style={inputStyle} placeholder="SARL Exemple" />
            {errors.name && <p style={{ marginTop: 4, fontSize: 12, color: S.red }}>{errors.name.message}</p>}
          </div>

          {/* SIRET + VAT */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>SIRET</label>
              <input {...register("siret")} style={inputStyle} placeholder="14 chiffres" maxLength={14} />
              {errors.siret && <p style={{ marginTop: 4, fontSize: 12, color: S.red }}>{errors.siret.message}</p>}
            </div>
            <div>
              <label style={labelStyle}>N° TVA</label>
              <input {...register("vat_number")} style={inputStyle} placeholder="FR12345678901" />
            </div>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Email</label>
              <input {...register("email")} type="email" style={inputStyle} placeholder="contact@société.fr" />
              {errors.email && <p style={{ marginTop: 4, fontSize: 12, color: S.red }}>{errors.email.message}</p>}
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input {...register("phone")} style={inputStyle} placeholder="01 23 45 67 89" />
            </div>
          </div>

          {/* Address */}
          <div>
            <label style={labelStyle}>Adresse</label>
            <input {...register("address")} style={inputStyle} placeholder="123 rue de la Paix" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label style={labelStyle}>Code postal</label>
              <input {...register("zip_code")} style={inputStyle} placeholder="75001" />
            </div>
            <div className="col-span-2">
              <label style={labelStyle}>Ville</label>
              <input {...register("city")} style={inputStyle} placeholder="Paris" />
            </div>
          </div>

          {/* Status */}
          <div>
            <label style={labelStyle}>Statut</label>
            <select {...register("status")} style={inputStyle}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Error */}
          {(create.error || update.error) && (
            <p style={{ fontSize: 13, color: S.red }}>Une erreur est survenue, veuillez réessayer.</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: `1px solid ${S.border}`,
                background: S.surface,
                color: S.text2,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2"
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                background: S.orange,
                color: "#fff",
                border: "none",
                fontSize: 14,
                fontWeight: 500,
                cursor: isPending ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {company ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function CompanyRow({ company, onEdit }: { company: Company; onEdit: () => void }) {
  return (
    <tr
      onClick={onEdit}
      style={{ cursor: "pointer", borderBottom: `1px solid ${S.border}` }}
    >
      <td style={{ padding: "16px 24px" }}>
        <div className="flex items-center gap-3">
          <div style={{ display: "flex", height: 36, width: 36, alignItems: "center", justifyContent: "center", borderRadius: 10, background: S.orangeBg }}>
            <Building className="h-4 w-4" style={{ color: S.orange }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: S.text }}>{company.name}</p>
            {company.vat_number && (
              <p style={{ fontSize: 12, color: S.text3 }}>TVA: {company.vat_number}</p>
            )}
          </div>
        </div>
      </td>
      <td style={{ padding: "16px 24px", fontSize: 14, color: S.text2 }}>
        {company.siret ?? <span style={{ color: S.surface2 }}>—</span>}
      </td>
      <td style={{ padding: "16px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {company.email && (
            <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: S.text2 }}>
              <Mail className="h-3 w-3" style={{ color: S.text3 }} />
              {company.email}
            </div>
          )}
          {company.phone && (
            <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: S.text2 }}>
              <Phone className="h-3 w-3" style={{ color: S.text3 }} />
              {company.phone}
            </div>
          )}
        </div>
      </td>
      <td style={{ padding: "16px 24px", fontSize: 14, color: S.text2 }}>
        {company.city ? (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" style={{ color: S.text3 }} />
            {company.city}
          </div>
        ) : (
          <span style={{ color: S.surface2 }}>—</span>
        )}
      </td>
      <td style={{ padding: "16px 24px" }}>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          borderRadius: 999,
          padding: "2px 10px",
          fontSize: 12,
          fontWeight: 500,
          background: company.status === "active" ? S.greenBg : S.surface2,
          color: company.status === "active" ? S.green : S.text3,
        }}>
          {company.status === "active" ? "Active" : "Inactive"}
        </span>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const { data: companies, isLoading } = useCompanies();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ open: boolean; company?: Company }>({ open: false });

  const filtered = (companies ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.city ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      {modal.open && (
        <CompanyModal
          company={modal.company}
          onClose={() => setModal({ open: false })}
        />
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontWeight: 400, fontSize: 28, color: S.text, margin: 0 }}>
            Sociétés
          </h1>
          <p style={{ marginTop: 4, fontSize: 13, color: S.text3 }}>
            {companies?.length ?? 0} société{(companies?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className="flex items-center gap-2"
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            background: S.orange,
            color: "#fff",
            border: "none",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Plus className="h-4 w-4" />
          Ajouter une société
        </button>
      </div>

      {/* Search */}
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, boxShadow: S.shadow, padding: 12, marginBottom: 16 }}>
        <div style={{ position: "relative" }}>
          <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: S.text3, width: 16, height: 16 }} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou ville..."
            style={{ ...inputStyle, paddingLeft: 40 }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, boxShadow: S.shadow, overflow: "hidden" }}>
        <table className="w-full">
          <thead style={{ borderBottom: `1px solid ${S.border}`, background: S.surface2 }}>
            <tr>
              {["Société", "SIRET", "Contact", "Ville", "Statut"].map((h) => (
                <th
                  key={h}
                  style={{ padding: "12px 24px", textAlign: "left", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: S.text3 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} style={{ padding: "64px 24px", textAlign: "center" }}>
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" style={{ color: S.text3 }} />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "64px 24px", textAlign: "center", fontSize: 14, color: S.text3 }}>
                  {search ? `Aucun résultat pour « ${search} »` : "Aucune société — ajoutez-en une."}
                </td>
              </tr>
            ) : (
              filtered.map((company) => (
                <CompanyRow
                  key={company.id}
                  company={company}
                  onEdit={() => setModal({ open: true, company })}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
