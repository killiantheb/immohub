"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Crosshair, MapPin } from "lucide-react";
import Link from "next/link";
import { useCreateMission, useNearbyOpeners, usePriceEstimate } from "@/lib/hooks/useOpeners";
import { useProperties } from "@/lib/hooks/useProperties";
import type { MissionType } from "@/lib/types";

const TYPE_LABELS: Record<MissionType, string> = {
  visit: "Visite",
  check_in: "Remise de clés",
  check_out: "État des lieux sortant",
  inspection: "Inspection",
  photography: "Photographie",
  other: "Autre",
};

export default function NewMissionPage() {
  const router = useRouter();
  const createMission = useCreateMission();
  const { data: propertiesData } = useProperties({ page: 1, size: 100 });
  const properties = propertiesData?.items ?? [];

  const [form, setForm] = useState({
    property_id: "",
    type: "visit" as MissionType,
    scheduled_at: "",
    notes: "",
    property_lat: "",
    property_lng: "",
    opener_id: "",
  });
  const [geoLoading, setGeoLoading] = useState(false);

  // Auto-fill lat/lng from selected property's address via browser geolocation
  function detectLocation() {
    setGeoLoading(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          property_lat: pos.coords.latitude.toFixed(6),
          property_lng: pos.coords.longitude.toFixed(6),
        }));
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
    );
  }

  // When a property is selected, pre-fill its ID
  function handlePropertyChange(id: string) {
    setForm((f) => ({ ...f, property_id: id }));
  }

  const lat = parseFloat(form.property_lat);
  const lng = parseFloat(form.property_lng);
  const hasCoords = !isNaN(lat) && !isNaN(lng);

  const { data: nearbyOpeners } = useNearbyOpeners(
    hasCoords
      ? { lat, lng, radius_km: 50, mission_type: form.type }
      : { lat: 0, lng: 0 },
  );

  const selectedOpener = nearbyOpeners?.find((o) => o.id === form.opener_id);
  const distance = selectedOpener?.distance_km ?? 0;

  const { data: estimate } = usePriceEstimate(form.type, distance);

  const set = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createMission.mutateAsync({
      property_id: form.property_id,
      type: form.type,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      notes: form.notes || undefined,
      property_lat: hasCoords ? lat : undefined,
      property_lng: hasCoords ? lng : undefined,
      opener_id: form.opener_id || undefined,
    });
    router.push("/app/openers");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/app/openers" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nouvelle mission</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Property */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Bien immobilier</h2>

          {properties.length > 0 ? (
            <div>
              <label className="label">Sélectionner un bien *</label>
              <select
                required
                value={form.property_id}
                onChange={(e) => handlePropertyChange(e.target.value)}
                className="input"
              >
                <option value="">— Choisir un bien —</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.address}, {p.city} ({p.type})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Aucun bien trouvé.{" "}
              <Link href="/app/properties/new" className="font-medium underline">
                Créez un bien d&apos;abord
              </Link>
            </div>
          )}

          {/* Coordinates */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="label mb-0 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> Coordonnées GPS
              </label>
              <button
                type="button"
                onClick={detectLocation}
                disabled={geoLoading}
                className="flex items-center gap-1 text-xs text-primary-600 hover:underline disabled:opacity-50"
              >
                <Crosshair className="h-3.5 w-3.5" />
                {geoLoading ? "Localisation…" : "Utiliser ma position"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                step="any"
                value={form.property_lat}
                onChange={(e) => set("property_lat", e.target.value)}
                className="input"
                placeholder="Latitude (ex: 48.8566)"
              />
              <input
                type="number"
                step="any"
                value={form.property_lng}
                onChange={(e) => set("property_lng", e.target.value)}
                className="input"
                placeholder="Longitude (ex: 2.3522)"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Optionnel — permet de trouver les ouvreurs proches et d&apos;estimer le prix.
            </p>
          </div>
        </div>

        {/* Mission details */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Détails de la mission</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type *</label>
              <select
                required
                value={form.type}
                onChange={(e) => set("type", e.target.value as MissionType)}
                className="input"
              >
                {(Object.entries(TYPE_LABELS) as [MissionType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date et heure *</label>
              <input
                required
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => set("scheduled_at", e.target.value)}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="input resize-none"
              placeholder="Instructions particulières…"
            />
          </div>
        </div>

        {/* Opener selection */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Ouvreur (optionnel)</h2>
          <p className="text-xs text-gray-500">
            Laissez vide pour une attribution automatique parmi les meilleurs disponibles.
          </p>
          {hasCoords && nearbyOpeners && nearbyOpeners.length > 0 ? (
            <div>
              <label className="label">Choisir un ouvreur</label>
              <select
                value={form.opener_id}
                onChange={(e) => set("opener_id", e.target.value)}
                className="input"
              >
                <option value="">Attribution automatique</option>
                {nearbyOpeners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id.slice(0, 8)}… — {o.distance_km.toFixed(1)} km
                    {o.rating != null ? ` — ⭐ ${o.rating}` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : hasCoords ? (
            <p className="text-sm text-amber-600">Aucun ouvreur disponible dans cette zone.</p>
          ) : (
            <p className="text-sm text-gray-400">Entrez les coordonnées pour voir les ouvreurs disponibles.</p>
          )}

          {/* Price estimate */}
          {estimate && (
            <div className="rounded-lg bg-primary-50 p-4">
              <p className="text-xs font-medium text-primary-700 uppercase tracking-wide mb-2">Estimation du prix</p>
              <div className="space-y-1 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span>Prix de base ({TYPE_LABELS[form.type]})</span>
                  <span>{estimate.base_price} €</span>
                </div>
                {estimate.distance_surcharge > 0 && (
                  <div className="flex justify-between">
                    <span>Supplément distance ({estimate.distance_km.toFixed(1)} km)</span>
                    <span>+{estimate.distance_surcharge.toFixed(2)} €</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-primary-200 pt-1 font-semibold text-primary-800">
                  <span>Total</span>
                  <span>{estimate.total.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/app/openers" className="btn-secondary">Annuler</Link>
          <button
            type="submit"
            disabled={createMission.isPending}
            className="btn-primary"
          >
            {createMission.isPending ? "Création…" : "Créer la mission"}
          </button>
        </div>

        {createMission.isError && (
          <p className="text-sm text-red-600">
            Une erreur est survenue. Vérifiez les informations et réessayez.
          </p>
        )}
      </form>
    </div>
  );
}
