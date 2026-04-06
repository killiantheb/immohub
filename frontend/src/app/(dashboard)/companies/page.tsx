"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building, Loader2, Mail, MapPin, Phone, Plus, Search, X } from "lucide-react";
import { useCompanies, useCreateCompany, useUpdateCompany, type Company } from "@/lib/hooks/useCompanies";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {company ? "Modifier la société" : "Ajouter une société"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-5">
          {/* Name */}
          <div>
            <label className="label">Nom de la société *</label>
            <input {...register("name")} className="input" placeholder="SARL Exemple" />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          {/* SIRET + VAT */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">SIRET</label>
              <input {...register("siret")} className="input" placeholder="14 chiffres" maxLength={14} />
              {errors.siret && <p className="mt-1 text-xs text-red-500">{errors.siret.message}</p>}
            </div>
            <div>
              <label className="label">N° TVA</label>
              <input {...register("vat_number")} className="input" placeholder="FR12345678901" />
            </div>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input {...register("email")} type="email" className="input" placeholder="contact@société.fr" />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input {...register("phone")} className="input" placeholder="01 23 45 67 89" />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="label">Adresse</label>
            <input {...register("address")} className="input" placeholder="123 rue de la Paix" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Code postal</label>
              <input {...register("zip_code")} className="input" placeholder="75001" />
            </div>
            <div className="col-span-2">
              <label className="label">Ville</label>
              <input {...register("city")} className="input" placeholder="Paris" />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="label">Statut</label>
            <select {...register("status")} className="input">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Error */}
          {(create.error || update.error) && (
            <p className="text-sm text-red-600">Une erreur est survenue, veuillez réessayer.</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Annuler
            </button>
            <button type="submit" disabled={isPending} className="btn-primary flex items-center gap-2">
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
      className="cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={onEdit}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100">
            <Building className="h-4 w-4 text-primary-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{company.name}</p>
            {company.vat_number && (
              <p className="text-xs text-gray-400">TVA: {company.vat_number}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">
        {company.siret ?? <span className="text-gray-300">—</span>}
      </td>
      <td className="px-6 py-4">
        <div className="space-y-0.5">
          {company.email && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Mail className="h-3 w-3 text-gray-400" />
              {company.email}
            </div>
          )}
          {company.phone && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Phone className="h-3 w-3 text-gray-400" />
              {company.phone}
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">
        {company.city ? (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-gray-400" />
            {company.city}
          </div>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-6 py-4">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            company.status === "active"
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
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
          <h1 className="text-2xl font-bold text-gray-900">Sociétés</h1>
          <p className="mt-1 text-sm text-gray-500">
            {companies?.length ?? 0} société{(companies?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Ajouter une société
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou ville..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              {["Société", "SIRET", "Contact", "Ville", "Statut"].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-gray-500">
                  {search ? "Aucun résultat pour « " + search + " »" : "Aucune société — ajoutez-en une."}
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
