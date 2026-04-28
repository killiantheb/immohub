"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, ChevronRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";
import { getCantonFromNpa, CANTON_LABELS } from "@/lib/swiss-postal-codes";


const TYPES_BIEN = [
  { value: "appartement", label: "Appartement" },
  { value: "villa", label: "Villa" },
  { value: "studio", label: "Studio" },
  { value: "maison", label: "Maison" },
  { value: "commerce", label: "Commerce" },
  { value: "bureau", label: "Bureau" },
  { value: "parking", label: "Parking" },
  { value: "garage", label: "Garage" },
  { value: "cave", label: "Cave" },
  { value: "autre", label: "Autre" },
] as const;

const TYPE_LABELS: Record<string, string> = TYPES_BIEN.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {} as Record<string, string>,
);

const schema = z.object({
  titre: z
    .string()
    .min(2, "Le titre doit faire au moins 2 caractères")
    .max(150, "Maximum 150 caractères"),
  adresse: z.string().min(3, "Adresse requise"),
  ville: z.string().min(2, "Ville requise"),
  cp: z.string().min(4, "Code postal requis").max(10),
  canton: z.string().optional(),
  type: z.enum([
    "appartement", "villa", "studio", "maison",
    "commerce", "bureau", "parking", "garage", "cave", "autre",
  ] as const),
  surface: z.coerce
    .number({ invalid_type_error: "Surface obligatoire" })
    .min(1, "Surface obligatoire (en m²)"),
  pieces: z.union([z.coerce.number().min(0.5), z.literal("")]).optional(),
  loyer: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  etage: z.union([z.coerce.number(), z.literal("")]).optional(),
});

type FormValues = z.infer<typeof schema>;

const cardStyle: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  boxShadow: C.shadow,
  padding: "1.5rem",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: C.text2,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  fontSize: 14,
  color: C.text,
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  outline: "none",
  transition: "border-color 0.2s",
};

const readOnlyInputStyle: React.CSSProperties = {
  ...inputStyle,
  background: "#F3F4F6",
  cursor: "not-allowed",
  color: C.text2,
};

const RequiredStar = () => (
  <span style={{ color: "#DC2626", marginLeft: 4 }} aria-hidden="true">*</span>
);

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  };
  const Toast = () =>
    msg ? (
      <div
        style={{
          position: "fixed",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          background: C.text,
          color: "#fff",
          padding: "10px 20px",
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          zIndex: 9999,
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
        role="status"
      >
        <CheckCircle2 size={16} />
        {msg}
      </div>
    ) : null;
  return { show, Toast };
}

export default function NouveauBienPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const { show: showToast, Toast } = useToast();
  const titreEdited = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "appartement" },
  });

  const adresse = watch("adresse");
  const ville = watch("ville");
  const cp = watch("cp");
  const type = watch("type");
  const canton = watch("canton");

  // Auto-fill canton depuis NPA
  useEffect(() => {
    if (cp && cp.length === 4) {
      const detected = getCantonFromNpa(cp);
      if (detected) setValue("canton", detected);
    }
  }, [cp, setValue]);

  // Auto-génération du titre tant que l'utilisateur ne l'a pas édité manuellement
  useEffect(() => {
    if (titreEdited.current) return;
    if (adresse && ville && type) {
      const labelType = TYPE_LABELS[type] || "Bien";
      setValue("titre", `${labelType}, ${adresse}, ${ville}`);
    }
  }, [adresse, ville, type, setValue]);

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      const payload: Record<string, unknown> = {
        titre: data.titre,
        adresse: data.adresse,
        ville: data.ville,
        cp: data.cp,
        type: data.type,
        surface: Number(data.surface),
      };
      if (data.canton) payload.canton = data.canton;
      if (data.pieces != null && data.pieces !== "") payload.rooms = Number(data.pieces);
      if (data.etage != null && data.etage !== "") payload.etage = Number(data.etage);
      if (data.loyer != null && data.loyer !== "") payload.loyer = Number(data.loyer);

      const res = await api.post("/biens", payload);
      showToast("Bien créé avec succès !");
      router.push(`/app/biens/${res.data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setServerError(msg ?? "Erreur lors de la création du bien");
    }
  };

  const titreRegister = register("titre");

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Breadcrumb */}
      <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text3, marginBottom: 8 }}>
        <Link href="/app/biens" style={{ color: C.text3, textDecoration: "none" }}>Biens</Link>
        <ChevronRight size={14} />
        <span style={{ color: C.text2 }}>Nouveau bien</span>
      </nav>

      {/* Back + Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link
          href="/app/biens"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 36, height: 36, borderRadius: 8,
            border: `1px solid ${C.border}`, background: C.surface,
            color: C.text2, textDecoration: "none",
          }}
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 400, fontSize: 28, color: C.text, margin: 0,
        }}>
          Ajouter un bien
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Titre */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, marginTop: 0, marginBottom: 16 }}>
            Titre du bien
          </h2>
          <div>
            <label style={labelStyle}>
              Titre<RequiredStar />
            </label>
            <input
              {...titreRegister}
              onChange={(e) => {
                titreEdited.current = true;
                titreRegister.onChange(e);
              }}
              placeholder="Auto-généré depuis l'adresse, modifiable"
              style={inputStyle}
            />
            {errors.titre && <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{errors.titre.message}</p>}
          </div>
        </div>

        {/* Adresse */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, marginTop: 0, marginBottom: 16 }}>
            Localisation
          </h2>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              Adresse<RequiredStar />
            </label>
            <input {...register("adresse")} placeholder="Rue de la Gare 12" style={inputStyle} />
            {errors.adresse && <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{errors.adresse.message}</p>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>
                Ville<RequiredStar />
              </label>
              <input {...register("ville")} placeholder="Lausanne" style={inputStyle} />
              {errors.ville && <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{errors.ville.message}</p>}
            </div>
            <div>
              <label style={labelStyle}>
                Code postal<RequiredStar />
              </label>
              <input {...register("cp")} placeholder="1003" style={inputStyle} />
              {errors.cp && <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{errors.cp.message}</p>}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Canton (auto-détecté)</label>
            <input
              {...register("canton")}
              readOnly
              placeholder="Sera détecté depuis le code postal"
              style={readOnlyInputStyle}
            />
            <small style={{ display: "block", marginTop: 4, fontSize: 12, color: C.text3 }}>
              {canton && CANTON_LABELS[canton]
                ? `Détecté : ${CANTON_LABELS[canton]} (${canton}). Modifiable depuis la fiche du bien après création.`
                : "Modifiable depuis la fiche du bien après création."}
            </small>
          </div>
        </div>

        {/* Caractéristiques */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, marginTop: 0, marginBottom: 16 }}>
            Caractéristiques
          </h2>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              Type de bien<RequiredStar />
            </label>
            <select {...register("type")} style={{ ...inputStyle, cursor: "pointer" }}>
              {TYPES_BIEN.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>
                Surface m²<RequiredStar />
              </label>
              <input {...register("surface")} type="number" step="1" placeholder="75" style={inputStyle} />
              {errors.surface && <p style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{errors.surface.message}</p>}
            </div>
            <div>
              <label style={labelStyle}>Pièces</label>
              <input {...register("pieces")} type="number" step="0.5" min="0.5" placeholder="3.5" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Étage</label>
              <input {...register("etage")} type="number" placeholder="2" style={inputStyle} />
            </div>
          </div>
        </div>

        {/* Financier */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: C.text, marginTop: 0, marginBottom: 16 }}>
            Loyer
          </h2>
          <div>
            <label style={labelStyle}>Loyer mensuel (CHF)</label>
            <input {...register("loyer")} type="number" placeholder="1'500" style={inputStyle} />
          </div>
        </div>

        {/* Error */}
        {serverError && (
          <div style={{
            background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)",
            borderRadius: 10, padding: "0.75rem 1rem", color: C.red, fontSize: 13,
          }}>
            {serverError}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            width: "100%", padding: "0.8rem",
            background: C.prussian, color: "var(--althy-surface)",
            border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600,
            cursor: isSubmitting ? "not-allowed" : "pointer",
            opacity: isSubmitting ? 0.7 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
          {isSubmitting ? "Création en cours..." : "Créer le bien"}
        </button>
      </form>

      <Toast />
    </div>
  );
}
