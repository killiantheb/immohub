"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Clock,
  FileText,
  Home,
  ImagePlus,
  Loader2,
  MapPin,
  Pencil,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useDeleteImage,
  useDeleteProperty,
  useGenerateDescription,
  useProperty,
  useUpdateProperty,
  useUploadDocument,
  useUploadImage,
} from "@/lib/hooks/useProperties";
import {
  PROPERTY_STATUS_COLORS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
} from "@/lib/constants/properties";
import type { PropertyStatus, PropertyType } from "@/lib/types";

// ── Inline edit field ──────────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  onSave,
  type = "text",
}: {
  label: string;
  value: string | number | null | undefined;
  onSave: (v: string) => void;
  type?: "text" | "number" | "textarea";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));

  const save = () => {
    onSave(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-1">
        <label className="text-xs text-gray-500">{label}</label>
        {type === "textarea" ? (
          <textarea
            className="input min-h-24 w-full resize-y text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
        ) : (
          <input
            type={type}
            className="input w-full text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
        )}
        <div className="flex gap-2">
          <button onClick={save} className="btn-primary py-1 text-xs">Enregistrer</button>
          <button onClick={() => setEditing(false)} className="btn-secondary py-1 text-xs">Annuler</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group flex cursor-pointer items-start justify-between gap-2 rounded-md p-1 hover:bg-gray-50"
      onClick={() => { setDraft(String(value ?? "")); setEditing(true); }}
    >
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-medium text-gray-900">{value ?? <span className="italic text-gray-400">—</span>}</p>
      </div>
      <Pencil className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-300 opacity-0 group-hover:opacity-100" />
    </div>
  );
}

// ── Images gallery ────────────────────────────────────────────────────────────

function ImagesSection({ propertyId }: { propertyId: string }) {
  const { data: property } = useProperty(propertyId);
  const uploadImage = useUploadImage(propertyId);
  const deleteImage = useDeleteImage(propertyId);
  const inputRef = useRef<HTMLInputElement>(null);

  const images = property?.images ?? [];

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Photos</h2>
        <button
          onClick={() => inputRef.current?.click()}
          className="btn-secondary flex items-center gap-1 text-sm"
        >
          <ImagePlus className="h-4 w-4" />
          Ajouter
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadImage.mutate({ file, isCover: images.length === 0 });
            e.target.value = "";
          }}
        />
      </div>

      {uploadImage.isPending && (
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Upload en cours…
        </div>
      )}

      {images.length === 0 ? (
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-10 hover:border-primary-300 hover:bg-primary-50/30"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">Cliquez pour ajouter des photos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((img) => (
            <div key={img.id} className="group relative aspect-video overflow-hidden rounded-lg bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              {img.is_cover && (
                <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-amber-400/90 px-1.5 py-0.5 text-xs font-medium text-white">
                  <Star className="h-3 w-3" /> Couverture
                </span>
              )}
              <button
                onClick={() => deleteImage.mutate(img.id)}
                className="absolute right-1 top-1 hidden rounded-full bg-white/80 p-1 text-red-500 hover:bg-white group-hover:block"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Documents section ─────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  lease: "Bail", inventory: "État des lieux", insurance: "Assurance",
  notice: "Préavis", deed: "Acte", diagnosis: "Diagnostic", other: "Autre",
};

function DocumentsSection({ propertyId }: { propertyId: string }) {
  const { data: property } = useProperty(propertyId);
  const uploadDoc = useUploadDocument(propertyId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("other");

  const docs = property?.documents ?? [];

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center gap-2 justify-between">
        <h2 className="text-lg font-semibold">Documents</h2>
        <div className="flex gap-2">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="input w-auto text-sm"
          >
            {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button
            onClick={() => inputRef.current?.click()}
            className="btn-secondary flex items-center gap-1 text-sm"
          >
            <Upload className="h-4 w-4" />
            Ajouter
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadDoc.mutate({ file, docType });
            e.target.value = "";
          }}
        />
      </div>

      {uploadDoc.isPending && (
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Upload en cours…
        </div>
      )}

      {docs.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Aucun document</p>
      ) : (
        <ul className="divide-y">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{doc.name}</p>
                  <p className="text-xs text-gray-400">{DOC_TYPE_LABELS[doc.type] ?? doc.type}</p>
                </div>
              </div>
              <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">
                Voir
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── History tab ───────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  create: "Création", update: "Modification", delete: "Suppression",
  ai_description: "Description IA générée",
};

function HistorySection({ propertyId }: { propertyId: string }) {
  const { data: history, isLoading } = usePropertyHistory(propertyId);

  if (isLoading) return <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>;

  return (
    <div className="card">
      <h2 className="mb-4 text-lg font-semibold">Historique</h2>
      {!history?.length ? (
        <p className="py-4 text-center text-sm text-gray-400">Aucune activité</p>
      ) : (
        <ul className="space-y-3">
          {history.map((log) => (
            <li key={log.id} className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {ACTION_LABELS[log.action] ?? log.action}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(log.created_at).toLocaleString("fr-FR")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// We need a small local query for history since it's not in useProperty
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

function usePropertyHistory(id: string) {
  return useQuery({
    queryKey: ["properties", id, "history"],
    queryFn: async () => {
      const { data } = await api.get(`/properties/${id}/history`);
      return data as Array<{ id: string; action: string; created_at: string }>;
    },
    enabled: Boolean(id),
  });
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = "details" | "images" | "documents" | "history";

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: property, isLoading } = useProperty(id);
  const update = useUpdateProperty(id);
  const deleteProperty = useDeleteProperty();
  const generateDesc = useGenerateDescription(id);
  const [tab, setTab] = useState<Tab>("details");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <Home className="mb-3 h-10 w-10 text-gray-300" />
        <p className="text-gray-600">Bien introuvable</p>
        <button onClick={() => router.back()} className="btn-secondary mt-4">Retour</button>
      </div>
    );
  }

  const save = (field: string) => (val: string) =>
    update.mutate({ [field]: val || null });

  const saveNum = (field: string) => (val: string) =>
    update.mutate({ [field]: val ? Number(val) : null });

  const cover = property.images?.find((i) => i.is_cover) ?? property.images?.[0];

  const TABS: { id: Tab; label: string }[] = [
    { id: "details", label: "Détails" },
    { id: "images", label: `Photos${property.images?.length ? ` (${property.images.length})` : ""}` },
    { id: "documents", label: `Documents${property.documents?.length ? ` (${property.documents.length})` : ""}` },
    { id: "history", label: "Historique" },
  ];

  return (
    <div>
      {/* Back */}
      <Link
        href="/app/properties"
        className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Biens immobiliers
      </Link>

      {/* Hero */}
      <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt="" className="h-56 w-full object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center bg-gray-50">
            <Building2 className="h-16 w-16 text-gray-200" />
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">
                {PROPERTY_TYPE_LABELS[property.type as PropertyType] ?? property.type}
                {property.surface ? ` · ${property.surface} m²` : ""}
              </h1>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PROPERTY_STATUS_COLORS[property.status as PropertyStatus]}`}>
                {PROPERTY_STATUS_LABELS[property.status as PropertyStatus] ?? property.status}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-gray-500">
              <MapPin className="h-4 w-4 shrink-0" />
              {property.address}, {property.zip_code} {property.city}
            </p>
          </div>
          <div className="flex gap-2">
            {confirmDelete ? (
              <>
                <button
                  onClick={async () => {
                    await deleteProperty.mutateAsync(id);
                    router.push("/app/properties");
                  }}
                  className="btn-danger flex items-center gap-1"
                  disabled={deleteProperty.isPending}
                >
                  {deleteProperty.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Confirmer
                </button>
                <button onClick={() => setConfirmDelete(false)} className="btn-secondary">Annuler</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="btn-secondary flex items-center gap-1 text-red-600 hover:border-red-300">
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-primary-600 text-primary-600"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "details" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Core info */}
            <div className="card">
              <h2 className="mb-4 text-base font-semibold text-gray-900">Informations générales</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <EditableField label="Surface (m²)" value={property.surface} onSave={saveNum("surface")} type="number" />
                <EditableField label="Pièces" value={property.rooms} onSave={saveNum("rooms")} type="number" />
                <EditableField label="Étage" value={property.floor} onSave={saveNum("floor")} type="number" />
                <EditableField label="Adresse" value={property.address} onSave={save("address")} />
                <EditableField label="Ville" value={property.city} onSave={save("city")} />
                <EditableField label="Code postal" value={property.zip_code} onSave={save("zip_code")} />
              </div>
            </div>

            {/* Financial */}
            <div className="card">
              <h2 className="mb-4 text-base font-semibold text-gray-900">Finances</h2>
              <div className="grid grid-cols-2 gap-3">
                <EditableField label="Loyer mensuel (€)" value={property.monthly_rent} onSave={saveNum("monthly_rent")} type="number" />
                <EditableField label="Charges (€/mois)" value={property.charges} onSave={saveNum("charges")} type="number" />
                <EditableField label="Dépôt de garantie (€)" value={property.deposit} onSave={saveNum("deposit")} type="number" />
                <EditableField label="Prix de vente (€)" value={property.price_sale} onSave={saveNum("price_sale")} type="number" />
              </div>
            </div>

            {/* Description */}
            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Description</h2>
                <button
                  onClick={() => generateDesc.mutate()}
                  disabled={generateDesc.isPending}
                  className="btn-secondary flex items-center gap-1.5 text-xs"
                >
                  {generateDesc.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  Générer avec l'IA
                </button>
              </div>
              <EditableField
                label="Description"
                value={property.description}
                onSave={save("description")}
                type="textarea"
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Options */}
            <div className="card">
              <h2 className="mb-4 text-base font-semibold text-gray-900">Options</h2>
              <ul className="space-y-2 text-sm">
                {[
                  { key: "is_furnished", label: "Meublé", value: property.is_furnished },
                  { key: "has_parking", label: "Parking", value: property.has_parking },
                  { key: "pets_allowed", label: "Animaux acceptés", value: property.pets_allowed },
                ].map(({ key, label, value }) => (
                  <li key={key} className="flex items-center justify-between">
                    <span className="text-gray-600">{label}</span>
                    <button
                      onClick={() => update.mutate({ [key]: !value })}
                      className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                        value ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {value ? "Oui" : "Non"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Status change */}
            <div className="card">
              <h2 className="mb-3 text-base font-semibold text-gray-900">Statut</h2>
              <select
                value={property.status}
                onChange={(e) => update.mutate({ status: e.target.value as PropertyStatus })}
                className="input w-full"
              >
                {(["available", "rented", "for_sale", "sold", "maintenance"] as PropertyStatus[]).map((s) => (
                  <option key={s} value={s}>{PROPERTY_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* Meta */}
            <div className="card text-xs text-gray-400 space-y-1">
              <p>Créé le {new Date(property.created_at).toLocaleDateString("fr-FR")}</p>
              <p>Modifié le {new Date(property.updated_at).toLocaleDateString("fr-FR")}</p>
            </div>
          </div>
        </div>
      )}

      {tab === "images" && <ImagesSection propertyId={id} />}
      {tab === "documents" && <DocumentsSection propertyId={id} />}
      {tab === "history" && <HistorySection propertyId={id} />}
    </div>
  );
}
