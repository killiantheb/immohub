"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useMyOpenerProfile, usePatchOpenerProfile, useUpsertOpenerProfile } from "@/lib/hooks/useOpeners";

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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: S.orange, borderTopColor: "transparent" }} />
      </div>
    );
  }

  const isPending = upsert.isPending || patch.isPending;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/app/openers" style={{ color: S.text3, display: "flex" }}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontWeight: 400, fontSize: 28, color: S.text, margin: 0 }}>
            Mon profil ouvreur
          </h1>
          {profile && (
            <p style={{ fontSize: 13, color: S.text3, marginTop: 2 }}>
              {profile.total_missions} mission{profile.total_missions !== 1 ? "s" : ""} effectuée{profile.total_missions !== 1 ? "s" : ""}
              {profile.rating != null && ` · ${profile.rating}/5`}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Availability */}
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontWeight: 500, color: S.text, fontSize: 14 }}>Disponible pour des missions</p>
            <p style={{ fontSize: 13, color: S.text3, marginTop: 2 }}>Désactivez pour ne plus recevoir de demandes</p>
          </div>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, is_available: !f.is_available }))}
            style={{
              position: "relative",
              display: "inline-flex",
              height: 24,
              width: 44,
              flexShrink: 0,
              cursor: "pointer",
              borderRadius: 999,
              border: "2px solid transparent",
              background: form.is_available ? S.green : S.surface2,
              transition: "background 0.2s",
              padding: 0,
            }}
          >
            <span
              style={{
                display: "inline-block",
                height: 20,
                width: 20,
                borderRadius: 999,
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                transform: form.is_available ? "translateX(20px)" : "translateX(0)",
                transition: "transform 0.2s",
              }}
            />
          </button>
        </div>

        {/* Bio */}
        <div style={cardStyle} className="space-y-4">
          <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: S.text3, margin: 0 }}>Présentation</h2>
          <div>
            <label style={labelStyle}>Bio</label>
            <textarea
              rows={3}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              style={{ ...inputStyle, resize: "none" }}
              placeholder="Décrivez votre expérience…"
            />
          </div>
          <div>
            <label style={labelStyle}>Compétences</label>
            <input
              type="text"
              value={form.skills}
              onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
              style={inputStyle}
              placeholder="visit, check_in, photography…"
            />
            <p style={{ marginTop: 4, fontSize: 11, color: S.text3 }}>Séparez par des virgules. Valeurs : visit, check_in, check_out, inspection, photography, other</p>
          </div>
        </div>

        {/* Location */}
        <div style={cardStyle} className="space-y-4">
          <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: S.text3, margin: 0 }}>Zone d&apos;intervention</h2>
          <div>
            <label style={labelStyle}>Rayon d&apos;intervention (km)</label>
            <input
              type="number"
              min="1"
              max="200"
              value={form.radius_km}
              onChange={(e) => setForm((f) => ({ ...f, radius_km: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Latitude</label>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                style={inputStyle}
                placeholder="48.8566"
              />
            </div>
            <div>
              <label style={labelStyle}>Longitude</label>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                style={inputStyle}
                placeholder="2.3522"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={useGeoLocation}
            style={{ fontSize: 13, color: S.orange, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", padding: 0 }}
          >
            Utiliser ma position actuelle
          </button>
        </div>

        {/* Rate */}
        <div style={cardStyle} className="space-y-4">
          <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: S.text3, margin: 0 }}>Tarification</h2>
          <div>
            <label style={labelStyle}>Taux horaire (€/h)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.hourly_rate}
              onChange={(e) => setForm((f) => ({ ...f, hourly_rate: e.target.value }))}
              style={inputStyle}
              placeholder="Optionnel — indicatif"
            />
            <p style={{ marginTop: 4, fontSize: 11, color: S.text3 }}>Le prix final est calculé selon le type et la distance de la mission.</p>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center justify-end gap-3">
          {saved && <span style={{ fontSize: 13, color: S.green }}>Profil mis à jour</span>}
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2"
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              background: S.orange,
              color: "#fff",
              border: "none",
              fontSize: 14,
              fontWeight: 500,
              cursor: isPending ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: isPending ? 0.7 : 1,
            }}
          >
            <Save className="h-4 w-4" />
            {isPending ? "Sauvegarde…" : profile ? "Mettre à jour" : "Créer mon profil"}
          </button>
        </div>

        {(upsert.isError || patch.isError) && (
          <p style={{ fontSize: 13, color: S.red }}>Une erreur est survenue. Réessayez.</p>
        )}
      </form>
    </div>
  );
}
