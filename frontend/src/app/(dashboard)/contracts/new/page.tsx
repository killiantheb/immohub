"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCreateContract } from "@/lib/hooks/useContracts";
import type { ContractType } from "@/lib/types";

const TYPE_OPTIONS: { value: ContractType; label: string }[] = [
  { value: "long_term",  label: "Longue durée" },
  { value: "seasonal",   label: "Saisonnier" },
  { value: "short_term", label: "Courte durée" },
  { value: "sale",       label: "Vente" },
];

export default function NewContractPage() {
  const router = useRouter();
  const create = useCreateContract();

  const [form, setForm] = useState({
    property_id: "",
    tenant_id: "",
    agency_id: "",
    type: "long_term" as ContractType,
    start_date: "",
    end_date: "",
    monthly_rent: "",
    charges: "",
    deposit: "",
  });

  const set = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      property_id: form.property_id,
      tenant_id: form.tenant_id || undefined,
      agency_id: form.agency_id || undefined,
      type: form.type,
      start_date: new Date(form.start_date).toISOString(),
      end_date: form.end_date ? new Date(form.end_date).toISOString() : undefined,
      monthly_rent: form.monthly_rent ? parseFloat(form.monthly_rent) : undefined,
      charges: form.charges ? parseFloat(form.charges) : undefined,
      deposit: form.deposit ? parseFloat(form.deposit) : undefined,
    });
    router.push("/contracts");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/contracts" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nouveau contrat</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Parties */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Parties</h2>
          <div>
            <label className="label">ID du bien *</label>
            <input
              required
              type="text"
              value={form.property_id}
              onChange={(e) => set("property_id", e.target.value)}
              className="input"
              placeholder="UUID du bien"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">ID du locataire</label>
              <input
                type="text"
                value={form.tenant_id}
                onChange={(e) => set("tenant_id", e.target.value)}
                className="input"
                placeholder="UUID (optionnel)"
              />
            </div>
            <div>
              <label className="label">ID de l&apos;agence</label>
              <input
                type="text"
                value={form.agency_id}
                onChange={(e) => set("agency_id", e.target.value)}
                className="input"
                placeholder="UUID (optionnel)"
              />
            </div>
          </div>
        </div>

        {/* Contract terms */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Conditions</h2>
          <div>
            <label className="label">Type de contrat *</label>
            <select
              required
              value={form.type}
              onChange={(e) => set("type", e.target.value as ContractType)}
              className="input"
            >
              {TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date de début *</label>
              <input
                required
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Date de fin</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Financials */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Finances</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Loyer mensuel (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_rent}
                onChange={(e) => set("monthly_rent", e.target.value)}
                className="input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label">Charges (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.charges}
                onChange={(e) => set("charges", e.target.value)}
                className="input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label">Dépôt de garantie (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.deposit}
                onChange={(e) => set("deposit", e.target.value)}
                className="input"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/contracts" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={create.isPending} className="btn-primary">
            {create.isPending ? "Création…" : "Créer le contrat"}
          </button>
        </div>

        {create.isError && (
          <p className="text-sm text-red-600">Une erreur est survenue. Vérifiez les informations.</p>
        )}
      </form>
    </div>
  );
}
