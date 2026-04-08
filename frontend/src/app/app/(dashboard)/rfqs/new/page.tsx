"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { useCreateRFQ, useQualifyRFQ } from "@/lib/hooks/useRFQ";
import type { RFQCategory, RFQUrgency } from "@/lib/types";

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

const CATEGORIES: { value: RFQCategory; label: string }[] = [
  { value: "plumbing",     label: "Plomberie" },
  { value: "electricity",  label: "Electricite" },
  { value: "cleaning",     label: "Nettoyage" },
  { value: "painting",     label: "Peinture" },
  { value: "locksmith",    label: "Serrurerie" },
  { value: "roofing",      label: "Toiture" },
  { value: "gardening",    label: "Jardinage" },
  { value: "masonry",      label: "Maconnerie" },
  { value: "hvac",         label: "Climatisation" },
  { value: "renovation",   label: "Renovation" },
  { value: "other",        label: "Autre" },
];

const URGENCIES: { value: RFQUrgency; label: string; color: string }[] = [
  { value: "low",       label: "Non urgent (> 1 mois)",   color: S.green },
  { value: "medium",    label: "Normal (2-4 semaines)",    color: S.blue },
  { value: "high",      label: "Urgent (< 2 semaines)",   color: S.orange },
  { value: "emergency", label: "Urgence (< 48h)",         color: S.red },
];

const schema = z.object({
  description: z.string().min(20, "Décrivez votre besoin en au moins 20 caractères"),
  title: z.string().min(5, "Titre requis (5 caractères min)").max(255),
  category: z.enum([
    "plumbing","electricity","cleaning","painting","locksmith",
    "roofing","gardening","masonry","hvac","renovation","other",
  ] as const),
  urgency: z.enum(["low","medium","high","emergency"] as const),
  city: z.string().optional(),
  zip_code: z.string().optional(),
  budget_min: z.number().min(0).optional(),
  budget_max: z.number().min(0).optional(),
  scheduled_date: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const cardStyle = {
  background: S.surface,
  border: `1px solid ${S.border}`,
  borderRadius: 14,
  boxShadow: S.shadow,
  padding: "1.25rem",
} as const;

export default function NewRFQPage() {
  const router = useRouter();
  const createRFQ = useCreateRFQ();
  const qualify = useQualifyRFQ();
  const [aiSuggestion, setAiSuggestion] = useState<{
    category: RFQCategory;
    suggested_title: string;
    urgency: RFQUrgency;
    confidence: number;
  } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { urgency: "medium", category: "renovation" },
  });

  const description = watch("description", "");

  async function handleAIQualify() {
    if (description.length < 20) return;
    try {
      const result = await qualify.mutateAsync(description);
      setAiSuggestion(result);
      setValue("category", result.category);
      setValue("urgency", result.urgency);
      setValue("title", result.suggested_title);
    } catch {
      // silently fail — user can fill manually
    }
  }

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      const rfq = await createRFQ.mutateAsync({
        title: data.title,
        description: data.description,
        category: data.category,
        urgency: data.urgency,
        city: data.city,
        zip_code: data.zip_code,
        budget_min: data.budget_min,
        budget_max: data.budget_max,
        scheduled_date: data.scheduled_date
          ? new Date(data.scheduled_date).toISOString()
          : undefined,
      });
      router.push(`/rfqs/${rfq.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setServerError(msg ?? "Erreur lors de la création");
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6">
        <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontWeight: 400, fontSize: 28, color: S.text }}>
          Nouvel appel d'offre
        </h1>
        <p style={{ marginTop: 4, fontSize: 14, color: S.text3 }}>
          Décrivez votre besoin et CATHY trouvera les meilleurs prestataires.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Step 1 — Description + AI */}
        <div style={cardStyle}>
          <h2 className="mb-4 text-base font-semibold" style={{ color: S.text2 }}>
            1. Décrivez votre besoin
          </h2>
          <textarea
            {...register("description")}
            rows={4}
            placeholder="Ex : J'ai une fuite sous mon évier de cuisine depuis ce matin, l'eau coule lentement mais régulièrement…"
            className={`input resize-none ${errors.description ? "border-red-400" : ""}`}
          />
          {errors.description && (
            <p className="mt-1 text-xs" style={{ color: S.red }}>{errors.description.message}</p>
          )}

          <button
            type="button"
            onClick={handleAIQualify}
            disabled={description.length < 20 || qualify.isPending}
            className="mt-3 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={{ border: `1px solid ${S.orange}`, background: S.orangeBg, color: S.orange }}
          >
            {qualify.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Qualifier avec l'IA
          </button>

          {aiSuggestion && (
            <div
              className="mt-3 flex items-start gap-2 rounded-lg px-4 py-3 text-sm"
              style={{ border: `1px solid ${S.green}`, background: S.greenBg, color: S.green }}
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: S.green }} />
              <span>
                CATHY a détecté : <strong>{CATEGORIES.find(c => c.value === aiSuggestion.category)?.label}</strong>
                {" · "}confiance {Math.round(aiSuggestion.confidence * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Step 2 — Title */}
        <div style={cardStyle}>
          <h2 className="mb-4 text-base font-semibold" style={{ color: S.text2 }}>2. Titre</h2>
          <input
            type="text"
            {...register("title")}
            placeholder="Ex : Réparation fuite plomberie cuisine"
            className={`input ${errors.title ? "border-red-400" : ""}`}
          />
          {errors.title && (
            <p className="mt-1 text-xs" style={{ color: S.red }}>{errors.title.message}</p>
          )}
        </div>

        {/* Step 3 — Category */}
        <div style={cardStyle}>
          <h2 className="mb-4 text-base font-semibold" style={{ color: S.text2 }}>3. Catégorie</h2>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => field.onChange(c.value)}
                    className="flex flex-col items-center gap-1 rounded-lg p-3 text-xs font-medium transition-colors"
                    style={
                      field.value === c.value
                        ? { border: `1px solid ${S.orange}`, background: S.orangeBg, color: S.orange }
                        : { border: `1px solid ${S.border}`, background: S.surface, color: S.text2 }
                    }
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          />
        </div>

        {/* Step 4 — Urgency */}
        <div style={cardStyle}>
          <h2 className="mb-4 text-base font-semibold" style={{ color: S.text2 }}>4. Urgence</h2>
          <div className="space-y-2">
            {URGENCIES.map((u) => (
              <label
                key={u.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg p-3"
                style={{ border: `1px solid ${S.border}`, background: S.surface }}
              >
                <input
                  type="radio"
                  value={u.value}
                  {...register("urgency")}
                  className="accent-orange-600"
                />
                <span className="text-sm font-medium" style={{ color: u.color }}>{u.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Step 5 — Location + Budget + Date */}
        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h2 className="text-base font-semibold" style={{ color: S.text2 }}>5. Détails (optionnel)</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>Ville</label>
              <input
                type="text"
                {...register("city")}
                placeholder="Paris"
                className="input"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>Code postal</label>
              <input
                type="text"
                {...register("zip_code")}
                placeholder="75001"
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>Budget min (€)</label>
              <input
                type="number"
                min={0}
                {...register("budget_min", { valueAsNumber: true })}
                placeholder="0"
                className="input"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>Budget max (€)</label>
              <input
                type="number"
                min={0}
                {...register("budget_max", { valueAsNumber: true })}
                placeholder="1000"
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: S.text2 }}>Date souhaitée</label>
            <input
              type="date"
              {...register("scheduled_date")}
              className="input"
            />
          </div>
        </div>

        {serverError && (
          <div
            className="flex items-start gap-2 rounded-lg px-4 py-3 text-sm"
            style={{ border: `1px solid ${S.red}`, background: S.redBg, color: S.red }}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg px-5 py-2.5 text-sm font-medium"
            style={{ border: `1px solid ${S.border}`, background: S.surface, color: S.text2 }}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary flex flex-1 items-center justify-center gap-2 py-2.5 disabled:opacity-60"
            style={{ background: S.orange, color: "#fff" }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Publication…
              </>
            ) : (
              <>
                Publier l'appel d'offre
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
