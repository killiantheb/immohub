"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Home,
  ImagePlus,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useCreateProperty, useUploadDocument, useUploadImage } from "@/lib/hooks/useProperties";
import { PROPERTY_TYPE_LABELS } from "@/lib/constants/properties";
import type { PropertyType } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormData {
  type: PropertyType;
  status: "available" | "rented" | "for_sale";
  address: string;
  city: string;
  zip_code: string;
  country: string;
  surface: string;
  rooms: string;
  floor: string;
  monthly_rent: string;
  charges: string;
  deposit: string;
  price_sale: string;
  description: string;
  is_furnished: boolean;
  has_parking: boolean;
  pets_allowed: boolean;
}

const INITIAL: FormData = {
  type: "apartment",
  status: "available",
  address: "",
  city: "",
  zip_code: "",
  country: "FR",
  surface: "",
  rooms: "",
  floor: "",
  monthly_rent: "",
  charges: "",
  deposit: "",
  price_sale: "",
  description: "",
  is_furnished: false,
  has_parking: false,
  pets_allowed: false,
};

// ── Step indicators ───────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Informations" },
  { id: 2, label: "Photos" },
  { id: 3, label: "Documents" },
  { id: 4, label: "Publication" },
];

function StepBar({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center gap-0">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                step.id < current
                  ? "bg-primary-600 text-white"
                  : step.id === current
                  ? "border-2 border-primary-600 bg-white text-primary-600"
                  : "border-2 border-gray-200 bg-white text-gray-400"
              }`}
            >
              {step.id < current ? <Check className="h-4 w-4" /> : step.id}
            </div>
            <span className={`text-xs font-medium ${step.id === current ? "text-primary-600" : "text-gray-400"}`}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`mb-4 flex-1 border-t-2 ${step.id < current ? "border-primary-600" : "border-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1 — Informations ─────────────────────────────────────────────────────

function Step1({
  data,
  onChange,
  errors,
}: {
  data: FormData;
  onChange: (d: Partial<FormData>) => void;
  errors: Partial<Record<keyof FormData, string>>;
}) {
  const TYPES = Object.entries(PROPERTY_TYPE_LABELS) as [PropertyType, string][];

  return (
    <div className="space-y-6">
      {/* Type */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Type de bien</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {TYPES.map(([val, label]) => (
            <label
              key={val}
              className="relative flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-3 text-center hover:border-primary-400 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50"
            >
              <input
                type="radio"
                name="type"
                value={val}
                checked={data.type === val}
                onChange={() => onChange({ type: val })}
                className="sr-only"
              />
              <Home className="h-5 w-5 text-gray-500" />
              <span className="text-xs font-medium">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Location */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Adresse *</label>
          <input
            type="text"
            value={data.address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="12 rue de la Paix"
            className={`input ${errors.address ? "border-red-400" : ""}`}
          />
          {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Ville *</label>
          <input
            type="text"
            value={data.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="Paris"
            className={`input ${errors.city ? "border-red-400" : ""}`}
          />
          {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Code postal *</label>
          <input
            type="text"
            value={data.zip_code}
            onChange={(e) => onChange({ zip_code: e.target.value })}
            placeholder="75001"
            className={`input ${errors.zip_code ? "border-red-400" : ""}`}
          />
          {errors.zip_code && <p className="mt-1 text-xs text-red-500">{errors.zip_code}</p>}
        </div>
      </div>

      {/* Specs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { key: "surface", label: "Surface (m²)", placeholder: "65" },
          { key: "rooms", label: "Pièces", placeholder: "3" },
          { key: "floor", label: "Étage", placeholder: "2" },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
            <input
              type="number"
              value={data[key as keyof FormData] as string}
              onChange={(e) => onChange({ [key]: e.target.value })}
              placeholder={placeholder}
              className="input"
              min={0}
            />
          </div>
        ))}
      </div>

      {/* Financial */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Situation financière</label>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { key: "monthly_rent", label: "Loyer mensuel (€)" },
            { key: "charges", label: "Charges (€/mois)" },
            { key: "deposit", label: "Dépôt de garantie (€)" },
            { key: "price_sale", label: "Prix de vente (€)" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="mb-1 block text-xs text-gray-500">{label}</label>
              <input
                type="number"
                value={data[key as keyof FormData] as string}
                onChange={(e) => onChange({ [key]: e.target.value })}
                placeholder="0"
                className="input"
                min={0}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="flex flex-wrap gap-4">
        {[
          { key: "is_furnished", label: "Meublé" },
          { key: "has_parking", label: "Parking inclus" },
          { key: "pets_allowed", label: "Animaux acceptés" },
        ].map(({ key, label }) => (
          <label key={key} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={data[key as keyof FormData] as boolean}
              onChange={(e) => onChange({ [key]: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 accent-primary-600"
            />
            <span className="text-sm text-gray-700">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Step 2 — Photos ───────────────────────────────────────────────────────────

function Step2({
  files,
  onChange,
}: {
  files: File[];
  onChange: (f: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles).filter((f) => f.type.startsWith("image/"));
    onChange([...files, ...arr]);
  };

  return (
    <div className="space-y-4">
      <div
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 hover:border-primary-300 hover:bg-primary-50/30"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
      >
        <ImagePlus className="mb-3 h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium text-gray-600">Glissez vos photos ici</p>
        <p className="text-xs text-gray-400">ou cliquez pour parcourir (JPG, PNG, WebP)</p>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {files.map((file, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 bg-amber-400/90 py-0.5 text-center text-xs text-white">
                  Couverture
                </span>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(files.filter((_, j) => j !== i)); }}
                className="absolute right-1 top-1 hidden rounded-full bg-white/80 p-0.5 text-red-500 group-hover:block"
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

// ── Step 3 — Documents ────────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: "lease", label: "Bail" },
  { value: "inventory", label: "État des lieux" },
  { value: "insurance", label: "Assurance" },
  { value: "diagnosis", label: "Diagnostic" },
  { value: "deed", label: "Acte" },
  { value: "other", label: "Autre" },
];

function Step3({
  docs,
  onChange,
}: {
  docs: { file: File; type: string }[];
  onChange: (d: { file: File; type: string }[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingType, setPendingType] = useState("other");

  const addFile = (f: File | undefined) => {
    if (!f) return;
    onChange([...docs, { file: f, type: pendingType }]);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select
          value={pendingType}
          onChange={(e) => setPendingType(e.target.value)}
          className="input w-auto"
        >
          {DOC_TYPES.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn-secondary flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          Ajouter un document
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/jpeg,image/png"
          className="hidden"
          onChange={(e) => { addFile(e.target.files?.[0]); e.target.value = ""; }}
        />
      </div>

      {docs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">Aucun document (optionnel)</p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border border-gray-200">
          {docs.map((d, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{d.file.name}</p>
                  <p className="text-xs text-gray-400">{DOC_TYPES.find((t) => t.value === d.type)?.label}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange(docs.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Step 4 — Récapitulatif ────────────────────────────────────────────────────

function Step4({
  data,
  images,
  docs,
}: {
  data: FormData;
  images: File[];
  docs: { file: File; type: string }[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 divide-y">
        {[
          ["Type", PROPERTY_TYPE_LABELS[data.type]],
          ["Adresse", `${data.address}, ${data.zip_code} ${data.city}`],
          ["Surface", data.surface ? `${data.surface} m²` : "—"],
          ["Pièces", data.rooms || "—"],
          ["Loyer", data.monthly_rent ? `${data.monthly_rent} €/mois` : "—"],
          ["Prix de vente", data.price_sale ? `${data.price_sale} €` : "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-gray-900">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-1">
          <ImagePlus className="h-4 w-4" /> {images.length} photo{images.length !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <FileText className="h-4 w-4" /> {docs.length} document{docs.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function NewPropertyPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL);
  const [images, setImages] = useState<File[]>([]);
  const [docs, setDocs] = useState<{ file: File; type: string }[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const createProperty = useCreateProperty();

  // Validate step 1
  const validateStep1 = () => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!formData.address.trim()) errs.address = "Adresse requise";
    if (!formData.city.trim()) errs.city = "Ville requise";
    if (!formData.zip_code.trim()) errs.zip_code = "Code postal requis";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (step === 1 && !validateStep1()) return;
    setStep((s) => Math.min(4, s + 1));
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  const publish = async () => {
    setServerError(null);
    try {
      // 1. Create the property
      const property = await createProperty.mutateAsync({
        type: formData.type,
        status: formData.status,
        address: formData.address,
        city: formData.city,
        zip_code: formData.zip_code,
        country: formData.country,
        surface: formData.surface ? Number(formData.surface) : null,
        rooms: formData.rooms ? Number(formData.rooms) : null,
        floor: formData.floor ? Number(formData.floor) : null,
        description: formData.description || null,
        monthly_rent: formData.monthly_rent ? Number(formData.monthly_rent) : null,
        charges: formData.charges ? Number(formData.charges) : null,
        deposit: formData.deposit ? Number(formData.deposit) : null,
        price_sale: formData.price_sale ? Number(formData.price_sale) : null,
        is_furnished: formData.is_furnished,
        has_parking: formData.has_parking,
        pets_allowed: formData.pets_allowed,
      } as Parameters<typeof createProperty.mutateAsync>[0]);

      const propertyId = property.id;

      // 2. Upload images (sequential to preserve order)
      for (let i = 0; i < images.length; i++) {
        const form = new FormData();
        form.append("file", images[i]);
        form.append("is_cover", String(i === 0));
        await import("@/lib/api").then(({ api }) =>
          api.post(`/properties/${propertyId}/images`, form, {
            headers: { "Content-Type": "multipart/form-data" },
          }),
        );
      }

      // 3. Upload documents
      for (const doc of docs) {
        const form = new FormData();
        form.append("file", doc.file);
        form.append("doc_type", doc.type);
        await import("@/lib/api").then(({ api }) =>
          api.post(`/properties/${propertyId}/documents`, form, {
            headers: { "Content-Type": "multipart/form-data" },
          }),
        );
      }

      router.push(`/properties/${propertyId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail ?? (err as { message?: string })?.message ?? "Erreur lors de la création";
      setServerError(msg);
    }
  };

  const isPublishing = createProperty.isPending;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ajouter un bien</h1>
          <p className="text-sm text-gray-500">Étape {step} sur 4</p>
        </div>
      </div>

      <StepBar current={step} />

      {/* Step content */}
      <div className="card p-6">
        {step === 1 && (
          <Step1
            data={formData}
            onChange={(d) => setFormData((prev) => ({ ...prev, ...d }))}
            errors={errors}
          />
        )}
        {step === 2 && <Step2 files={images} onChange={setImages} />}
        {step === 3 && <Step3 docs={docs} onChange={setDocs} />}
        {step === 4 && <Step4 data={formData} images={images} docs={docs} />}

        {/* Server error */}
        {serverError && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {serverError}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          {step > 1 ? (
            <button onClick={back} className="btn-secondary flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Précédent
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button onClick={next} className="btn-primary flex items-center gap-1">
              Suivant
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={publish}
              disabled={isPublishing}
              className="btn-primary flex items-center gap-2 disabled:opacity-60"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publication…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Publier le bien
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
