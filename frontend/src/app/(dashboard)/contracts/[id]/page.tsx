"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  FileDown,
  PenLine,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  useContract,
  useDeleteContract,
  useSignContract,
  useUpdateContract,
} from "@/lib/hooks/useContracts";
import type { ContractStatus, ContractType } from "@/lib/types";

const TYPE_LABELS: Record<ContractType, string> = {
  long_term:  "Longue durée",
  seasonal:   "Saisonnier",
  short_term: "Courte durée",
  sale:       "Vente",
};

const STATUS_CONFIG: Record<ContractStatus, { label: string; className: string }> = {
  draft:      { label: "Brouillon", className: "bg-gray-100 text-gray-600" },
  active:     { label: "Actif",     className: "bg-green-100 text-green-700" },
  terminated: { label: "Résilié",   className: "bg-orange-100 text-orange-700" },
  expired:    { label: "Expiré",    className: "bg-red-100 text-red-600" },
};

function fmt(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR");
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: contract, isLoading, isError } = useContract(id);
  const update = useUpdateContract(id);
  const deleteContract = useDeleteContract();
  const sign = useSignContract(id);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    monthly_rent: "",
    charges: "",
    deposit: "",
    end_date: "",
    status: "" as ContractStatus | "",
  });

  useEffect(() => {
    if (contract) {
      setForm({
        monthly_rent: contract.monthly_rent?.toString() ?? "",
        charges: contract.charges?.toString() ?? "",
        deposit: contract.deposit?.toString() ?? "",
        end_date: contract.end_date ? contract.end_date.slice(0, 10) : "",
        status: contract.status as ContractStatus,
      });
    }
  }, [contract]);

  async function handleSave() {
    await update.mutateAsync({
      monthly_rent: form.monthly_rent ? parseFloat(form.monthly_rent) : undefined,
      charges: form.charges ? parseFloat(form.charges) : undefined,
      deposit: form.deposit ? parseFloat(form.deposit) : undefined,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : undefined,
      status: (form.status || undefined) as ContractStatus | undefined,
    });
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm("Supprimer ce contrat ?")) return;
    await deleteContract.mutateAsync(id);
    router.push("/contracts");
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (isError || !contract) {
    return (
      <div className="card py-20 text-center text-gray-500">
        Contrat introuvable.{" "}
        <Link href="/contracts" className="text-primary-600 hover:underline">Retour</Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[contract.status as ContractStatus] ?? { label: contract.status, className: "bg-gray-100 text-gray-600" };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/contracts" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{contract.reference}</h1>
          <p className="text-sm text-gray-500">
            {TYPE_LABELS[contract.type as ContractType] ?? contract.type}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusCfg.className}`}>
          {statusCfg.label}
        </span>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <button
                onClick={() => setEditing(true)}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                <PenLine className="h-4 w-4" /> Modifier
              </button>
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL}/contracts/${id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                <FileDown className="h-4 w-4" /> PDF
              </a>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={update.isPending}
                className="btn-primary flex items-center gap-1.5 text-sm"
              >
                <Save className="h-4 w-4" />
                {update.isPending ? "Sauvegarde…" : "Sauvegarder"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                <X className="h-4 w-4" /> Annuler
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Parties */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Parties</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Bien</dt>
              <dd className="font-mono text-xs text-primary-600">{contract.property_id.slice(0, 8)}…</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Propriétaire</dt>
              <dd className="font-mono text-xs">{contract.owner_id.slice(0, 8)}…</dd>
            </div>
            {contract.tenant_id && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Locataire</dt>
                <dd className="font-mono text-xs">{contract.tenant_id.slice(0, 8)}…</dd>
              </div>
            )}
            {contract.agency_id && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Agence</dt>
                <dd className="font-mono text-xs">{contract.agency_id.slice(0, 8)}…</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Dates */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Durée</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Début</dt>
              <dd>{fmt(contract.start_date)}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-gray-500">Fin</dt>
              {editing ? (
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="input w-36 text-sm py-1"
                />
              ) : (
                <dd>{fmt(contract.end_date)}</dd>
              )}
            </div>
            {contract.signed_at && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Signé le</dt>
                <dd className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {fmt(contract.signed_at)}
                </dd>
              </div>
            )}
            {editing && (
              <div className="flex justify-between items-center">
                <dt className="text-gray-500">Statut</dt>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ContractStatus }))}
                  className="input w-40 text-sm py-1"
                >
                  {(Object.entries(STATUS_CONFIG) as [ContractStatus, { label: string }][]).map(([v, c]) => (
                    <option key={v} value={v}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}
          </dl>
        </div>

        {/* Finances */}
        <div className="card space-y-3 md:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700">Finances</h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              { label: "Loyer mensuel", field: "monthly_rent" as const, value: contract.monthly_rent },
              { label: "Charges",       field: "charges" as const,      value: contract.charges },
              { label: "Dépôt de garantie", field: "deposit" as const,  value: contract.deposit },
            ].map(({ label, field, value }) => (
              <div key={field}>
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                {editing ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form[field]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="input"
                  />
                ) : (
                  <p className="text-xl font-bold text-gray-900">
                    {value != null ? `${value.toLocaleString("fr-FR")} €` : "—"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signature */}
      {!contract.signed_at && contract.status !== "terminated" && (
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Signature électronique</h2>
          <p className="text-sm text-gray-500 mb-4">
            La signature enregistre votre adresse IP et l&apos;horodatage comme preuve de consentement.
          </p>
          <button
            onClick={() => sign.mutate()}
            disabled={sign.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <PenLine className="h-4 w-4" />
            {sign.isPending ? "Signature…" : "Signer le contrat"}
          </button>
        </div>
      )}

      {/* Danger zone */}
      <div className="rounded-xl border border-red-100 bg-red-50/30 p-6">
        <h2 className="mb-1 text-sm font-semibold text-red-700">Zone de danger</h2>
        <p className="mb-4 text-sm text-gray-500">La suppression est irréversible.</p>
        <button
          onClick={handleDelete}
          disabled={deleteContract.isPending}
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {deleteContract.isPending ? "Suppression…" : "Supprimer le contrat"}
        </button>
      </div>
    </div>
  );
}
