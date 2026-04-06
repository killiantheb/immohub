"use client";

import { useState, useEffect } from "react";
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

const CATEGORIES: { value: RFQCategory; label: string; emoji: string }[] = [
  { value: "plumbing",     label: "Plomberie",      emoji: "🔧" },
  { value: "electricity",  label: "Électricité",    emoji: "⚡" },
  { value: "cleaning",     label: "Nettoyage",      emoji: "🧹" },
  { value: "painting",     label: "Peinture",       emoji: "🖌️" },
  { value: "locksmith",    label: "Serrurerie",     emoji: "🔐" },
  { value: "roofing",      label: "Toiture",        emoji: "🏠" },
  { value: "gardening",    label: "Jardinage",      emoji: "🌿" },
  { value: "masonry",      label: "Maçonnerie",     emoji: "🧱" },
  { value: "hvac",         label: "Climatisation",  emoji: "❄️" },
  { value: "renovation",   label: "Rénovation",     emoji: "🔨" },
  { value: "other",        label: "Autre",          emoji: "📋" },
];

const URGENCIES: { value: RFQUrgency; label: string; color: string }[] = [
  { value: "low",       label: "Non urgent (> 1 mois)",      color: "text-green-600" },
  { value: "medium",    label: "Normal (2-4 semaines)",       color: "text-blue-600" },
  { value: "high",      label: "Urgent (< 2 semaines)",      color: "text-orange-600" },
  { value: "emergency", label: "Urgence (< 48h)",            color: "text-red-600" },
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
        <h1 className="text-2xl font-bold text-gray-900">Nouvel appel d'offre</h1>
        <p className="mt-1 text-sm text-gray-500">
          Décrivez votre besoin et CATHY trouvera les meilleurs prestataires.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Step 1 — Description + AI */}
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            1. Décrivez votre besoin
          </h2>
          <textarea
            {...register("description")}
            rows={4}
            placeholder="Ex : J'ai une fuite sous mon évier de cuisine depuis ce matin, l'eau coule lentement mais régulièrement…"
            className={`input resize-none ${errors.description ? "border-red-400" : ""}`}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>
          )}

          <button
            type="button"
            onClick={handleAIQualify}
            disabled={description.length < 20 || qualify.isPending}
            className="mt-3 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50"
          >
            {qualify.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Qualifier avec l'IA
          </button>

          {aiSuggestion && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <span>
                CATHY a détecté : <strong>{CATEGORIES.find(c => c.value === aiSuggestion.category)?.label}</strong>
                {" · "}confiance {Math.round(aiSuggestion.confidence * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Step 2 — Title */}
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-gray-800">2. Titre</h2>
          <input
            type="text"
            {...register("title")}
            placeholder="Ex : Réparation fuite plomberie cuisine"
            className={`input ${errors.title ? "border-red-400" : ""}`}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>
          )}
        </div>

        {/* Step 3 — Category */}
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-gray-800">3. Catégorie</h2>
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
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium transition-colors ${
                      field.value === c.value
                        ? "border-orange-400 bg-orange-50 text-orange-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-orange-200"
                    }`}
                  >
                    <span className="text-xl">{c.emoji}</span>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          />
        </div>

        {/* Step 4 — Urgency */}
        <div className="card">
          <h2 className="mb-4 text-base font-semibold text-gray-800">4. Urgence</h2>
          <div className="space-y-2">
            {URGENCIES.map((u) => (
              <label
                key={u.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:border-orange-200 has-[:checked]:border-orange-400 has-[:checked]:bg-orange-50"
              >
                <input
                  type="radio"
                  value={u.value}
                  {...register("urgency")}
                  className="accent-orange-600"
                />
                <span className={`text-sm font-medium ${u.color}`}>{u.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Step 5 — Location + Budget + Date */}
        <div className="card space-y-4">
          <h2 className="text-base font-semibold text-gray-800">5. Détails (optionnel)</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Ville</label>
              <input
                type="text"
                {...register("city")}
                placeholder="Paris"
                className="input"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Code postal</label>
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
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Budget min (€)</label>
              <input
                type="number"
                min={0}
                {...register("budget_min", { valueAsNumber: true })}
                placeholder="0"
                className="input"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Budget max (€)</label>
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
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Date souhaitée</label>
            <input
              type="date"
              {...register("scheduled_date")}
              className="input"
            />
          </div>
        </div>

        {serverError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary flex flex-1 items-center justify-center gap-2 py-2.5 disabled:opacity-60"
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
