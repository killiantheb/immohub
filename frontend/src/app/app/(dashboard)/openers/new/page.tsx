"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Crosshair, MapPin } from "lucide-react";
import Link from "next/link";
import { useCreateMission, useNearbyOpeners, usePriceEstimate } from "@/lib/hooks/useOpeners";
import { useProperties } from "@/lib/hooks/useProperties";
import type { MissionType } from "@/lib/types";

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

const TYPE_LABELS: Record<MissionType, string> = {
  visit: "Visite",
  check_in: "Remise de clés",
  check_out: "État des lieux sortant",
  inspection: "Inspection",
  photography: "Photographie",
  other: "Autre",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: `1px solid var(--althy-border)`,
  borderRadius: 10,
  fontSize: 14,
  color: "var(--althy-text)",
  background: "var(--althy-surface)",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "var(--althy-text-3)",
  marginBottom: 6,
  fontWeight: 500,
};

const cardStyle: React.CSSProperties = {
  background: "var(--althy-surface)",
  border: `1px solid var(--althy-border)`,
  borderRadius: 14,
  boxShadow: "var(--althy-shadow)",
  padding: 20,
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
        <Link href="/app/openers" style={{ color: S.text3, display: "flex" }}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontWeight: 400, fontSize: 28, color: S.text, margin: 0 }}>
          Nouvelle mission
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Property */}
        <div style={cardStyle} className="space-y-4">
          <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: S.text3, margin: 0 }}>Bien immobilier</h2>

          {properties.length > 0 ? (
            <div>
              <label style={labelStyle}>Sélectionner un bien *</label>
              <select
                required
                value={form.property_id}
                onChange={(e) => handlePropertyChange(e.target.value)}
                style={inputStyle}
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
            <div style={{ borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberBg, padding: "12px 14px", fontSize: 14, color: S.amber }}>
              Aucun bien trouvé.{" "}
              <Link href="/app/properties/new" style={{ fontWeight: 600, textDecoration: "underline", color: S.amber }}>
                Créez un bien d&apos;abord
              </Link>
            </div>
          )}

          {/* Coordinates */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label style={{ ...labelStyle, marginBottom: 0, display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin className="h-3.5 w-3.5" /> Coordonnées GPS
              </label>
              <button
                type="button"
                onClick={detectLocation}
                disabled={geoLoading}
                className="flex items-center gap-1"
                style={{ fontSize: 12, color: S.orange, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", opacity: geoLoading ? 0.5 : 1 }}
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
                style={inputStyle}
                placeholder="Latitude (ex: 48.8566)"
              />
              <input
                type="number"
                step="any"
                value={form.property_lng}
                onChange={(e) => set("property_lng", e.target.value)}
                style={inputStyle}
                placeholder="Longitude (ex: 2.3522)"
              />
            </div>
            <p style={{ marginTop: 4, fontSize: 11, color: S.text3 }}>
              Optionnel — permet de trouver les ouvreurs proches et d&apos;estimer le prix.
            </p>
          </div>
        </div>

        {/* Mission details */}
        <div style={cardStyle} className="space-y-4">
          <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: S.text3, margin: 0 }}>Détails de la mission</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Type *</label>
              <select
                required
                value={form.type}
                onChange={(e) => set("type", e.target.value as MissionType)}
                style={inputStyle}
              >
                {(Object.entries(TYPE_LABELS) as [MissionType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Date et heure *</label>
              <input
                required
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => set("scheduled_at", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              style={{ ...inputStyle, resize: "none" }}
              placeholder="Instructions particulières…"
            />
          </div>
        </div>

        {/* Opener selection */}
        <div style={cardStyle} className="space-y-4">
          <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: S.text3, margin: 0 }}>Ouvreur (optionnel)</h2>
          <p style={{ fontSize: 13, color: S.text3 }}>
            Laissez vide pour une attribution automatique parmi les meilleurs disponibles.
          </p>
          {hasCoords && nearbyOpeners && nearbyOpeners.length > 0 ? (
            <div>
              <label style={labelStyle}>Choisir un ouvreur</label>
              <select
                value={form.opener_id}
                onChange={(e) => set("opener_id", e.target.value)}
                style={inputStyle}
              >
                <option value="">Attribution automatique</option>
                {nearbyOpeners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id.slice(0, 8)}… — {o.distance_km.toFixed(1)} km
                    {o.rating != null ? ` — ${o.rating} / 5` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : hasCoords ? (
            <p style={{ fontSize: 14, color: S.amber }}>Aucun ouvreur disponible dans cette zone.</p>
          ) : (
            <p style={{ fontSize: 14, color: S.text3 }}>Entrez les coordonnées pour voir les ouvreurs disponibles.</p>
          )}

          {/* Price estimate */}
          {estimate && (
            <div style={{ borderRadius: 10, background: S.orangeBg, padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: S.orange, marginBottom: 8 }}>Estimation du prix</p>
              <div className="space-y-1" style={{ fontSize: 14, color: S.text2 }}>
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
                <div className="flex justify-between pt-1" style={{ borderTop: `1px solid ${S.border}`, fontWeight: 600, color: S.text }}>
                  <span>Total</span>
                  <span>{estimate.total.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href="/app/openers"
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: `1px solid ${S.border}`,
              background: S.surface,
              color: S.text2,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={createMission.isPending}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              background: S.orange,
              color: "#fff",
              border: "none",
              fontSize: 14,
              fontWeight: 500,
              cursor: createMission.isPending ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: createMission.isPending ? 0.7 : 1,
            }}
          >
            {createMission.isPending ? "Création…" : "Créer la mission"}
          </button>
        </div>

        {createMission.isError && (
          <p style={{ fontSize: 13, color: S.red }}>
            Une erreur est survenue. Vérifiez les informations et réessayez.
          </p>
        )}
      </form>
    </div>
  );
}
