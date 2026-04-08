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
  // Extended
  building_name: string;
  unit_number: string;
  bedrooms: string;
  bathrooms: string;
  canton: string;
  keys_count: string;
  tourist_tax_amount: string;
  nearby_landmarks: string;
  has_balcony: boolean;
  has_terrace: boolean;
  has_garden: boolean;
  has_storage: boolean;
  has_fireplace: boolean;
  has_laundry: boolean;
  linen_provided: boolean;
  smoking_allowed: boolean;
}

const INITIAL: FormData = {
  type: "apartment",
  status: "available",
  address: "",
  city: "",
  zip_code: "",
  country: "CH",
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
  // Extended
  building_name: "",
  unit_number: "",
  bedrooms: "",
  bathrooms: "",
  canton: "VS",
  keys_count: "3",
  tourist_tax_amount: "",
  nearby_landmarks: "",
  has_balcony: false,
  has_terrace: false,
  has_garden: false,
  has_storage: false,
  has_fireplace: false,
  has_laundry: false,
  linen_provided: false,
  smoking_allowed: false,
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
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors"
              style={
                step.id < current
                  ? { background: S.orange, color: "#fff" }
                  : step.id === current
                  ? { border: `2px solid ${S.orange}`, background: S.surface, color: S.orange }
                  : { border: `2px solid ${S.border}`, background: S.surface, color: S.text3 }
              }
            >
              {step.id < current ? <Check className="h-4 w-4" /> : step.id}
            </div>
            <span
              className="text-xs font-medium"
              style={{ color: step.id === current ? S.orange : S.text3 }}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="mb-4 flex-1 border-t-2"
              style={{ borderColor: step.id < current ? S.orange : S.border }}
            />
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
        <label className="mb-2 block text-sm font-medium" style={{ color: S.text2 }}>Type de bien</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {TYPES.map(([val, label]) => (
            <label
              key={val}
              className="relative flex cursor-pointer flex-col items-center gap-1 rounded-lg p-3 text-center transition-colors"
              style={
                data.type === val
                  ? { border: `1px solid ${S.orange}`, background: S.orangeBg }
                  : { border: `1px solid ${S.border}`, background: S.surface }
              }
            >
              <input
                type="radio"
                name="type"
                value={val}
                checked={data.type === val}
                onChange={() => onChange({ type: val })}
                className="sr-only"
              />
              <Home className="h-5 w-5" style={{ color: data.type === val ? S.orange : S.text3 }} />
              <span className="text-xs font-medium" style={{ color: data.type === val ? S.orange : S.text2 }}>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Location */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>Adresse *</label>
          <input
            type="text"
            value={data.address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="12 rue de la Paix"
            className={`input ${errors.address ? "border-red-400" : ""}`}
          />
          {errors.address && <p className="mt-1 text-xs" style={{ color: S.red }}>{errors.address}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>Ville *</label>
          <input
            type="text"
            value={data.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="Paris"
            className={`input ${errors.city ? "border-red-400" : ""}`}
          />
          {errors.city && <p className="mt-1 text-xs" style={{ color: S.red }}>{errors.city}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>Code postal *</label>
          <input
            type="text"
            value={data.zip_code}
            onChange={(e) => onChange({ zip_code: e.target.value })}
            placeholder="75001"
            className={`input ${errors.zip_code ? "border-red-400" : ""}`}
          />
          {errors.zip_code && <p className="mt-1 text-xs" style={{ color: S.red }}>{errors.zip_code}</p>}
        </div>
      </div>

      {/* Building details */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>Nom de la résidence</label>
          <input type="text" value={data.building_name} onChange={(e) => onChange({ building_name: e.target.value })} placeholder="Les Acacias" className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>N° d'appartement</label>
          <input type="text" value={data.unit_number} onChange={(e) => onChange({ unit_number: e.target.value })} placeholder="3B" className="input" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>Canton</label>
          <select value={data.canton} onChange={(e) => onChange({ canton: e.target.value })} className="input">
            {["VS","VD","GE","BE","FR","NE","JU","TI","ZH","BS","BL","AG","SO","LU","ZG","SG","TG","SH","AR","AI","GL","GR","OW","NW","UR","SZ","ER"].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Specs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { key: "surface", label: "Surface (m²)", placeholder: "65" },
          { key: "rooms", label: "Pièces", placeholder: "3" },
          { key: "bedrooms", label: "Chambres", placeholder: "2" },
          { key: "bathrooms", label: "SDB", placeholder: "1" },
          { key: "floor", label: "Étage", placeholder: "2" },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>{label}</label>
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
        <label className="mb-2 block text-sm font-medium" style={{ color: S.text2 }}>Situation financière</label>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { key: "monthly_rent", label: "Loyer mensuel (CHF)" },
            { key: "charges", label: "Charges (CHF/mois)" },
            { key: "deposit", label: "Dépôt de garantie (CHF)" },
            { key: "price_sale", label: "Prix de vente (CHF)" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="mb-1 block text-xs" style={{ color: S.text3 }}>{label}</label>
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

      {/* Additional financial */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>Taxe de séjour (CHF/nuit)</label>
          <input type="number" value={data.tourist_tax_amount} onChange={(e) => onChange({ tourist_tax_amount: e.target.value })} placeholder="0.00" className="input" min={0} step="0.01" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>Nombre de clés</label>
          <input type="number" value={data.keys_count} onChange={(e) => onChange({ keys_count: e.target.value })} placeholder="3" className="input" min={1} />
        </div>
      </div>

      {/* Options */}
      <div>
        <label className="mb-2 block text-sm font-medium" style={{ color: S.text2 }}>Caractéristiques</label>
        <div className="flex flex-wrap gap-4">
          {[
            { key: "is_furnished", label: "Meublé" },
            { key: "has_parking", label: "Parking" },
            { key: "has_balcony", label: "Balcon" },
            { key: "has_terrace", label: "Terrasse" },
            { key: "has_garden", label: "Jardin" },
            { key: "has_storage", label: "Cave/réduit" },
            { key: "has_fireplace", label: "Cheminée" },
            { key: "has_laundry", label: "Buanderie" },
            { key: "linen_provided", label: "Linge fourni" },
            { key: "pets_allowed", label: "Animaux acceptés" },
            { key: "smoking_allowed", label: "Fumeurs acceptés" },
          ].map(({ key, label }) => (
            <label key={key} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={data[key as keyof FormData] as boolean}
                onChange={(e) => onChange({ [key]: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 accent-orange-600"
              />
              <span className="text-sm" style={{ color: S.text2 }}>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Nearby */}
      <div>
        <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>A proximité (commodités, transports…)</label>
        <input type="text" value={data.nearby_landmarks} onChange={(e) => onChange({ nearby_landmarks: e.target.value })} placeholder="Ski, téléphérique, commerces, école…" className="input" />
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
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-12"
        style={{ borderColor: S.border }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
      >
        <ImagePlus className="mb-3 h-10 w-10" style={{ color: S.text3 }} />
        <p className="text-sm font-medium" style={{ color: S.text2 }}>Glissez vos photos ici</p>
        <p className="text-xs" style={{ color: S.text3 }}>ou cliquez pour parcourir (JPG, PNG, WebP)</p>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {files.map((file, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-lg" style={{ background: S.surface2 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span
                  className="absolute bottom-0 left-0 right-0 py-0.5 text-center text-xs text-white"
                  style={{ background: `${S.amber}e6` }}
                >
                  Couverture
                </span>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(files.filter((_, j) => j !== i)); }}
                className="absolute right-1 top-1 hidden rounded-full p-0.5 group-hover:block"
                style={{ background: "rgba(255,255,255,0.8)", color: S.red }}
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
        <div
          className="rounded-xl border-2 border-dashed py-12 text-center"
          style={{ borderColor: S.border }}
        >
          <FileText className="mx-auto mb-2 h-8 w-8" style={{ color: S.text3 }} />
          <p className="text-sm" style={{ color: S.text3 }}>Aucun document (optionnel)</p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl" style={{ border: `1px solid ${S.border}` }}>
          {docs.map((d, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" style={{ color: S.text3 }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: S.text }}>{d.file.name}</p>
                  <p className="text-xs" style={{ color: S.text3 }}>{DOC_TYPES.find((t) => t.value === d.type)?.label}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange(docs.filter((_, j) => j !== i))}
                style={{ color: S.text3 }}
                className="hover:text-red-500"
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
      <div className="rounded-xl divide-y" style={{ border: `1px solid ${S.border}` }}>
        {[
          ["Type", PROPERTY_TYPE_LABELS[data.type]],
          ["Canton", data.canton],
          ["Adresse", `${data.address}, ${data.zip_code} ${data.city}`],
          ["Résidence / App.", [data.building_name, data.unit_number].filter(Boolean).join(" — ") || "—"],
          ["Surface", data.surface ? `${data.surface} m²` : "—"],
          ["Pièces / Chambres", [data.rooms, data.bedrooms].filter(Boolean).join(" pièces / ") + (data.bedrooms ? " ch." : "") || "—"],
          ["Loyer", data.monthly_rent ? `${data.monthly_rent} CHF/mois` : "—"],
          ["Prix de vente", data.price_sale ? `${data.price_sale} CHF` : "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between px-4 py-3 text-sm">
            <span style={{ color: S.text3 }}>{label}</span>
            <span className="font-medium" style={{ color: S.text }}>{value}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 text-sm" style={{ color: S.text2 }}>
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
        // Extended
        building_name: formData.building_name || null,
        unit_number: formData.unit_number || null,
        bedrooms: formData.bedrooms ? Number(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? Number(formData.bathrooms) : null,
        canton: formData.canton || "VS",
        keys_count: formData.keys_count ? Number(formData.keys_count) : 3,
        tourist_tax_amount: formData.tourist_tax_amount ? Number(formData.tourist_tax_amount) : null,
        nearby_landmarks: formData.nearby_landmarks || null,
        has_balcony: formData.has_balcony,
        has_terrace: formData.has_terrace,
        has_garden: formData.has_garden,
        has_storage: formData.has_storage,
        has_fireplace: formData.has_fireplace,
        has_laundry: formData.has_laundry,
        linen_provided: formData.linen_provided,
        smoking_allowed: formData.smoking_allowed,
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

      router.push(`/app/properties/${propertyId}`);
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
        <button onClick={() => router.back()} style={{ color: S.text3 }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontWeight: 400, fontSize: 24, color: S.text }}>
            Ajouter un bien
          </h1>
          <p className="text-sm" style={{ color: S.text3 }}>Étape {step} sur 4</p>
        </div>
      </div>

      <StepBar current={step} />

      {/* Step content */}
      <div
        className="p-6"
        style={{
          background: S.surface,
          border: `1px solid ${S.border}`,
          borderRadius: 14,
          boxShadow: S.shadow,
        }}
      >
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
          <div
            className="mt-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm"
            style={{ border: `1px solid ${S.red}`, background: S.redBg, color: S.red }}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {serverError}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={back}
              className="btn-secondary flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Précédent
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              onClick={next}
              className="btn-primary flex items-center gap-1"
              style={{ background: S.orange, color: "#fff" }}
            >
              Suivant
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={publish}
              disabled={isPublishing}
              className="btn-primary flex items-center gap-2 disabled:opacity-60"
              style={{ background: S.orange, color: "#fff" }}
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
