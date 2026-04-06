"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useMyOpenerProfile, usePatchOpenerProfile, useUpsertOpenerProfile } from "@/lib/hooks/useOpeners";

export default function OpenerProfilePage() {
  const { data: profile, isLoading } = useMyOpenerProfile();
  const upsert = useUpsertOpenerProfile();
  const patch = usePatchOpenerProfile();

  const [form, setForm] = useState({
    bio: "",
    radius_km: "20",
    hourly_rate: "",
    latitude: "",
    longitude: "",
    skills: "",
    is_available: true,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        bio: profile.bio ?? "",
        radius_km: profile.radius_km?.toString() ?? "20",
        hourly_rate: profile.hourly_rate?.toString() ?? "",
        latitude: profile.latitude?.toString() ?? "",
        longitude: profile.longitude?.toString() ?? "",
        skills: (profile.skills ?? []).join(", "),
        is_available: profile.is_available,
      });
    }
  }, [profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      bio: form.bio || undefined,
      radius_km: parseFloat(form.radius_km) || 20,
      hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : undefined,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      skills: form.skills
        ? form.skills.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      is_available: form.is_available,
    };

    if (profile) {
      await patch.mutateAsync(payload);
    } else {
      await upsert.mutateAsync(payload);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function useGeoLocation() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setForm((f) => ({
        ...f,
        latitude: pos.coords.latitude.toFixed(6),
        longitude: pos.coords.longitude.toFixed(6),
      }));
    });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const isPending = upsert.isPending || patch.isPending;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/openers" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon profil ouvreur</h1>
          {profile && (
            <p className="text-sm text-gray-500">
              {profile.total_missions} mission{profile.total_missions !== 1 ? "s" : ""} effectuée{profile.total_missions !== 1 ? "s" : ""}
              {profile.rating != null && ` · ⭐ ${profile.rating}/5`}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Availability */}
        <div className="card flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-800">Disponible pour des missions</p>
            <p className="text-sm text-gray-500">Désactivez pour ne plus recevoir de demandes</p>
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, is_available: !f.is_available }))}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              form.is_available ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                form.is_available ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Bio */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Présentation</h2>
          <div>
            <label className="label">Bio</label>
            <textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              className="input resize-none"
              placeholder="Décrivez votre expérience…"
            />
          </div>
          <div>
            <label className="label">Compétences</label>
            <input
              type="text"
              value={form.skills}
              onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
              className="input"
              placeholder="visit, check_in, photography…"
            />
            <p className="mt-1 text-xs text-gray-400">Séparez par des virgules. Valeurs : visit, check_in, check_out, inspection, photography, other</p>
          </div>
        </div>

        {/* Location */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Zone d&apos;intervention</h2>
          <div>
            <label className="label">Rayon d&apos;intervention (km)</label>
            <input
              type="number"
              min="1"
              max="200"
              value={form.radius_km}
              onChange={(e) => setForm((f) => ({ ...f, radius_km: e.target.value }))}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Latitude</label>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                className="input"
                placeholder="48.8566"
              />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                className="input"
                placeholder="2.3522"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={useGeoLocation}
            className="text-sm text-primary-600 hover:underline"
          >
            Utiliser ma position actuelle
          </button>
        </div>

        {/* Rate */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Tarification</h2>
          <div>
            <label className="label">Taux horaire (€/h)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.hourly_rate}
              onChange={(e) => setForm((f) => ({ ...f, hourly_rate: e.target.value }))}
              className="input"
              placeholder="Optionnel — indicatif"
            />
            <p className="mt-1 text-xs text-gray-400">Le prix final est calculé selon le type et la distance de la mission.</p>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-green-600">Profil mis à jour ✓</span>}
          <button type="submit" disabled={isPending} className="btn-primary flex items-center gap-2">
            <Save className="h-4 w-4" />
            {isPending ? "Sauvegarde…" : profile ? "Mettre à jour" : "Créer mon profil"}
          </button>
        </div>

        {(upsert.isError || patch.isError) && (
          <p className="text-sm text-red-600">Une erreur est survenue. Réessayez.</p>
        )}
      </form>
    </div>
  );
}
