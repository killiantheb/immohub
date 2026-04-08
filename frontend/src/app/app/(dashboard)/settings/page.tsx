"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CreditCard, MapPin, Sliders, User } from "lucide-react";
import { api } from "@/lib/api";
import { useRole } from "@/lib/hooks/useRole";

// ── Design tokens ─────────────────────────────────────────────────────────────
const S = {
  bg:       "var(--althy-bg)",
  surface:  "var(--althy-surface)",
  surface2: "var(--althy-surface-2)",
  border:   "var(--althy-border)",
  text:     "var(--althy-text)",
  text2:    "var(--althy-text-2)",
  text3:    "var(--althy-text-3)",
  orange:   "var(--althy-orange)",
  orangeBg: "var(--althy-orange-bg)",
  green:    "var(--althy-green)",
  greenBg:  "var(--althy-green-bg)",
  red:      "var(--althy-red)",
  redBg:    "var(--althy-red-bg)",
  amber:    "var(--althy-amber)",
  amberBg:  "var(--althy-amber-bg)",
  blue:     "var(--althy-blue)",
  blueBg:   "var(--althy-blue-bg)",
  shadow:   "var(--althy-shadow)",
} as const;

// ── Zod schemas ───────────────────────────────────────────────────────────────
const identiteSchema = z.object({
  first_name:        z.string().min(1).max(100).optional(),
  last_name:         z.string().min(1).max(100).optional(),
  phone:             z.string().max(20).optional(),
  adresse:           z.string().max(300).optional(),
  langue:            z.string().max(5).optional(),
  raison_sociale:    z.string().max(300).optional(),
  uid_ide:           z.string().regex(/^$|^CHE-\d{3}\.\d{3}\.\d{3}$/, "Format CHE-000.000.000").optional(),
  numero_tva:        z.string().max(30).optional(),
  statut_juridique:  z.string().optional(),
  annees_experience: z.coerce.number().int().min(0).max(60).optional(),
  site_web:          z.string().url("URL invalide").or(z.literal("")).optional(),
  statut_ouvreur:    z.string().optional(),
  numero_avs:        z.string().max(20).optional(),
  permis_conduire:   z.boolean().optional(),
  vehicule:          z.boolean().optional(),
});

const paiementSchema = z.object({
  iban:                 z.string().regex(/^$|^CH\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{1}$/, "IBAN CH invalide (ex: CH93 0076 2011 6238 5295 7)").optional(),
  bic:                  z.string().max(11).optional(),
  bank_account_holder:  z.string().max(200).optional(),
  virement_auto:        z.boolean(),
  billing_name:         z.string().max(200).optional(),
  billing_adresse:      z.string().max(300).optional(),
  delai_paiement_jours: z.coerce.number().int().optional(),
  facturation_auto:     z.boolean().optional(),
  relance_auto:         z.boolean().optional(),
});

type NotifKeys = "notif_email" | "notif_sms" | "notif_push" | "notif_inapp" |
  "notif_nouvelle_mission" | "notif_devis_accepte" | "notif_devis_refuse" |
  "notif_mission_urgente" | "notif_rappel_j1" | "notif_rappel_2h" |
  "notif_facture_impayee" | "notif_paiement_recu";

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: S.surface, borderRadius: 16, border: `1px solid ${S.border}`, boxShadow: S.shadow, padding: "1.25rem", ...style }}>
      {children}
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: S.text3, marginBottom: "0.75rem" }}>{title}</p>
      <Card><div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>{children}</div></Card>
    </section>
  );
}
function Field({ label, value, onChange, type = "text", placeholder, error, hint, readOnly }: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; placeholder?: string; error?: string; hint?: string; readOnly?: boolean;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: S.text3, marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} placeholder={placeholder} readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)}
        style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${error ? S.red : S.border}`, background: readOnly ? S.surface2 : S.surface, color: readOnly ? S.text3 : S.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
      {error && <p style={{ fontSize: 11, color: S.red, marginTop: 3 }}>{error}</p>}
      {hint && !error && <p style={{ fontSize: 11, color: S.text3, marginTop: 3 }}>{hint}</p>}
    </div>
  );
}
function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: S.text3, marginBottom: 5 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${S.border}`, background: S.surface, color: S.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
        <option value="">— Choisir —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
      <div>
        <p style={{ fontSize: 13, color: S.text, fontWeight: 500 }}>{label}</p>
        {hint && <p style={{ fontSize: 11, color: S.text3, marginTop: 2 }}>{hint}</p>}
      </div>
      <button onClick={() => onChange(!value)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: value ? S.orange : S.border, position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
        <span style={{ position: "absolute", top: 3, left: value ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </button>
    </div>
  );
}
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? S.orange : S.border}`, background: active ? S.orangeBg : S.surface, color: active ? S.orange : S.text3, transition: "all 0.15s" }}>
      {label}
    </button>
  );
}
function RangeField({ label, value, onChange, min, max, step, suffix = "" }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; suffix?: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: S.text3 }}>{label}</label>
        <span style={{ fontSize: 12, fontWeight: 700, color: S.orange }}>{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: S.orange, cursor: "pointer" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: S.text3, marginTop: 3 }}>
        <span>{min}{suffix}</span><span>{max}{suffix}</span>
      </div>
    </div>
  );
}
function SaveBtn({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving} style={{ display: "block", width: "100%", padding: "12px 0", borderRadius: 12, background: saved ? S.greenBg : S.orange, border: `1px solid ${saved ? S.green : "transparent"}`, color: saved ? S.green : "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, transition: "all 0.2s" }}>
      {saving ? "Sauvegarde…" : saved ? "Sauvegardé ✓" : "Sauvegarder les modifications"}
    </button>
  );
}
function EmptyTab({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <Card style={{ textAlign: "center", padding: "3rem 2rem" }}>
      <Icon size={36} style={{ margin: "0 auto 1rem", color: S.text3, opacity: 0.3 }} />
      <p style={{ fontWeight: 700, color: S.text2, marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 13, color: S.text3 }}>{sub}</p>
    </Card>
  );
}

// ── Tab: Identité ─────────────────────────────────────────────────────────────
function TabIdentite({ role }: { role: string | null }) {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["settings", "me"], queryFn: async () => { const { data } = await api.get("/auth/me"); return data; }, staleTime: 30_000 });
  const { data: profileArtisan } = useQuery({ queryKey: ["settings", "profile-artisan"], queryFn: async () => { const { data } = await api.get("/profiles-artisans/me"); return data; }, enabled: role === "company", staleTime: 30_000, retry: false });
  const { data: profileOuvreur } = useQuery({ queryKey: ["settings", "profile-ouvreur"], queryFn: async () => { const { data } = await api.get("/ouvreurs/profiles/me"); return data; }, enabled: role === "opener", staleTime: 30_000, retry: false });

  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", adresse: "", langue: "fr", raison_sociale: "", uid_ide: "", numero_tva: "", statut_juridique: "", annees_experience: "", site_web: "", statut_ouvreur: "", numero_avs: "", permis_conduire: false, vehicule: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (me) setForm(f => ({ ...f, first_name: me.first_name ?? "", last_name: me.last_name ?? "", phone: me.phone ?? "", adresse: me.adresse ?? "", langue: me.langue ?? "fr" })); }, [me]);
  useEffect(() => { if (profileArtisan) setForm(f => ({ ...f, raison_sociale: profileArtisan.raison_sociale ?? "", uid_ide: profileArtisan.uid_ide ?? "", numero_tva: profileArtisan.numero_tva ?? "", statut_juridique: profileArtisan.statut_juridique ?? "", annees_experience: String(profileArtisan.annees_experience ?? ""), site_web: profileArtisan.site_web ?? "" })); }, [profileArtisan]);
  useEffect(() => { if (profileOuvreur) setForm(f => ({ ...f, statut_ouvreur: profileOuvreur.statut_ouvreur ?? "", numero_avs: profileOuvreur.numero_avs ?? "", permis_conduire: profileOuvreur.permis_conduire ?? false, vehicule: profileOuvreur.vehicule ?? false })); }, [profileOuvreur]);

  const set = (k: string, v: string | boolean) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };

  async function save() {
    const parsed = identiteSchema.safeParse({ ...form, annees_experience: form.annees_experience ? Number(form.annees_experience) : undefined });
    if (!parsed.success) { const e: Record<string, string> = {}; parsed.error.issues.forEach(i => { e[String(i.path[0])] = i.message; }); setErrors(e); return; }
    setErrors({}); setSaving(true);
    try {
      await api.put("/auth/me", { first_name: form.first_name || undefined, last_name: form.last_name || undefined, phone: form.phone || undefined, adresse: form.adresse || undefined, langue: form.langue || undefined });
      if (role === "company") { await api.patch("/profiles-artisans/me", { raison_sociale: form.raison_sociale || undefined, uid_ide: form.uid_ide || undefined, numero_tva: form.numero_tva || undefined, statut_juridique: form.statut_juridique || undefined, annees_experience: form.annees_experience ? Number(form.annees_experience) : undefined, site_web: form.site_web || undefined }); qc.invalidateQueries({ queryKey: ["settings", "profile-artisan"] }); }
      if (role === "opener") { await api.patch("/ouvreurs/profiles/me", { statut_ouvreur: form.statut_ouvreur || undefined, numero_avs: form.numero_avs || undefined, permis_conduire: form.permis_conduire, vehicule: form.vehicule }); qc.invalidateQueries({ queryKey: ["settings", "profile-ouvreur"] }); }
      qc.invalidateQueries({ queryKey: ["settings", "me"] }); qc.invalidateQueries({ queryKey: ["auth", "profile"] });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch { /* noop */ } finally { setSaving(false); }
  }

  return (
    <div>
      <Section title="Informations personnelles">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field label="Prénom" value={form.first_name} onChange={v => set("first_name", v)} placeholder="Alice" error={errors.first_name} />
          <Field label="Nom" value={form.last_name} onChange={v => set("last_name", v)} placeholder="Dupont" error={errors.last_name} />
        </div>
        <Field label="Email" value={me?.email ?? ""} readOnly hint="Non modifiable — contactez le support." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field label="Téléphone" value={form.phone} onChange={v => set("phone", v)} placeholder="+41 79 000 00 00" />
          <SelectField label="Langue" value={form.langue} onChange={v => set("langue", v)} options={[{ value: "fr", label: "Français" }, { value: "de", label: "Deutsch" }, { value: "it", label: "Italiano" }, { value: "en", label: "English" }]} />
        </div>
        <Field label="Adresse" value={form.adresse} onChange={v => set("adresse", v)} placeholder="Rue de Lausanne 10, 1000 Lausanne" />
      </Section>

      {role === "company" && (
        <Section title="Informations artisan">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <Field label="Raison sociale" value={form.raison_sociale} onChange={v => set("raison_sociale", v)} placeholder="Dupont Plomberie Sàrl" />
            <Field label="UID IDE" value={form.uid_ide} onChange={v => set("uid_ide", v)} placeholder="CHE-123.456.789" error={errors.uid_ide} hint="Format CHE-000.000.000" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <Field label="Numéro TVA" value={form.numero_tva} onChange={v => set("numero_tva", v)} placeholder="CHE-123.456.789 TVA" />
            <SelectField label="Statut juridique" value={form.statut_juridique} onChange={v => set("statut_juridique", v)} options={[{ value: "independant", label: "Indépendant" }, { value: "sarl", label: "Sàrl" }, { value: "sa", label: "SA" }]} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <Field label="Années d'expérience" value={form.annees_experience} onChange={v => set("annees_experience", v)} type="number" placeholder="10" error={errors.annees_experience} />
            <Field label="Site web" value={form.site_web} onChange={v => set("site_web", v)} placeholder="https://dupont-plomberie.ch" error={errors.site_web} />
          </div>
        </Section>
      )}

      {role === "opener" && (
        <Section title="Informations ouvreur">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <SelectField label="Statut" value={form.statut_ouvreur} onChange={v => set("statut_ouvreur", v)} options={[{ value: "independant", label: "Indépendant" }, { value: "employe_agence", label: "Employé agence" }]} />
            <Field label="Numéro AVS" value={form.numero_avs} onChange={v => set("numero_avs", v)} placeholder="756.0000.0000.00" />
          </div>
          <Toggle label="Permis de conduire" hint="Permis B ou supérieur" value={form.permis_conduire} onChange={v => set("permis_conduire", v)} />
          <Toggle label="Véhicule personnel" hint="Je dispose d'un véhicule pour les déplacements" value={form.vehicule} onChange={v => set("vehicule", v)} />
        </Section>
      )}

      <SaveBtn saving={saving} saved={saved} onClick={save} />
    </div>
  );
}

// ── Tab: Zone & dispo ─────────────────────────────────────────────────────────
const JOURS_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function TabZone({ role }: { role: string | null }) {
  const qc = useQueryClient();
  const isFieldRole = role === "company" || role === "opener";
  const profileEndpoint = role === "company" ? "/profiles-artisans/me" : "/ouvreurs/profiles/me";

  const { data: profile } = useQuery({ queryKey: ["settings", "zone-profile"], queryFn: async () => { const { data } = await api.get(profileEndpoint); return data; }, enabled: isFieldRole, staleTime: 30_000, retry: false });

  const [rayon, setRayon] = useState(30);
  const [jours, setJours] = useState<number[]>([0, 1, 2, 3, 4]);
  const [heureDebut, setHeureDebut] = useState("08:00");
  const [heureFin, setHeureFin] = useState("18:00");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [adresseManuelle, setAdresseManuelle] = useState("");
  const [searchZone, setSearchZone] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setRayon(profile.rayon_km ?? 30);
    setJours(profile.jours_dispo ?? [0, 1, 2, 3, 4]);
    setHeureDebut(profile.heure_debut ?? "08:00");
    setHeureFin(profile.heure_fin ?? "18:00");
    if (profile.lat) setLat(profile.lat);
    if (profile.lng) setLng(profile.lng);
  }, [profile]);

  function detectPosition() {
    if (!navigator.geolocation) { setGeoStatus("error"); return; }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setGeoStatus("ok"); },
      () => setGeoStatus("error"),
      { timeout: 8000 }
    );
  }

  if (!isFieldRole) return <EmptyTab icon={MapPin} title="Non applicable" sub="La zone d'intervention concerne les artisans et ouvreurs." />;

  async function save() {
    setSaving(true);
    try {
      await api.patch(profileEndpoint, { rayon_km: rayon, jours_dispo: jours, heure_debut: heureDebut, heure_fin: heureFin, ...(lat !== null && { lat }), ...(lng !== null && { lng }) });
      qc.invalidateQueries({ queryKey: ["settings", "zone-profile"] });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch { /* noop */ } finally { setSaving(false); }
  }

  return (
    <div>
      <Section title="Localisation">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={detectPosition} disabled={geoStatus === "loading"} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: `1px solid ${S.orange}40`, background: S.orangeBg, color: S.orange, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <MapPin size={14} />{geoStatus === "loading" ? "Détection…" : "Détecter ma position"}
          </button>
          {geoStatus === "ok" && lat && <span style={{ fontSize: 12, color: S.green }}>✓ Position détectée ({lat.toFixed(4)}, {lng?.toFixed(4)})</span>}
          {geoStatus === "error" && <span style={{ fontSize: 12, color: S.red }}>Géolocalisation refusée</span>}
        </div>
        {(geoStatus === "error" || geoStatus === "idle") && (
          <Field label="Adresse manuelle" value={adresseManuelle} onChange={v => { setAdresseManuelle(v); setSaved(false); }} placeholder="Rue de Lausanne 10, 1000 Lausanne" hint="Utilisée si la détection automatique échoue" />
        )}
        <div style={{ height: 160, borderRadius: 12, border: `1px solid ${S.border}`, background: S.surface2, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
          <MapPin size={28} style={{ color: S.text3, opacity: 0.35 }} />
          <p style={{ fontSize: 12, color: S.text3 }}>Carte — intégration Mapbox / Leaflet à connecter</p>
          {lat && lng && <p style={{ fontSize: 11, color: S.orange }}>Centre : {lat.toFixed(4)}, {lng.toFixed(4)}</p>}
        </div>
      </Section>

      <Section title={`Rayon d'intervention`}>
        <RangeField label="Rayon" value={rayon} onChange={v => { setRayon(v); setSaved(false); }} min={5} max={100} step={5} suffix=" km" />
      </Section>

      <Section title="Jours disponibles">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {JOURS_LABELS.map((j, i) => (
            <Chip key={i} label={j} active={jours.includes(i)} onClick={() => { setSaved(false); setJours(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort((a, b) => a - b)); }} />
          ))}
        </div>
      </Section>

      <Section title="Horaires de disponibilité">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field label="Heure de début" value={heureDebut} onChange={v => { setHeureDebut(v); setSaved(false); }} type="time" />
          <Field label="Heure de fin" value={heureFin} onChange={v => { setHeureFin(v); setSaved(false); }} type="time" />
        </div>
      </Section>

      <Section title="Rechercher dans une autre zone">
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "flex-end" }}>
          <Field label="Adresse / ville" value={searchZone} onChange={setSearchZone} placeholder="Genève, 1201" />
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: S.text3, marginBottom: 5 }}>Date</label>
            <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${S.border}`, background: S.surface, color: S.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
          </div>
        </div>
        <button onClick={() => {/* TODO: call API */}} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 18px", borderRadius: 10, background: S.orangeBg, border: `1px solid ${S.orange}40`, color: S.orange, fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%" }}>
          Rechercher les missions disponibles
        </button>
        <p style={{ fontSize: 11, color: S.text3 }}>
          Interroge <code style={{ fontFamily: "monospace", background: S.surface2, padding: "1px 5px", borderRadius: 4 }}>/interventions-althy/?zone=…&date=…</code>
        </p>
      </Section>

      <SaveBtn saving={saving} saved={saved} onClick={save} />
    </div>
  );
}

// ── Tab: Préférences ──────────────────────────────────────────────────────────
const SPECIALITES_LIST = ["plomberie", "electricite", "menuiserie", "peinture", "serrurerie", "chauffage", "toiture", "jardinage", "nettoyage", "autre"];
const SPECIALITES_LABELS: Record<string, string> = { plomberie: "Plomberie", electricite: "Électricité", menuiserie: "Menuiserie", peinture: "Peinture", serrurerie: "Serrurerie", chauffage: "Chauffage", toiture: "Toiture", jardinage: "Jardinage", nettoyage: "Nettoyage", autre: "Autre" };
const TYPES_MISSIONS_LIST = ["visite", "edl_entree", "edl_sortie", "remise_cles", "expertise"];
const TYPES_MISSIONS_LABELS: Record<string, string> = { visite: "Visites", edl_entree: "EDL entrée", edl_sortie: "EDL sortie", remise_cles: "Remise clés", expertise: "Expertise" };

function TabPreferences({ role }: { role: string | null }) {
  const qc = useQueryClient();
  const isArtisan = role === "company", isOuvreur = role === "opener";
  const endpoint = isArtisan ? "/profiles-artisans/me" : "/ouvreurs/profiles/me";
  const { data: profile } = useQuery({ queryKey: ["settings", "prefs-profile"], queryFn: async () => { const { data } = await api.get(endpoint); return data; }, enabled: isArtisan || isOuvreur, staleTime: 30_000, retry: false });

  const [specialites, setSpecialites] = useState<string[]>([]);
  const [typesMissions, setTypesMissions] = useState<string[]>([]);
  const [montantMin, setMontantMin] = useState(0);
  const [urgences, setUrgences] = useState(false);
  const [majoration, setMajoration] = useState(0);
  const [missionsJour, setMissionsJour] = useState(5);
  const [chantiersSimult, setChantiersSimult] = useState(3);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setSpecialites(profile.specialites ?? []);
    setTypesMissions(profile.types_missions ?? []);
    setMontantMin(Number(profile.montant_min_mission ?? 0));
    setUrgences(profile.urgences_acceptees ?? false);
    setMajoration(profile.majoration_urgence_pct ?? 0);
    setMissionsJour(profile.missions_par_jour ?? 5);
    setChantiersSimult(profile.chantiers_simultanees ?? 3);
  }, [profile]);

  if (!isArtisan && !isOuvreur) return <EmptyTab icon={Sliders} title="Non applicable" sub="Les préférences de mission concernent les artisans et ouvreurs." />;

  function toggleChip(arr: string[], setArr: (v: string[]) => void, val: string) {
    setSaved(false); setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  async function save() {
    setSaving(true);
    try {
      await api.patch(endpoint, {
        montant_min_mission: montantMin || undefined,
        urgences_acceptees: urgences,
        majoration_urgence_pct: majoration,
        ...(isArtisan && { specialites, chantiers_simultanees: chantiersSimult }),
        ...(isOuvreur && { types_missions: typesMissions, missions_par_jour: missionsJour }),
      });
      qc.invalidateQueries({ queryKey: ["settings", "prefs-profile"] });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch { /* noop */ } finally { setSaving(false); }
  }

  return (
    <div>
      {isArtisan && (
        <Section title="Spécialités">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SPECIALITES_LIST.map(s => <Chip key={s} label={SPECIALITES_LABELS[s]} active={specialites.includes(s)} onClick={() => toggleChip(specialites, setSpecialites, s)} />)}
          </div>
        </Section>
      )}
      {isOuvreur && (
        <Section title="Types de missions acceptées">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TYPES_MISSIONS_LIST.map(t => <Chip key={t} label={TYPES_MISSIONS_LABELS[t]} active={typesMissions.includes(t)} onClick={() => toggleChip(typesMissions, setTypesMissions, t)} />)}
          </div>
        </Section>
      )}

      <Section title="Tarification minimale">
        <RangeField label="Montant minimum par mission" value={montantMin} onChange={v => { setMontantMin(v); setSaved(false); }} min={0} max={500} step={25} suffix=" CHF" />
      </Section>

      <Section title="Urgences">
        <Toggle label="Accepter les missions hors horaires" hint="Soirs, week-ends et jours fériés" value={urgences} onChange={v => { setUrgences(v); setSaved(false); }} />
        {urgences && (
          <RangeField label="Majoration automatique" value={majoration} onChange={v => { setMajoration(v); setSaved(false); }} min={0} max={200} step={5} suffix="%" />
        )}
      </Section>

      <Section title="Charge maximale">
        {isOuvreur && <RangeField label="Missions par jour" value={missionsJour} onChange={v => { setMissionsJour(v); setSaved(false); }} min={1} max={20} step={1} />}
        {isArtisan && <RangeField label="Chantiers simultanés" value={chantiersSimult} onChange={v => { setChantiersSimult(v); setSaved(false); }} min={1} max={20} step={1} />}
      </Section>

      <SaveBtn saving={saving} saved={saved} onClick={save} />
    </div>
  );
}

// ── Tab: Paiement ─────────────────────────────────────────────────────────────
function TabPaiement({ role }: { role: string | null }) {
  const qc = useQueryClient();
  const isFieldRole = role === "company" || role === "opener";
  const profileEndpoint = role === "company" ? "/profiles-artisans/me" : "/ouvreurs/profiles/me";

  const { data: me } = useQuery({ queryKey: ["settings", "me"], queryFn: async () => { const { data } = await api.get("/auth/me"); return data; }, staleTime: 30_000 });
  const { data: profile } = useQuery({ queryKey: ["settings", "paiement-profile"], queryFn: async () => { const { data } = await api.get(profileEndpoint); return data; }, enabled: isFieldRole, staleTime: 30_000, retry: false });

  const [form, setForm] = useState({ iban: "", bic: "", bank_account_holder: "", virement_auto: false, billing_name: "", billing_adresse: "", delai_paiement_jours: "30", facturation_auto: false, relance_auto: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const src = isFieldRole ? profile : me;
    if (!src) return;
    setForm(f => ({ ...f, iban: src.iban ?? (me?.iban ?? ""), bic: src.bic ?? (me?.bic ?? ""), bank_account_holder: src.bank_account_holder ?? (me?.bank_account_holder ?? ""), virement_auto: src.virement_auto ?? false, billing_name: src.billing_name ?? "", billing_adresse: src.billing_adresse ?? "", delai_paiement_jours: String(src.delai_paiement_jours ?? 30), facturation_auto: src.facturation_auto ?? false, relance_auto: src.relance_auto ?? false }));
  }, [me, profile, isFieldRole]);

  const set = (k: string, v: string | boolean) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };

  const ibanStripped = form.iban.replace(/\s/g, "");
  const ibanOk = ibanStripped === "" || /^CH\d{19}$/.test(ibanStripped);

  async function save() {
    const parsed = paiementSchema.safeParse({ ...form, delai_paiement_jours: Number(form.delai_paiement_jours) });
    if (!parsed.success) { const e: Record<string, string> = {}; parsed.error.issues.forEach(i => { e[String(i.path[0])] = i.message; }); setErrors(e); return; }
    setErrors({}); setSaving(true);
    try {
      if (isFieldRole) {
        await api.patch(profileEndpoint, { iban: form.iban || undefined, bic: form.bic || undefined, bank_account_holder: form.bank_account_holder || undefined, virement_auto: form.virement_auto, billing_name: form.billing_name || undefined, billing_adresse: form.billing_adresse || undefined, delai_paiement_jours: Number(form.delai_paiement_jours), ...(role === "company" && { facturation_auto: form.facturation_auto, relance_auto: form.relance_auto }) });
        qc.invalidateQueries({ queryKey: ["settings", "paiement-profile"] });
      } else {
        await api.put("/auth/me", { iban: form.iban || undefined, bic: form.bic || undefined, bank_account_holder: form.bank_account_holder || undefined });
      }
      qc.invalidateQueries({ queryKey: ["settings", "me"] }); qc.invalidateQueries({ queryKey: ["auth", "profile"] });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch { /* noop */ } finally { setSaving(false); }
  }

  return (
    <div>
      <Section title="Coordonnées bancaires">
        <Field label="IBAN" value={form.iban} onChange={v => set("iban", v.toUpperCase())} placeholder="CH93 0076 2011 6238 5295 7" error={errors.iban} hint="Format suisse — CH·· ···· ···· ···· ···· ·" />
        {form.iban && <p style={{ fontSize: 11, marginTop: -8, color: ibanOk ? S.green : S.red }}>{ibanOk ? "✓ Format IBAN valide" : "✗ Format invalide"}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <Field label="BIC / SWIFT" value={form.bic} onChange={v => set("bic", v.toUpperCase())} placeholder="UBSWCHZH80A" />
          <Field label="Titulaire du compte" value={form.bank_account_holder} onChange={v => set("bank_account_holder", v)} placeholder="Alice Dupont" />
        </div>
        <Toggle label="Virement automatique après validation" hint="Déclenche automatiquement le paiement dès validation de la mission / chantier" value={form.virement_auto} onChange={v => set("virement_auto", v)} />
      </Section>

      {isFieldRole && (
        <Section title="Informations de facturation">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <Field label="Nom sur les factures" value={form.billing_name} onChange={v => set("billing_name", v)} placeholder="Dupont Plomberie Sàrl" />
            <SelectField label="Délai de paiement" value={form.delai_paiement_jours} onChange={v => set("delai_paiement_jours", v)} options={[{ value: "10", label: "10 jours" }, { value: "30", label: "30 jours" }, { value: "60", label: "60 jours" }]} />
          </div>
          <Field label="Adresse de facturation" value={form.billing_adresse} onChange={v => set("billing_adresse", v)} placeholder="Rue de Lausanne 10, 1000 Lausanne" />
          {role === "company" && (
            <>
              <Toggle label="Génération automatique des factures" hint="Génère un PDF dès qu'un chantier est terminé" value={form.facturation_auto} onChange={v => set("facturation_auto", v)} />
              <Toggle label="Relance automatique des impayés" hint="Rappels à J+15 et J+30 si facture non payée" value={form.relance_auto} onChange={v => set("relance_auto", v)} />
            </>
          )}
        </Section>
      )}

      <Section title="Abonnement Althy">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.25rem 0" }}>
          <div><p style={{ fontSize: 13, fontWeight: 700, color: S.text }}>Plan actuel</p><p style={{ fontSize: 11, color: S.text3, marginTop: 2 }}>Gratuit — jusqu'à 3 biens</p></div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: S.greenBg, color: S.green }}>GRATUIT</span>
        </div>
        <div style={{ height: 1, background: S.border }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 13, color: S.text2 }}>Prochain prélèvement</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: S.text3 }}>—</p>
        </div>
        <button onClick={() => {/* Stripe Customer Portal */}} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, border: `1px solid ${S.orange}40`, background: S.orangeBg, color: S.orange, fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%" }}>
          Gérer l'abonnement (Stripe Customer Portal)
        </button>
      </Section>

      <SaveBtn saving={saving} saved={saved} onClick={save} />
    </div>
  );
}

// ── Tab: Notifications ────────────────────────────────────────────────────────
const CANAUX: { key: NotifKeys; label: string; hint: string }[] = [
  { key: "notif_email", label: "Email",             hint: "Alertes et résumés par email" },
  { key: "notif_sms",   label: "SMS",               hint: "Messages courts (opérateur requis)" },
  { key: "notif_push",  label: "Push app mobile",   hint: "Notifications push sur l'application" },
  { key: "notif_inapp", label: "Althy IA in-app",   hint: "Briefings contextuels dans l'interface" },
];
const EVENEMENTS: { key: NotifKeys; label: string; roles?: string[] }[] = [
  { key: "notif_nouvelle_mission",  label: "Nouvelle mission disponible",  roles: ["opener", "company"] },
  { key: "notif_devis_accepte",     label: "Devis accepté",                roles: ["company"] },
  { key: "notif_devis_refuse",      label: "Devis refusé",                 roles: ["company"] },
  { key: "notif_mission_urgente",   label: "Mission urgente",              roles: ["opener", "company"] },
  { key: "notif_rappel_j1",         label: "Rappel J-1 avant mission",     roles: ["opener", "company"] },
  { key: "notif_rappel_2h",         label: "Rappel 2h avant mission",      roles: ["opener", "company"] },
  { key: "notif_facture_impayee",   label: "Facture impayée" },
  { key: "notif_paiement_recu",     label: "Paiement reçu" },
];

function TabNotifications({ role }: { role: string | null }) {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["settings", "me"], queryFn: async () => { const { data } = await api.get("/auth/me"); return data; }, staleTime: 30_000 });

  const defaultPrefs = { notif_email: true, notif_sms: false, notif_push: true, notif_inapp: true, notif_nouvelle_mission: true, notif_devis_accepte: true, notif_devis_refuse: true, notif_mission_urgente: true, notif_rappel_j1: true, notif_rappel_2h: true, notif_facture_impayee: true, notif_paiement_recu: true };
  const [prefs, setPrefs] = useState<typeof defaultPrefs>(defaultPrefs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!me) return;
    setPrefs({ notif_email: me.notif_email ?? true, notif_sms: me.notif_sms ?? false, notif_push: me.notif_push ?? true, notif_inapp: me.notif_inapp ?? true, notif_nouvelle_mission: me.notif_nouvelle_mission ?? true, notif_devis_accepte: me.notif_devis_accepte ?? true, notif_devis_refuse: me.notif_devis_refuse ?? true, notif_mission_urgente: me.notif_mission_urgente ?? true, notif_rappel_j1: me.notif_rappel_j1 ?? true, notif_rappel_2h: me.notif_rappel_2h ?? true, notif_facture_impayee: me.notif_facture_impayee ?? true, notif_paiement_recu: me.notif_paiement_recu ?? true });
  }, [me]);

  const toggle = (k: NotifKeys) => { setPrefs(p => ({ ...p, [k]: !p[k] })); setSaved(false); };

  async function save() {
    setSaving(true);
    try {
      await api.put("/auth/me", prefs);
      qc.invalidateQueries({ queryKey: ["settings", "me"] }); qc.invalidateQueries({ queryKey: ["auth", "profile"] });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch { /* noop */ } finally { setSaving(false); }
  }

  const evenementsFiltres = EVENEMENTS.filter(e => !e.roles || !role || e.roles.includes(role));

  return (
    <div>
      <Section title="Canaux de notification">
        {CANAUX.map(c => <Toggle key={c.key} label={c.label} hint={c.hint} value={prefs[c.key]} onChange={() => toggle(c.key)} />)}
      </Section>
      <Section title="Événements">
        {evenementsFiltres.map(e => <Toggle key={e.key} label={e.label} value={prefs[e.key]} onChange={() => toggle(e.key)} />)}
      </Section>
      <div style={{ padding: "0.75rem 1rem", borderRadius: 10, background: S.amberBg, border: `1px solid ${S.amber}30`, marginBottom: "1.25rem" }}>
        <p style={{ fontSize: 12, color: S.amber, fontWeight: 600 }}>SMS et push mobile nécessitent la configuration de Twilio / Firebase côté backend.</p>
      </div>
      <SaveBtn saving={saving} saved={saved} onClick={save} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SettingsPage
// ══════════════════════════════════════════════════════════════════════════════
type TabId = "identite" | "zone" | "preferences" | "paiement" | "notifications";
const ALL_TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "identite",      label: "Identité",      icon: User },
  { id: "zone",          label: "Zone & dispo",  icon: MapPin },
  { id: "preferences",   label: "Préférences",   icon: Sliders },
  { id: "paiement",      label: "Paiement",      icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
];

export default function SettingsPage() {
  const { role } = useRole();
  const [tab, setTab] = useState<TabId>("identite");

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 0 3rem" }}>
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: S.text, marginBottom: 4 }}>Paramètres</h1>
        <p style={{ fontSize: 13, color: S.text3 }}>Gérez votre profil, vos préférences et votre facturation.</p>
      </div>

      <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${S.border}`, marginBottom: "1.5rem", overflowX: "auto" }}>
        {ALL_TABS.map(t => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "none", border: "none", borderBottom: `2px solid ${active ? S.orange : "transparent"}`, color: active ? S.orange : S.text3, fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
              <Icon size={14} />{t.label}
            </button>
          );
        })}
      </div>

      {tab === "identite"      && <TabIdentite role={role} />}
      {tab === "zone"          && <TabZone role={role} />}
      {tab === "preferences"   && <TabPreferences role={role} />}
      {tab === "paiement"      && <TabPaiement role={role} />}
      {tab === "notifications" && <TabNotifications role={role} />}
    </div>
  );
}
