"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, Building2, Calendar, CheckCircle2,
  ChevronRight, Clock, Euro, FileText, Loader2, MapPin,
  Sparkles, Star, Upload, Wrench, X,
} from "lucide-react";
import { api, baseURL } from "@/lib/api";
import { createClient } from "@/lib/supabase";
import type { Bien } from "@/lib/hooks/useBiens";
import { C } from "@/lib/design-tokens";

// ── Zod schemas ───────────────────────────────────────────────────────────────
const missionSchema = z.object({
  bien_id:        z.string().uuid("Sélectionnez un bien"),
  type:           z.enum(["visite", "edl_entree", "edl_sortie", "remise_cles", "expertise"]),
  duree_estimee:  z.coerce.number().int().min(15).max(480).optional(),
  date_mission:   z.string().min(1, "Date requise"),
  creneau_debut:  z.string().optional(),
  creneau_fin:    z.string().optional(),
  nb_candidats:   z.coerce.number().int().min(1).max(20).optional(),
  instructions:   z.string().max(2000).optional(),
  remuneration:   z.coerce.number().min(0).max(9999).optional(),
  rayon_km:       z.number().int().min(5).max(200),
  vehicule_requis: z.boolean(),
  note_min:       z.number().min(0).max(5),
  habituels_en_premier: z.boolean(),
});

const devisSchema = z.object({
  bien_id:        z.string().uuid("Sélectionnez un bien"),
  categorie:      z.enum(["plomberie", "electricite", "menuiserie", "peinture", "serrurerie", "chauffage", "toiture", "jardinage", "nettoyage", "autre"]),
  titre:          z.string().min(3, "Titre requis").max(200),
  description:    z.string().min(10, "Description requise").max(5000),
  urgence:        z.enum(["faible", "moderee", "urgente", "tres_urgente"]),
  date_disponibilite: z.string().optional(),
  budget_estime:  z.coerce.number().min(0).optional(),
  rayon_km:       z.number().int().min(5).max(200),
  assurance_rc:   z.boolean(),
  note_min:       z.number().min(0).max(5),
  habituels_en_premier: z.boolean(),
  delai_reponse_jours: z.coerce.number().int().min(1).max(30).optional(),
});

// ── Types ─────────────────────────────────────────────────────────────────────
type TypePublication = "mission" | "devis";
type Step = 1 | 2 | 3 | 4;

interface MatchProfile {
  id: string;
  user_id: string;
  note_moyenne: number;
  distance_km: number | null;
  rayon_km: number;
  // ouvreur
  nb_missions?: number;
  types_missions?: string[] | null;
  vehicule?: boolean;
  // artisan
  nb_chantiers?: number;
  specialites?: string[] | null;
  assurance_rc?: boolean;
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: C.shadow, padding: "1.25rem", ...style }}>
      {children}
    </div>
  );
}
function Field({ label, children, error, hint }: { label: string; children: React.ReactNode; error?: string; hint?: string }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: C.text3, marginBottom: 5 }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: 11, color: C.red, marginTop: 3 }}>{error}</p>}
      {hint && !error && <p style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>{hint}</p>}
    </div>
  );
}
function Input({ value, onChange, type = "text", placeholder, readOnly, min, max }: { value: string | number; onChange?: (v: string) => void; type?: string; placeholder?: string; readOnly?: boolean; min?: number; max?: number }) {
  return (
    <input type={type} value={value} placeholder={placeholder} readOnly={readOnly} min={min} max={max}
      onChange={e => onChange?.(e.target.value)}
      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: readOnly ? C.surface2 : C.surface, color: readOnly ? C.text3 : C.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
  );
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
      <option value="">— Choisir —</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function Textarea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
  );
}
function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
      <div><p style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{label}</p>{hint && <p style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{hint}</p>}</div>
      <button onClick={() => onChange(!value)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: value ? C.orange : C.border, position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
        <span style={{ position: "absolute", top: 3, left: value ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </button>
    </div>
  );
}
function RangeField({ label, value, onChange, min, max, step, suffix = "" }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; suffix?: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: C.text3 }}>{label}</label>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.orange }}>{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: C.orange, cursor: "pointer" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.text3, marginTop: 3 }}>
        <span>{min}{suffix}</span><span>{max}{suffix}</span>
      </div>
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────
const STEPS = ["Bien", "Détails", "Zone", "Profils"];

function Stepper({ current }: { current: Step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: "2rem" }}>
      {STEPS.map((label, i) => {
        const idx = (i + 1) as Step;
        const done = current > idx;
        const active = current === idx;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, border: `2px solid ${active ? C.orange : done ? C.green : C.border}`, background: active ? C.orange : done ? C.greenBg : C.surface, color: active ? "#fff" : done ? C.green : C.text3, transition: "all 0.2s" }}>
                {done ? <CheckCircle2 size={14} /> : idx}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? C.orange : done ? C.green : C.text3, whiteSpace: "nowrap" }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? C.green : C.border, margin: "0 8px", marginBottom: "1.25rem", transition: "background 0.2s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Type switch ───────────────────────────────────────────────────────────────
function TypeSwitch({ type, onChange }: { type: TypePublication; onChange: (t: TypePublication) => void }) {
  return (
    <div style={{ display: "flex", gap: 2, padding: 4, borderRadius: 12, background: C.surface2, border: `1px solid ${C.border}`, marginBottom: "1.5rem", width: "fit-content" }}>
      {(["mission", "devis"] as TypePublication[]).map(t => (
        <button key={t} onClick={() => onChange(t)} style={{ padding: "8px 20px", borderRadius: 9, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", background: type === t ? C.orange : "transparent", color: type === t ? "#fff" : C.text3, transition: "all 0.2s" }}>
          {t === "mission" ? "🔑 Mission ouvreur" : "🔧 Devis artisan"}
        </button>
      ))}
    </div>
  );
}

// ── Step 1: Bien ──────────────────────────────────────────────────────────────
function Step1({ bienId, setBienId, errors }: { bienId: string; setBienId: (id: string) => void; errors: Record<string, string> }) {
  const { data: biens = [], isLoading } = useQuery<Bien[]>({
    queryKey: ["biens", "publication"],
    queryFn: async () => { const { data } = await api.get("/biens/", { params: { size: 100 } }); return data; },
    staleTime: 60_000,
  });

  const selected = biens.find(b => b.id === bienId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <Field label="Bien concerné" error={errors.bien_id}>
        {isLoading ? (
          <div style={{ padding: "10px 14px", color: C.text3, fontSize: 13 }}>Chargement…</div>
        ) : (
          <Select value={bienId} onChange={setBienId} options={biens.map(b => ({ value: b.id, label: `${b.adresse}, ${b.ville} (${b.type})` }))} />
        )}
      </Field>

      {selected && (
        <Card style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: C.orangeBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Building2 size={18} style={{ color: C.orange }} />
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{selected.adresse}</p>
            <p style={{ fontSize: 12, color: C.text3 }}>{selected.cp} {selected.ville}{selected.surface ? ` · ${selected.surface} m²` : ""}</p>
            <p style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>Statut : <span style={{ fontWeight: 600, color: selected.statut === "loue" ? C.green : C.amber }}>{selected.statut}</span></p>
          </div>
        </Card>
      )}

      <Field label="Adresse (verrouillée depuis le bien)">
        <Input value={selected ? `${selected.adresse}, ${selected.cp} ${selected.ville}` : ""} readOnly placeholder="Sélectionnez un bien ci-dessus" />
      </Field>
    </div>
  );
}

// ── Step 2: Détails ───────────────────────────────────────────────────────────
const TYPES_MISSION = [
  { value: "visite", label: "Visite" },
  { value: "edl_entree", label: "État des lieux entrée" },
  { value: "edl_sortie", label: "État des lieux sortie" },
  { value: "remise_cles", label: "Remise de clés" },
  { value: "expertise", label: "Expertise / constat" },
];
const CATEGORIES_DEVIS = [
  { value: "plomberie", label: "Plomberie" },
  { value: "electricite", label: "Électricité" },
  { value: "menuiserie", label: "Menuiserie" },
  { value: "peinture", label: "Peinture" },
  { value: "serrurerie", label: "Serrurerie" },
  { value: "chauffage", label: "Chauffage / CVC" },
  { value: "toiture", label: "Toiture" },
  { value: "jardinage", label: "Jardinage" },
  { value: "nettoyage", label: "Nettoyage" },
  { value: "autre", label: "Autre" },
];
const URGENCES = [
  { value: "faible", label: "Faible — pas urgent" },
  { value: "moderee", label: "Modérée — sous 2 semaines" },
  { value: "urgente", label: "Urgente — sous 48h" },
  { value: "tres_urgente", label: "Très urgente — immédiat" },
];

function Step2Mission({ form, setForm, errors }: { form: Record<string, unknown>; setForm: (f: Record<string, unknown>) => void; errors: Record<string, string> }) {
  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Field label="Type de mission" error={errors.type}>
          <Select value={String(form.type ?? "")} onChange={v => set("type", v)} options={TYPES_MISSION} />
        </Field>
        <Field label="Durée estimée (min)">
          <Input type="number" value={String(form.duree_estimee ?? "")} onChange={v => set("duree_estimee", v)} placeholder="90" min={15} max={480} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
        <Field label="Date" error={errors.date_mission}>
          <Input type="date" value={String(form.date_mission ?? "")} onChange={v => set("date_mission", v)} />
        </Field>
        <Field label="Créneau début">
          <Input type="time" value={String(form.creneau_debut ?? "")} onChange={v => set("creneau_debut", v)} />
        </Field>
        <Field label="Créneau fin">
          <Input type="time" value={String(form.creneau_fin ?? "")} onChange={v => set("creneau_fin", v)} />
        </Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Field label="Nb candidats souhaités">
          <Input type="number" value={String(form.nb_candidats ?? "")} onChange={v => set("nb_candidats", v)} placeholder="3" min={1} max={20} />
        </Field>
        <Field label="Rémunération CHF" hint="Montant net pour l'ouvreur">
          <Input type="number" value={String(form.remuneration ?? "")} onChange={v => set("remuneration", v)} placeholder="120" min={0} />
        </Field>
      </div>
      <Field label="Instructions pour l'ouvreur">
        <Textarea value={String(form.instructions ?? "")} onChange={v => set("instructions", v)} placeholder="Interphone 2e étage, code boîte aux lettres: 1234…" />
      </Field>
    </div>
  );
}

function Step2Devis({ form, setForm, errors, bienId, bienAdresse }: {
  form: Record<string, unknown>; setForm: (f: Record<string, unknown>) => void;
  errors: Record<string, string>; bienId: string; bienAdresse: string;
}) {
  const set = (k: string, v: unknown) => setForm({ ...form, [k]: v });
  const [streaming, setStreaming] = useState(false);
  const [photos, setPhotos] = useState<string[]>((form.photos as string[]) ?? []);
  const [uploading, setUploading] = useState(false);
  const descRef = useRef<string>(String(form.description ?? ""));

  async function redigerIA() {
    setStreaming(true);
    set("description", "");
    descRef.current = "";
    try {
      const resp = await fetch(`${baseURL}/sphere/rediger-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await createClient().auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({
          type_publication: "devis",
          type_intervention: form.categorie as string,
          adresse_bien: bienAdresse || undefined,
          description_contexte: (form.description as string)?.slice(0, 200) || undefined,
        }),
      });
      if (!resp.body) return;
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) { descRef.current += parsed.text; set("description", descRef.current); }
          } catch { /* noop */ }
        }
      }
    } finally { setStreaming(false); }
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const path = `interventions/${bienId}/${Date.now()}_${file.name.replace(/\s/g, "_")}`;
      const { error } = await supabase.storage.from("althy-docs").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("althy-docs").getPublicUrl(path);
      const updated = [...photos, publicUrl];
      setPhotos(updated);
      set("photos", updated);
    } catch { /* noop */ } finally { setUploading(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Field label="Catégorie de travaux" error={errors.categorie}>
          <Select value={String(form.categorie ?? "")} onChange={v => set("categorie", v)} options={CATEGORIES_DEVIS} />
        </Field>
        <Field label="Niveau d'urgence">
          <Select value={String(form.urgence ?? "moderee")} onChange={v => set("urgence", v)} options={URGENCES} />
        </Field>
      </div>

      <Field label="Titre de la demande" error={errors.titre}>
        <Input value={String(form.titre ?? "")} onChange={v => set("titre", v)} placeholder="Fuite robinet cuisine à réparer" />
      </Field>

      <Field label="Description détaillée" error={errors.description}>
        <div style={{ position: "relative" }}>
          <Textarea value={String(form.description ?? "")} onChange={v => { set("description", v); descRef.current = v; }} placeholder="Décrivez le problème, l'accès au bien, les contraintes particulières…" rows={5} />
          <button onClick={redigerIA} disabled={streaming || !form.categorie} style={{ position: "absolute", bottom: 10, right: 10, display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "none", background: C.orange, color: "#fff", fontSize: 11, fontWeight: 700, cursor: streaming || !form.categorie ? "not-allowed" : "pointer", opacity: !form.categorie ? 0.5 : 1 }}>
            {streaming ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />Génération…</> : <><Sparkles size={11} />Althy rédige</>}
          </button>
        </div>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <Field label="Date de disponibilité">
          <Input type="date" value={String(form.date_disponibilite ?? "")} onChange={v => set("date_disponibilite", v)} />
        </Field>
        <Field label="Budget estimé CHF (optionnel)">
          <Input type="number" value={String(form.budget_estime ?? "")} onChange={v => set("budget_estime", v)} placeholder="2000" min={0} />
        </Field>
      </div>

      {/* Photos upload */}
      <Field label="Photos (optionnel)" hint="Supabase Storage — bucket althy-docs">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {photos.map((url, i) => (
            <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8, border: `1px solid ${C.border}` }} />
              <button onClick={() => { const u = photos.filter((_, j) => j !== i); setPhotos(u); set("photos", u); }} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: C.red, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                <X size={10} />
              </button>
            </div>
          ))}
          <label style={{ width: 72, height: 72, borderRadius: 8, border: `2px dashed ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4, cursor: "pointer", color: C.text3, fontSize: 11 }}>
            {uploading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <><Upload size={16} /><span>Photo</span></>}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
          </label>
        </div>
      </Field>
    </div>
  );
}

// ── Step 3: Zone & matching ───────────────────────────────────────────────────
function MatchCard({ profile, type, selected, onToggle }: { profile: MatchProfile; type: TypePublication; selected: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.75rem 1rem", borderRadius: 12, border: `1.5px solid ${selected ? C.orange : C.border}`, background: selected ? C.orangeBg : C.surface, cursor: "pointer", transition: "all 0.15s" }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: selected ? C.orange : C.border, flexShrink: 0, transition: "background 0.15s" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Profil #{profile.id.slice(0, 6)}</span>
          {profile.distance_km != null && <span style={{ fontSize: 11, color: C.text3 }}>{profile.distance_km} km</span>}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 11, color: C.amber, display: "flex", alignItems: "center", gap: 3 }}>
            <Star size={10} />{profile.note_moyenne.toFixed(1)}
          </span>
          {type === "mission" && profile.nb_missions !== undefined && (
            <span style={{ fontSize: 11, color: C.text3 }}>{profile.nb_missions} missions</span>
          )}
          {type === "devis" && profile.nb_chantiers !== undefined && (
            <span style={{ fontSize: 11, color: C.text3 }}>{profile.nb_chantiers} chantiers</span>
          )}
          {profile.vehicule && <span style={{ fontSize: 11, color: C.green }}>🚗 Véhicule</span>}
          {profile.assurance_rc && <span style={{ fontSize: 11, color: C.blue }}>✓ RC Pro</span>}
        </div>
      </div>
      <div style={{ width: 20, height: 20, borderRadius: 4, border: `1.5px solid ${selected ? C.orange : C.border}`, background: selected ? C.orange : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {selected && <CheckCircle2 size={12} style={{ color: "#fff" }} />}
      </div>
    </div>
  );
}

function Step3({ type, bienId, rayon, setRayon, selectedProfiles, setSelectedProfiles, errors }: {
  type: TypePublication; bienId: string; rayon: number; setRayon: (v: number) => void;
  selectedProfiles: string[]; setSelectedProfiles: (ids: string[]) => void;
  errors: Record<string, string>;
}) {
  const [enabled, setEnabled] = useState(false);

  const { data: matches = [], isFetching, refetch } = useQuery<MatchProfile[]>({
    queryKey: ["matching", type, bienId, rayon],
    queryFn: async () => {
      const endpoint = type === "mission" ? "/matching/ouvreurs" : "/matching/artisans";
      const { data } = await api.get(endpoint, { params: { bien_id: bienId || undefined, rayon_km: rayon } });
      return data;
    },
    enabled: enabled && Boolean(bienId),
    staleTime: 30_000,
  });

  function toggleProfile(id: string) {
    setSelectedProfiles(selectedProfiles.includes(id) ? selectedProfiles.filter(x => x !== id) : [...selectedProfiles, id]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Map placeholder */}
      <div style={{ height: 180, borderRadius: 14, border: `1px solid ${C.border}`, background: C.surface2, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
        <MapPin size={32} style={{ color: C.text3, opacity: 0.3 }} />
        <p style={{ fontSize: 13, color: C.text3, fontWeight: 600 }}>Carte centrée sur le bien</p>
        <p style={{ fontSize: 11, color: C.text3 }}>Intégration Mapbox / Leaflet — à connecter</p>
      </div>

      <RangeField label="Rayon de recherche" value={rayon} onChange={setRayon} min={5} max={200} step={5} suffix=" km" />

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { setEnabled(true); refetch(); }} disabled={!bienId || isFetching} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px", borderRadius: 10, border: "none", background: C.orange, color: "#fff", fontSize: 13, fontWeight: 700, cursor: !bienId ? "not-allowed" : "pointer", opacity: !bienId ? 0.5 : 1 }}>
          {isFetching ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Recherche…</> : <>Rechercher les {type === "mission" ? "ouvreurs" : "artisans"} disponibles</>}
        </button>
        {selectedProfiles.length > 0 && (
          <button onClick={() => setSelectedProfiles([])} style={{ padding: "11px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text3, fontSize: 12, cursor: "pointer" }}>
            Tout décocher ({selectedProfiles.length})
          </button>
        )}
      </div>

      {matches.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
            {matches.length} profil{matches.length !== 1 ? "s" : ""} disponible{matches.length !== 1 ? "s" : ""} — cochez pour notifier en priorité
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {matches.map(m => (
              <MatchCard key={m.id} profile={m} type={type} selected={selectedProfiles.includes(m.id)} onToggle={() => toggleProfile(m.id)} />
            ))}
          </div>
        </div>
      )}
      {enabled && !isFetching && matches.length === 0 && (
        <div style={{ textAlign: "center", padding: "2rem", color: C.text3 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>Aucun profil disponible dans ce rayon</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Augmentez le rayon de recherche ou publiez sans sélection prioritaire.</p>
        </div>
      )}
    </div>
  );
}

// ── Step 4: Critères profil ───────────────────────────────────────────────────
function Step4Mission({ criteres, setCriteres }: { criteres: Record<string, unknown>; setCriteres: (c: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => setCriteres({ ...criteres, [k]: v });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Toggle label="Véhicule requis" hint="L'ouvreur doit disposer de son propre véhicule" value={Boolean(criteres.vehicule_requis)} onChange={v => set("vehicule_requis", v)} />
          <Toggle label="Bilingue requis" hint="L'ouvreur doit parler au moins 2 langues nationales" value={Boolean(criteres.bilingue)} onChange={v => set("bilingue", v)} />
          <Toggle label="Ouvreurs habituels en premier" hint="Préférence aux ouvreurs ayant déjà travaillé pour vous" value={Boolean(criteres.habituels_en_premier)} onChange={v => set("habituels_en_premier", v)} />
        </div>
      </Card>
      <Card>
        <RangeField label="Note minimum requise" value={Number(criteres.note_min ?? 0)} onChange={v => set("note_min", v)} min={0} max={5} step={0.5} suffix=" ⭐" />
      </Card>
    </div>
  );
}

function Step4Devis({ criteres, setCriteres }: { criteres: Record<string, unknown>; setCriteres: (c: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => setCriteres({ ...criteres, [k]: v });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Toggle label="RC Pro requise" hint="L'artisan doit avoir une assurance responsabilité civile professionnelle" value={Boolean(criteres.assurance_rc)} onChange={v => set("assurance_rc", v)} />
          <Toggle label="Artisans habituels en premier" hint="Préférence aux artisans ayant déjà travaillé pour vous" value={Boolean(criteres.habituels_en_premier)} onChange={v => set("habituels_en_premier", v)} />
        </div>
      </Card>
      <Card>
        <RangeField label="Note minimum requise" value={Number(criteres.note_min ?? 0)} onChange={v => set("note_min", v)} min={0} max={5} step={0.5} suffix=" ⭐" />
      </Card>
      <Card>
        <Field label="Délai de réponse devis (jours)" hint="Nombre de jours pour soumettre un devis">
          <Input type="number" value={String(criteres.delai_reponse_jours ?? 7)} onChange={v => set("delai_reponse_jours", v)} min={1} max={30} />
        </Field>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PublicationNewPage
// ══════════════════════════════════════════════════════════════════════════════
export default function PublicationNewPage() {
  const router = useRouter();
  const [type, setType] = useState<TypePublication>("mission");
  const [step, setStep] = useState<Step>(1);
  const [bienId, setBienId] = useState("");
  const [detailsForm, setDetailsForm] = useState<Record<string, unknown>>({ urgence: "moderee" });
  const [rayon, setRayon] = useState(50);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [criteres, setCriteres] = useState<Record<string, unknown>>({ note_min: 4.0, habituels_en_premier: true, vehicule_requis: false, bilingue: false, assurance_rc: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [publishing, setPublishing] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);

  const { data: biens = [] } = useQuery<Bien[]>({
    queryKey: ["biens", "publication"],
    queryFn: async () => { const { data } = await api.get("/biens/", { params: { size: 100 } }); return data; },
    staleTime: 60_000,
  });
  const selectedBien = biens.find(b => b.id === bienId);
  const bienAdresse = selectedBien ? `${selectedBien.adresse}, ${selectedBien.cp} ${selectedBien.ville}` : "";

  function validateStep(): boolean {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!bienId) e.bien_id = "Sélectionnez un bien";
    }
    if (step === 2) {
      if (type === "mission") {
        if (!detailsForm.type) e.type = "Type requis";
        if (!detailsForm.date_mission) e.date_mission = "Date requise";
      } else {
        if (!detailsForm.categorie) e.categorie = "Catégorie requise";
        if (!detailsForm.titre || String(detailsForm.titre).length < 3) e.titre = "Titre requis (min 3 caractères)";
        if (!detailsForm.description || String(detailsForm.description).length < 10) e.description = "Description requise (min 10 caractères)";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() { if (validateStep()) setStep(s => Math.min(4, s + 1) as Step); }
  function prev() { setStep(s => Math.max(1, s - 1) as Step); setErrors({}); }

  async function saveDraft() {
    if (!validateStep()) return;
    setPublishing(true);
    try {
      if (type === "mission") {
        const { data } = await api.post("/ouvreurs/missions", {
          bien_id: bienId,
          type: detailsForm.type,
          date_mission: detailsForm.date_mission || undefined,
          creneau_debut: detailsForm.creneau_debut || undefined,
          creneau_fin: detailsForm.creneau_fin || undefined,
          nb_candidats: detailsForm.nb_candidats ? Number(detailsForm.nb_candidats) : undefined,
          instructions: detailsForm.instructions || undefined,
          remuneration: detailsForm.remuneration ? Number(detailsForm.remuneration) : undefined,
          rayon_km: rayon,
          statut: "brouillon",
        });
        setDraftId(data.id);
      } else {
        const { data } = await api.post("/interventions-althy/", {
          bien_id: bienId,
          titre: detailsForm.titre,
          description: detailsForm.description || undefined,
          categorie: detailsForm.categorie,
          urgence: detailsForm.urgence ?? "moderee",
          date_disponibilite: detailsForm.date_disponibilite || undefined,
          cout: detailsForm.budget_estime ? Number(detailsForm.budget_estime) : undefined,
          photos: (detailsForm.photos as string[]) ?? [],
          statut: "brouillon",
        });
        setDraftId(data.id);
      }
    } catch { /* noop */ } finally { setPublishing(false); }
  }

  async function publish() {
    if (!validateStep()) return;
    setPublishing(true);
    try {
      let id = draftId;
      if (!id) {
        // Create first
        if (type === "mission") {
          const { data } = await api.post("/ouvreurs/missions", {
            bien_id: bienId,
            type: detailsForm.type,
            date_mission: detailsForm.date_mission || undefined,
            creneau_debut: detailsForm.creneau_debut || undefined,
            creneau_fin: detailsForm.creneau_fin || undefined,
            nb_candidats: detailsForm.nb_candidats ? Number(detailsForm.nb_candidats) : undefined,
            instructions: detailsForm.instructions || undefined,
            remuneration: detailsForm.remuneration ? Number(detailsForm.remuneration) : undefined,
            rayon_km: rayon,
            statut: "brouillon",
          });
          id = data.id;
        } else {
          const { data } = await api.post("/interventions-althy/", {
            bien_id: bienId,
            titre: detailsForm.titre,
            description: detailsForm.description || undefined,
            categorie: detailsForm.categorie,
            urgence: detailsForm.urgence ?? "moderee",
            cout: detailsForm.budget_estime ? Number(detailsForm.budget_estime) : undefined,
            photos: (detailsForm.photos as string[]) ?? [],
            statut: "brouillon",
          });
          id = data.id;
        }
      }
      // Publish: PATCH statut
      if (type === "mission") {
        await api.patch(`/ouvreurs/missions/${id}`, { statut: "proposee" });
      } else {
        await api.patch(`/interventions-althy/${id}`, { statut: "nouveau" });
      }
      router.push("/app/publications");
    } catch { /* noop */ } finally { setPublishing(false); }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 0 3rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.75rem" }}>
        <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text3, fontSize: 13, cursor: "pointer" }}>
          <ArrowLeft size={14} />
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 2 }}>Nouvelle publication</h1>
          <p style={{ fontSize: 12, color: C.text3 }}>Publiez une mission ouvreur ou une demande de devis artisan</p>
        </div>
      </div>

      {/* Type switch */}
      <TypeSwitch type={type} onChange={t => { setType(t); setDetailsForm({ urgence: "moderee" }); setErrors({}); }} />

      {/* Stepper */}
      <Stepper current={step} />

      {/* Step content */}
      <Card style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1.25rem" }}>
          Étape {step} — {["Bien concerné", "Détails", "Zone & matching", "Critères profil"][step - 1]}
        </p>

        {step === 1 && <Step1 bienId={bienId} setBienId={setBienId} errors={errors} />}
        {step === 2 && type === "mission" && <Step2Mission form={detailsForm} setForm={setDetailsForm} errors={errors} />}
        {step === 2 && type === "devis" && <Step2Devis form={detailsForm} setForm={setDetailsForm} errors={errors} bienId={bienId} bienAdresse={bienAdresse} />}
        {step === 3 && <Step3 type={type} bienId={bienId} rayon={rayon} setRayon={setRayon} selectedProfiles={selectedProfiles} setSelectedProfiles={setSelectedProfiles} errors={errors} />}
        {step === 4 && type === "mission" && <Step4Mission criteres={criteres} setCriteres={setCriteres} />}
        {step === 4 && type === "devis" && <Step4Devis criteres={criteres} setCriteres={setCriteres} />}
      </Card>

      {/* Navigation */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {step > 1 && (
          <button onClick={prev} style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 18px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text3, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <ArrowLeft size={14} />Retour
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Draft save (visible from step 2+) */}
        {step >= 2 && (
          <button onClick={saveDraft} disabled={publishing} style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 18px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text2, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: publishing ? 0.5 : 1 }}>
            <FileText size={14} />
            {draftId ? "Brouillon sauvegardé ✓" : "Enregistrer brouillon"}
          </button>
        )}

        {step < 4 ? (
          <button onClick={next} style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 20px", borderRadius: 10, border: "none", background: C.orange, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Suivant<ArrowRight size={14} />
          </button>
        ) : (
          <button onClick={publish} disabled={publishing} style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 20px", borderRadius: 10, border: "none", background: publishing ? C.border : C.orange, color: publishing ? C.text3 : "#fff", fontSize: 13, fontWeight: 700, cursor: publishing ? "not-allowed" : "pointer" }}>
            {publishing ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Publication…</> : <><CheckCircle2 size={14} />Publier</>}
          </button>
        )}
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
