"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell, Building2, Calculator, CreditCard, Download, Eye, EyeOff,
  Globe, Link2, Loader2, Lock, MapPin, Plus, Shield, Trash2, User, Users, X,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRole } from "@/lib/hooks/useRole";
import { ZoneMap } from "@/components/map";
import type { ZoneMapData } from "@/components/map";

// ── Design tokens ──────────────────────────────────────────────────────────────
const S = {
  bg:       "var(--cream)",
  surface:  "var(--background-card)",
  surface2: "var(--althy-surface-2)",
  border:   "var(--border-subtle)",
  text:     "var(--charcoal)",
  text2:    "var(--text-secondary)",
  text3:    "var(--text-tertiary)",
  orange:   "var(--terracotta-primary)",
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

// ── Atoms ──────────────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: S.surface, borderRadius: 16, border: `1px solid ${S.border}`, boxShadow: S.shadow, padding: "1.25rem", ...style }}>
      {children}
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 400, color: S.text2, marginBottom: "0.75rem", borderBottom: `1px solid ${S.border}`, paddingBottom: "0.5rem" }}>
      {children}
    </p>
  );
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: S.text3, marginBottom: 5 }}>
      {children}
    </label>
  );
}
function Field({ label, value, onChange, type = "text", placeholder, error, hint, readOnly, textarea, rows = 4 }: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; placeholder?: string; error?: string; hint?: string; readOnly?: boolean;
  textarea?: boolean; rows?: number;
}) {
  const shared = { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${error ? S.red : S.border}`, background: readOnly ? S.surface2 : S.surface, color: readOnly ? S.text3 : S.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const };
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {textarea
        ? <textarea value={value} placeholder={placeholder} readOnly={readOnly} rows={rows} onChange={e => onChange?.(e.target.value)} style={{ ...shared, resize: "vertical" }} />
        : <input type={type} value={value} placeholder={placeholder} readOnly={readOnly} onChange={e => onChange?.(e.target.value)} style={shared} />
      }
      {error && <p style={{ fontSize: 11, color: S.red, marginTop: 3 }}>{error}</p>}
      {hint && !error && <p style={{ fontSize: 11, color: S.text3, marginTop: 3 }}>{hint}</p>}
    </div>
  );
}
function SelectField({ label, value, onChange, options, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; hint?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${S.border}`, background: S.surface, color: S.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
        <option value="">— Choisir —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <p style={{ fontSize: 11, color: S.text3, marginTop: 3 }}>{hint}</p>}
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
        <FieldLabel>{label}</FieldLabel>
        <span style={{ fontSize: 12, fontWeight: 700, color: S.orange }}>{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: S.orange, cursor: "pointer" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: S.text3, marginTop: 3 }}>
        <span>{min}{suffix}</span><span>{max}{suffix}</span>
      </div>
    </div>
  );
}
function SaveBtn({ saving, saved, onClick, label = "Sauvegarder les modifications" }: { saving: boolean; saved: boolean; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} disabled={saving} style={{ display: "block", width: "100%", padding: "12px 0", borderRadius: 12, background: saved ? S.greenBg : S.orange, border: `1px solid ${saved ? S.green : "transparent"}`, color: saved ? S.green : "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, transition: "all 0.2s" }}>
      {saving ? <Loader2 size={16} style={{ display: "inline", animation: "spin 1s linear infinite", marginRight: 6 }} /> : null}
      {saving ? "Sauvegarde…" : saved ? "Sauvegardé ✓" : label}
    </button>
  );
}
function Badge({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: color ?? S.orangeBg, color: color ? "#fff" : S.orange }}>
      {children}
    </span>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>{children}</div>;
}
function FormStack({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>{children}</div>;
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };
  const Toast = () => msg ? (
    <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: S.text, color: "#fff", padding: "10px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
      {msg}
    </div>
  ) : null;
  return { show, Toast };
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 1 — IDENTITÉ
// ──────────────────────────────────────────────────────────────────────────────
function TabIdentite() {
  const { role, isAgence, isProprioSolo, isMarketplace, isHunter } = useRole();
  const qc = useQueryClient();
  const { show, Toast } = useToast();

  const { data: me } = useQuery({ queryKey: ["settings", "me"], queryFn: async () => { const { data } = await api.get("/auth/me"); return data; }, staleTime: 30_000 });
  const { data: profileDetail } = useQuery({
    queryKey: ["settings", "profile-detail"],
    queryFn: async () => { const { data } = await api.get("/profiles-artisans/me"); return data; },
    enabled: isMarketplace,
    staleTime: 30_000, retry: false,
  });

  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const [f, setF] = useState({
    first_name: "", last_name: "", phone: "", phone_prefix: "+41",
    langue: "fr", timezone: "Europe/Zurich",
    // Agence
    agency_name: "", uid_ide: "", rc_number: "", agency_address: "", agency_npa: "",
    agency_city: "", agency_canton: "", agency_email: "", agency_website: "", agency_description: "",
    // Proprio solo
    owner_type: "physique", company_name: "", company_uid: "", company_form: "",
    correspondence_address: "",
    // Marketplace (opener/artisan/expert)
    numero_avs: "", statut_pro: "", specialties: [] as string[],
    licence_number: "", rc_insurance: "non", rc_insurance_number: "",
    annees_experience: "",
    // Hunter
    hunter_profession: "", hunter_network: "50-200",
  });

  useEffect(() => {
    if (me) setF(prev => ({ ...prev,
      first_name: me.first_name ?? "", last_name: me.last_name ?? "",
      phone: me.phone ?? "", langue: me.langue ?? "fr",
      agency_name: me.agency_name ?? "", uid_ide: me.uid_ide ?? "",
    }));
  }, [me]);
  useEffect(() => {
    if (profileDetail) setF(prev => ({ ...prev,
      numero_avs: profileDetail.numero_avs ?? "",
      statut_pro: profileDetail.statut_pro ?? "",
      specialties: profileDetail.specialties ?? [],
      licence_number: profileDetail.licence_number ?? "",
      rc_insurance: profileDetail.rc_insurance ?? "non",
      rc_insurance_number: profileDetail.rc_insurance_number ?? "",
      annees_experience: String(profileDetail.annees_experience ?? ""),
    }));
  }, [profileDetail]);

  const set = (k: string, v: unknown) => setF(prev => ({ ...prev, [k]: v }));
  const toggleSpecialty = (s: string) => setF(prev => ({
    ...prev,
    specialties: prev.specialties.includes(s)
      ? prev.specialties.filter(x => x !== s)
      : [...prev.specialties, s],
  }));

  const openerSpecialties = ["Visite standard", "EDL entrée", "EDL sortie", "Remise clés", "Check-in court séjour", "Contrôle chantier", "Accueil artisan", "Livraison mobilier"];
  const artisanSpecialties = ["Plomberie", "Électricité", "Chauffage", "Maçonnerie", "Peinture", "Menuiserie", "Serrurerie", "Jardinage", "Nettoyage", "Autre"];
  const expertSpecialties = ["Évaluation immobilière", "Géomètre", "Architecture", "Énergie (CECB)", "Droit immobilier", "Photographie", "Home staging", "Visite accompagnée"];

  const specialtiesList = role === "opener" ? openerSpecialties : role === "artisan" ? artisanSpecialties : role === "expert" ? expertSpecialties : [];

  async function save() {
    setSaving(true);
    try {
      await api.put("/auth/me", {
        first_name: f.first_name || undefined,
        last_name: f.last_name || undefined,
        phone: f.phone || undefined,
        langue: f.langue || undefined,
        ...(isAgence ? { agency_name: f.agency_name, uid_ide: f.uid_ide, rc_number: f.rc_number, agency_address: f.agency_address, agency_npa: f.agency_npa, agency_city: f.agency_city, agency_canton: f.agency_canton, agency_email: f.agency_email, agency_website: f.agency_website, agency_description: f.agency_description } : {}),
        ...(isProprioSolo ? { owner_type: f.owner_type, company_name: f.company_name, company_uid: f.company_uid, company_form: f.company_form, correspondence_address: f.correspondence_address } : {}),
        ...(isHunter ? { hunter_profession: f.hunter_profession, hunter_network: f.hunter_network } : {}),
      });
      if (isMarketplace) {
        await api.patch("/profiles-artisans/me", {
          numero_avs: f.numero_avs || undefined,
          statut_pro: f.statut_pro || undefined,
          specialties: f.specialties,
          licence_number: f.licence_number || undefined,
          rc_insurance: f.rc_insurance,
          rc_insurance_number: f.rc_insurance_number || undefined,
          annees_experience: f.annees_experience ? Number(f.annees_experience) : undefined,
        });
      }
      qc.invalidateQueries({ queryKey: ["settings"] });
      show("Profil sauvegardé");
    } catch { /* noop */ } finally { setSaving(false); }
  }

  return (
    <FormStack>
      <Toast />
      {/* Photo de profil */}
      <Card>
        <SectionTitle>Photo de profil</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: S.surface2, border: `2px solid ${S.border}`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {photoPreview || me?.avatar_url
              ? <img src={photoPreview ?? me?.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <User size={32} style={{ color: S.text3 }} />}
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
              const file = e.target.files?.[0];
              if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); }
            }} />
            <button onClick={() => fileRef.current?.click()} style={{ padding: "8px 18px", borderRadius: 10, background: S.orangeBg, border: `1px solid ${S.orange}`, color: S.orange, fontSize: 13, fontWeight: 600, cursor: "pointer", marginRight: 10 }}>
              Changer la photo
            </button>
            {photoPreview && (
              <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} style={{ padding: "8px 12px", borderRadius: 10, background: S.redBg, border: `1px solid ${S.red}`, color: S.red, fontSize: 13, cursor: "pointer" }}>
                <X size={14} />
              </button>
            )}
            <p style={{ fontSize: 11, color: S.text3, marginTop: 6 }}>JPG, PNG ou WebP · max 2 Mo · recadré en cercle</p>
          </div>
        </div>
      </Card>

      {/* Identité commune */}
      <Card>
        <SectionTitle>Informations personnelles</SectionTitle>
        <FormStack>
          <Row>
            <Field label="Prénom *" value={f.first_name} onChange={v => set("first_name", v)} placeholder="Marie" />
            <Field label="Nom *" value={f.last_name} onChange={v => set("last_name", v)} placeholder="Dupont" />
          </Row>
          <Field label="Email" value={me?.email ?? ""} readOnly hint="Modifiable via la page de connexion Supabase" />
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "0.75rem" }}>
            <SelectField label="Indicatif" value={f.phone_prefix} onChange={v => set("phone_prefix", v)} options={[
              { value: "+41", label: "🇨🇭 +41" }, { value: "+33", label: "🇫🇷 +33" },
              { value: "+49", label: "🇩🇪 +49" }, { value: "+43", label: "🇦🇹 +43" },
              { value: "+39", label: "🇮🇹 +39" }, { value: "+44", label: "🇬🇧 +44" },
            ]} />
            <Field label="Téléphone" value={f.phone} onChange={v => set("phone", v)} placeholder="079 123 45 67" />
          </div>
          <Row>
            <SelectField label="Langue" value={f.langue} onChange={v => set("langue", v)} options={[
              { value: "fr", label: "Français" }, { value: "de", label: "Deutsch" }, { value: "en", label: "English" },
            ]} />
            <SelectField label="Fuseau horaire" value={f.timezone} onChange={v => set("timezone", v)} options={[
              { value: "Europe/Zurich", label: "Europe/Zurich (UTC+1/+2)" },
              { value: "Europe/Paris", label: "Europe/Paris (UTC+1/+2)" },
              { value: "Europe/Berlin", label: "Europe/Berlin (UTC+1/+2)" },
              { value: "Europe/London", label: "Europe/London (UTC+0/+1)" },
            ]} />
          </Row>
        </FormStack>
      </Card>

      {/* Agence */}
      {isAgence && (
        <Card>
          <SectionTitle>Informations agence</SectionTitle>
          <FormStack>
            {isAgence && (
              <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", padding: "1rem", background: S.surface2, borderRadius: 12, marginBottom: 8 }}>
                <div style={{ width: 64, height: 64, borderRadius: 12, background: S.bg, border: `1px solid ${S.border}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {logoPreview ? <img src={logoPreview} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Building2 size={24} style={{ color: S.text3 }} />}
                </div>
                <div>
                  <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); }
                  }} />
                  <button onClick={() => logoRef.current?.click()} style={{ padding: "7px 16px", borderRadius: 8, background: S.orangeBg, border: `1px solid ${S.orange}`, color: S.orange, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    Logo agence
                  </button>
                  <p style={{ fontSize: 11, color: S.text3, marginTop: 4 }}>PNG · fond transparent recommandé</p>
                </div>
              </div>
            )}
            <Field label="Nom de l'agence *" value={f.agency_name} onChange={v => set("agency_name", v)} placeholder="Immobilier SA" />
            <Row>
              <Field label="Numéro IDE/UID" value={f.uid_ide} onChange={v => set("uid_ide", v)} placeholder="CHE-123.456.789" hint="Format CHE-000.000.000" />
              <Field label="Registre du commerce (RC)" value={f.rc_number} onChange={v => set("rc_number", v)} placeholder="CHE-123.456.789-5" />
            </Row>
            <Row>
              <Field label="Rue" value={f.agency_address} onChange={v => set("agency_address", v)} placeholder="Rue du Rhône 12" />
              <Field label="NPA" value={f.agency_npa} onChange={v => set("agency_npa", v)} placeholder="1204" />
            </Row>
            <Row>
              <Field label="Ville" value={f.agency_city} onChange={v => set("agency_city", v)} placeholder="Genève" />
              <SelectField label="Canton" value={f.agency_canton} onChange={v => set("agency_canton", v)} options={[
                "GE","VD","VS","FR","BE","NE","JU","ZH","ZG","SZ","LU","AG","SO","BS","BL","TI","SG","GR","TG","SH","AR","AI","GL","OW","NW","UR"
              ].map(c => ({ value: c, label: c }))} />
            </Row>
            <Row>
              <Field label="Email professionnel" value={f.agency_email} onChange={v => set("agency_email", v)} type="email" placeholder="contact@agence.ch" />
              <Field label="Site web" value={f.agency_website} onChange={v => set("agency_website", v)} placeholder="https://agence.ch" />
            </Row>
            <Field label="Description (500 chars max)" value={f.agency_description} onChange={v => v.length <= 500 && set("agency_description", v)} textarea rows={4} placeholder="Votre agence en quelques mots…" hint={`${f.agency_description.length}/500 caractères`} />
            <Field label="Nombre d'agents" value={String(me?.agent_count ?? "—")} readOnly hint="Calculé automatiquement selon les membres de l'équipe" />
          </FormStack>
        </Card>
      )}

      {/* Proprio solo */}
      {isProprioSolo && (
        <Card>
          <SectionTitle>Statut du propriétaire</SectionTitle>
          <FormStack>
            <SelectField label="Type de propriétaire" value={f.owner_type} onChange={v => set("owner_type", v)} options={[
              { value: "physique", label: "Personne physique" },
              { value: "societe", label: "Société" },
            ]} />
            {f.owner_type === "societe" && (
              <>
                <Field label="Nom de la société" value={f.company_name} onChange={v => set("company_name", v)} placeholder="Mon Patrimoine Sàrl" />
                <Row>
                  <Field label="UID société" value={f.company_uid} onChange={v => set("company_uid", v)} placeholder="CHE-123.456.789" />
                  <SelectField label="Forme juridique" value={f.company_form} onChange={v => set("company_form", v)} options={[
                    { value: "sa", label: "SA" }, { value: "sarl", label: "Sàrl" },
                    { value: "sn", label: "Raison individuelle" }, { value: "sc", label: "Société coopérative" },
                    { value: "ass", label: "Association" }, { value: "fond", label: "Fondation" },
                  ]} />
                </Row>
              </>
            )}
            <Field label="Adresse de correspondance" value={f.correspondence_address} onChange={v => set("correspondence_address", v)} placeholder="Rue de la Paix 1, 1003 Lausanne" hint="Peut différer des adresses de vos biens" />
          </FormStack>
        </Card>
      )}

      {/* Marketplace (opener, artisan, expert) */}
      {isMarketplace && (
        <Card>
          <SectionTitle>Profil professionnel</SectionTitle>
          <FormStack>
            <Row>
              <Field label="Numéro AVS (optionnel)" value={f.numero_avs} onChange={v => set("numero_avs", v)} placeholder="756.XXXX.XXXX.XX" hint="Pour la facturation" />
              <SelectField label="Statut professionnel" value={f.statut_pro} onChange={v => set("statut_pro", v)} options={[
                { value: "independant", label: "Indépendant" },
                { value: "salarie", label: "Salarié" },
                { value: "etudiant", label: "Étudiant" },
                { value: "retraite", label: "Retraité" },
              ]} />
            </Row>
            {specialtiesList.length > 0 && (
              <div>
                <FieldLabel>Spécialités</FieldLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: 6 }}>
                  {specialtiesList.map(s => (
                    <Chip key={s} label={s} active={f.specialties.includes(s)} onClick={() => toggleSpecialty(s)} />
                  ))}
                </div>
              </div>
            )}
            <Row>
              <Field label="N° licence professionnelle" value={f.licence_number} onChange={v => set("licence_number", v)} placeholder="Optionnel" />
              <Field label="Années d'expérience" value={f.annees_experience} onChange={v => set("annees_experience", v)} type="number" placeholder="5" />
            </Row>
            <div>
              <FieldLabel>Assurance RC professionnelle</FieldLabel>
              <div style={{ display: "flex", gap: "1rem", marginTop: 6 }}>
                {["oui", "non"].map(v => (
                  <button key={v} onClick={() => set("rc_insurance", v)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${f.rc_insurance === v ? S.orange : S.border}`, background: f.rc_insurance === v ? S.orangeBg : S.surface, color: f.rc_insurance === v ? S.orange : S.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {v === "oui" ? "Oui" : "Non"}
                  </button>
                ))}
              </div>
            </div>
            {f.rc_insurance === "oui" && (
              <Field label="N° de police RC" value={f.rc_insurance_number} onChange={v => set("rc_insurance_number", v)} placeholder="Numéro de police" />
            )}
          </FormStack>
        </Card>
      )}

      {/* Hunter */}
      {isHunter && (
        <Card>
          <SectionTitle>Profil hunter</SectionTitle>
          <FormStack>
            <Field label="Profession principale" value={f.hunter_profession} onChange={v => set("hunter_profession", v)} placeholder="Ex: Notaire, Banquier, Architecte…" hint="La profession qui vous permet de détecter des biens off-market" />
            <div>
              <FieldLabel>Réseau estimé</FieldLabel>
              <div style={{ display: "flex", gap: "1rem", marginTop: 6 }}>
                {[{ v: "<50", l: "< 50 contacts" }, { v: "50-200", l: "50 – 200 contacts" }, { v: "200+", l: "200+ contacts" }].map(o => (
                  <button key={o.v} onClick={() => set("hunter_network", o.v)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${f.hunter_network === o.v ? S.orange : S.border}`, background: f.hunter_network === o.v ? S.orangeBg : S.surface, color: f.hunter_network === o.v ? S.orange : S.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          </FormStack>
        </Card>
      )}

      <SaveBtn saving={saving} saved={false} onClick={save} />
    </FormStack>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 2 — ZONE & DISPONIBILITÉ
// ──────────────────────────────────────────────────────────────────────────────
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const SLOTS = [
  { key: "matin", label: "Matin (6h–12h)" },
  { key: "aprem", label: "Après-midi (12h–18h)" },
  { key: "soir", label: "Soir (18h–22h)" },
];

function TabZone() {
  const { show, Toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [zoneData, setZoneData] = useState<ZoneMapData | null>(null);
  const [notice, setNotice] = useState("2h");
  const [maxMissions, setMaxMissions] = useState("2");
  const [hourlyRate, setHourlyRate] = useState("");
  const [vacances, setVacances] = useState(false);
  const [vacFrom, setVacFrom] = useState("");
  const [vacTo, setVacTo] = useState("");

  // availability[day][slot] = boolean
  const [avail, setAvail] = useState<Record<string, Record<string, boolean>>>(() =>
    Object.fromEntries(DAYS.map(d => [d, Object.fromEntries(SLOTS.map(s => [s.key, false]))]))
  );
  const toggleAvail = (day: string, slot: string) =>
    setAvail(prev => ({ ...prev, [day]: { ...prev[day], [slot]: !prev[day][slot] } }));

  async function save() {
    setSaving(true);
    try {
      await api.patch("/auth/me", {
        intervention_radius_km: zoneData?.primary_location.radius_km,
        primary_lat: zoneData?.primary_location.lat,
        primary_lng: zoneData?.primary_location.lng,
        primary_address: zoneData?.primary_location.address,
        temp_zones: zoneData?.temp_zones ?? [],
        availability: avail,
        notice_hours: notice,
        max_simultaneous: maxMissions,
        hourly_rate: hourlyRate ? Number(hourlyRate) : null,
        vacances_mode: vacances,
        vacances_from: vacFrom || null,
        vacances_to: vacTo || null,
      });
      show("Zone sauvegardée");
    } catch { /* noop */ } finally { setSaving(false); }
  }

  return (
    <FormStack>
      <Toast />
      <Card>
        <SectionTitle>Zone d'intervention</SectionTitle>
        <ZoneMap
          mode="radius"
          initialCenter={[46.2044, 6.1432]}
          initialRadius={20}
          onLocationChange={setZoneData}
          height={340}
        />
      </Card>

      <Card>
        <SectionTitle>Disponibilités hebdomadaires</SectionTitle>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ width: 120, textAlign: "left", color: S.text3, fontWeight: 600, padding: "6px 0" }}></th>
                {DAYS.map(d => (
                  <th key={d} style={{ textAlign: "center", color: S.text3, fontWeight: 600, padding: "6px 4px" }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map(slot => (
                <tr key={slot.key}>
                  <td style={{ fontSize: 11, color: S.text2, padding: "6px 0", paddingRight: 8 }}>{slot.label}</td>
                  {DAYS.map(day => (
                    <td key={day} style={{ textAlign: "center", padding: 4 }}>
                      <button onClick={() => toggleAvail(day, slot.key)} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${avail[day]?.[slot.key] ? S.orange : S.border}`, background: avail[day]?.[slot.key] ? S.orange : S.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                        {avail[day]?.[slot.key] && <span style={{ fontSize: 14, color: "#fff" }}>✓</span>}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionTitle>Paramètres de missions</SectionTitle>
        <FormStack>
          <div>
            <FieldLabel>Délai minimum de préavis</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: 6 }}>
              {["1h", "2h", "4h", "12h", "24h", "48h"].map(v => (
                <Chip key={v} label={v} active={notice === v} onClick={() => setNotice(v)} />
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Missions simultanées max</FieldLabel>
            <div style={{ display: "flex", gap: "1rem", marginTop: 6 }}>
              {["1", "2", "3+"].map(v => (
                <button key={v} onClick={() => setMaxMissions(v)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${maxMissions === v ? S.orange : S.border}`, background: maxMissions === v ? S.orangeBg : S.surface, color: maxMissions === v ? S.orange : S.text, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <Field label="Tarif horaire indicatif (CHF/h)" value={hourlyRate} onChange={setHourlyRate} type="number" placeholder="80" hint="Optionnel — affiché aux clients lors du matching" />
        </FormStack>
      </Card>

      <Card>
        <SectionTitle>Mode vacances</SectionTitle>
        <FormStack>
          <Toggle label="Activer le mode vacances" hint="Aucune mission ne vous sera proposée pendant cette période" value={vacances} onChange={setVacances} />
          {vacances && (
            <Row>
              <Field label="Du" value={vacFrom} onChange={setVacFrom} type="date" />
              <Field label="Au" value={vacTo} onChange={setVacTo} type="date" />
            </Row>
          )}
        </FormStack>
      </Card>

      <SaveBtn saving={saving} saved={false} onClick={save} />
    </FormStack>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 3 — PAIEMENT & ABONNEMENT
// ──────────────────────────────────────────────────────────────────────────────
function TabPaiement() {
  const { isMarketplace, isManager, isAgence, role } = useRole();
  const { show, Toast } = useToast();
  const [saving, setSaving] = useState(false);

  const { data: sub } = useQuery({ queryKey: ["subscription"], queryFn: async () => { const { data } = await api.get("/abonnement/current"); return data; }, staleTime: 60_000, retry: false });
  const { data: invoices } = useQuery({ queryKey: ["invoices"], queryFn: async () => { const { data } = await api.get("/abonnement/invoices"); return data; }, staleTime: 60_000, retry: false });

  const [f, setF] = useState({
    iban: "", bic: "", account_holder: "", bank_name: "",
    payout_frequency: "mission", min_payout: "50", billing_mode: "auto",
    uid_tva: "",
    // Proprio/Agence
    iban_loyers: "", holder_loyers: "", bank_loyers: "", bic_loyers: "",
    virement_groupement: "bien", libelle_format: "{nom_locataire} — {adresse}",
  });
  const set = (k: string, v: string) => setF(prev => ({ ...prev, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      await api.patch("/auth/me", {
        iban: f.iban || undefined, bic: f.bic || undefined,
        account_holder: f.account_holder || undefined,
        bank_name: f.bank_name || undefined,
        payout_frequency: f.payout_frequency,
        min_payout: Number(f.min_payout),
        billing_mode: f.billing_mode,
        uid_tva: f.uid_tva || undefined,
        iban_loyers: f.iban_loyers || undefined,
        holder_loyers: f.holder_loyers || undefined,
        bank_loyers: f.bank_loyers || undefined,
        bic_loyers: f.bic_loyers || undefined,
        virement_groupement: f.virement_groupement,
        libelle_format: f.libelle_format,
      });
      show("Paiement sauvegardé");
    } catch { /* noop */ } finally { setSaving(false); }
  }

  const planColor: Record<string, string> = { standard: S.blue, pro: S.orange, agence: "#7C3AED", free: S.green };

  return (
    <FormStack>
      <Toast />
      {/* Abonnement */}
      <Card>
        <SectionTitle>Mon abonnement</SectionTitle>
        <p style={{ fontSize: 13, color: S.text3, marginBottom: "1rem" }}>
          Consultez votre plan actuel, changez d'offre et gérez vos factures depuis la page dédiée.
        </p>
        <Link href="/app/abonnement" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: S.orangeBg, border: `1px solid ${S.orange}`, color: S.orange, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          Gérer mon abonnement →
        </Link>
      </Card>

      {/* Factures */}
      {(invoices?.items?.length ?? 0) > 0 && (
        <Card>
          <SectionTitle>Historique des factures</SectionTitle>
          <FormStack>
            {(invoices?.items ?? []).slice(0, 12).map((inv: { id: string; date: string; amount: number; pdf_url: string; status: string }) => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${S.border}` }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{new Date(inv.date).toLocaleDateString("fr-CH")}</p>
                  <p style={{ fontSize: 11, color: S.text3 }}>CHF {(inv.amount / 100).toFixed(2)}</p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Badge color={inv.status === "paid" ? S.green : S.amber}>{inv.status === "paid" ? "Payée" : "En attente"}</Badge>
                  {inv.pdf_url && (
                    <a href={inv.pdf_url} target="_blank" rel="noreferrer" style={{ padding: "6px 10px", borderRadius: 8, background: S.surface2, border: `1px solid ${S.border}`, color: S.text2, fontSize: 12, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                      <Download size={12} /> PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </FormStack>
        </Card>
      )}

      {/* Coordonnées bancaires — Marketplace */}
      {isMarketplace && (
        <Card>
          <SectionTitle>Coordonnées bancaires (réception des paiements)</SectionTitle>
          <FormStack>
            <Field label="IBAN" value={f.iban} onChange={v => set("iban", v)} placeholder="CH93 0076 2011 6238 5295 7" hint="Formats CH, FR ou DE acceptés" />
            <Row>
              <Field label="BIC / SWIFT" value={f.bic} onChange={v => set("bic", v)} placeholder="UBSWCHZH80A" />
              <Field label="Nom du titulaire" value={f.account_holder} onChange={v => set("account_holder", v)} placeholder="Marie Dupont" />
            </Row>
            <Field label="Nom de la banque" value={f.bank_name} onChange={v => set("bank_name", v)} placeholder="UBS SA" />
            <div>
              <FieldLabel>Délai de paiement</FieldLabel>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: 6, flexWrap: "wrap" }}>
                {[{ v: "mission", l: "Après chaque mission" }, { v: "hebdomadaire", l: "Hebdomadaire" }, { v: "mensuel", l: "Mensuel" }].map(o => (
                  <Chip key={o.v} label={o.l} active={f.payout_frequency === o.v} onClick={() => set("payout_frequency", o.v)} />
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Montant minimum de versement</FieldLabel>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: 6 }}>
                {["50", "100", "200"].map(v => (
                  <Chip key={v} label={`CHF ${v}`} active={f.min_payout === v} onClick={() => set("min_payout", v)} />
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Mode de facturation</FieldLabel>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: 6 }}>
                {[{ v: "auto", l: "Auto (Althy génère)" }, { v: "manuel", l: "Manuelle (je fournis)" }].map(o => (
                  <Chip key={o.v} label={o.l} active={f.billing_mode === o.v} onClick={() => set("billing_mode", o.v)} />
                ))}
              </div>
            </div>
            <Field label="UID TVA (si assujetti)" value={f.uid_tva} onChange={v => set("uid_tva", v)} placeholder="CHE-123.456.789 TVA" />
          </FormStack>
        </Card>
      )}

      {/* Coordonnées bancaires — Proprio/Agence */}
      {isManager && (
        <Card>
          <SectionTitle>Compte de réception des loyers</SectionTitle>
          <FormStack>
            <Field label="IBAN de réception" value={f.iban_loyers} onChange={v => set("iban_loyers", v)} placeholder="CH93 0076 2011 6238 5295 7" />
            <Row>
              <Field label="Nom du titulaire" value={f.holder_loyers} onChange={v => set("holder_loyers", v)} placeholder="Marie Dupont" />
              <Field label="BIC / SWIFT" value={f.bic_loyers} onChange={v => set("bic_loyers", v)} placeholder="UBSWCHZH80A" />
            </Row>
            <Field label="Nom de la banque" value={f.bank_loyers} onChange={v => set("bank_loyers", v)} placeholder="UBS SA" />
            <div>
              <FieldLabel>Regroupement des virements</FieldLabel>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: 6, flexWrap: "wrap" }}>
                {[{ v: "bien", l: "Bien par bien" }, { v: "proprietaire", l: "Par propriétaire" }, { v: "global", l: "Global mensuel" }].map(o => (
                  <Chip key={o.v} label={o.l} active={f.virement_groupement === o.v} onClick={() => set("virement_groupement", o.v)} />
                ))}
              </div>
            </div>
            <Field label="Libellé des virements" value={f.libelle_format} onChange={v => set("libelle_format", v)} hint="Variables : {nom_locataire} {adresse} {periode} {mois}" />
          </FormStack>
        </Card>
      )}

      <SaveBtn saving={saving} saved={false} onClick={save} />
    </FormStack>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 4 — NOTIFICATIONS
// ──────────────────────────────────────────────────────────────────────────────
function TabNotifications() {
  const { isManager, isAgence, isMarketplace, role } = useRole();
  const { show, Toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [channels, setChannels] = useState({ push: true, email: true, sms: false, whatsapp: false });
  const [events, setEvents] = useState<Record<string, boolean>>({
    loyer_recu: true, loyer_retard: true, bail_expirant: true,
    nouveau_candidat: true, candidat_retenu: true, intervention_demandee: true,
    devis_recu: true, document_genere: false, briefing_ia: false, message_agence: true,
    nouvelle_mission: true, mission_annulee: true, paiement_recu: true,
    message_client: true, rappel_24h: true, rappel_2h: true,
    nouveau_mandat: true, offre_recue: true, dossier_soumis: true, message_proprio: true,
  });
  const [briefingHeure, setBriefingHeure] = useState("7h");
  const [loyerRetardDelai, setLoyerRetardDelai] = useState("7j");
  const [bailExpirantDelai, setBailExpirantDelai] = useState("30j");

  const toggleChannel = (k: string) => setChannels(prev => ({ ...prev, [k]: !prev[k as keyof typeof prev] }));
  const toggleEvent = (k: string) => setEvents(prev => ({ ...prev, [k]: !prev[k] }));

  async function save() {
    setSaving(true);
    try {
      await api.patch("/notifications/preferences", { channels, events, briefing_heure: briefingHeure, loyer_retard_delai: loyerRetardDelai, bail_expirant_delai: bailExpirantDelai });
      show("Préférences sauvegardées");
    } catch { /* noop */ } finally { setSaving(false); }
  }

  return (
    <FormStack>
      <Toast />
      <Card>
        <SectionTitle>Canaux de notification</SectionTitle>
        <FormStack>
          <Toggle label="Push mobile" hint="Notifications sur l'application mobile" value={channels.push} onChange={() => toggleChannel("push")} />
          <Toggle label="Email" hint="Récapitulatifs et alertes par email" value={channels.email} onChange={() => toggleChannel("email")} />
          <Toggle label="SMS" value={channels.sms} onChange={() => toggleChannel("sms")} />
          <Toggle label="WhatsApp" hint="Si votre numéro WhatsApp est configuré" value={channels.whatsapp} onChange={() => toggleChannel("whatsapp")} />
        </FormStack>
      </Card>

      {(isManager) && (
        <Card>
          <SectionTitle>Événements — Propriétaire</SectionTitle>
          <FormStack>
            <Toggle label="Loyer reçu" value={events.loyer_recu} onChange={() => toggleEvent("loyer_recu")} />
            <div>
              <Toggle label="Loyer en retard" value={events.loyer_retard} onChange={() => toggleEvent("loyer_retard")} />
              {events.loyer_retard && (
                <div style={{ marginTop: 8, paddingLeft: 16 }}>
                  <FieldLabel>Délai d'alerte</FieldLabel>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: 4 }}>
                    {["1j", "3j", "7j"].map(v => <Chip key={v} label={v} active={loyerRetardDelai === v} onClick={() => setLoyerRetardDelai(v)} />)}
                  </div>
                </div>
              )}
            </div>
            <div>
              <Toggle label="Bail expirant" value={events.bail_expirant} onChange={() => toggleEvent("bail_expirant")} />
              {events.bail_expirant && (
                <div style={{ marginTop: 8, paddingLeft: 16 }}>
                  <FieldLabel>Délai d'alerte</FieldLabel>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: 4 }}>
                    {["30j", "60j", "90j"].map(v => <Chip key={v} label={v} active={bailExpirantDelai === v} onClick={() => setBailExpirantDelai(v)} />)}
                  </div>
                </div>
              )}
            </div>
            <Toggle label="Nouveau candidat locataire" value={events.nouveau_candidat} onChange={() => toggleEvent("nouveau_candidat")} />
            <Toggle label="Candidat retenu (→ CHF 90 prélevé)" value={events.candidat_retenu} onChange={() => toggleEvent("candidat_retenu")} />
            <Toggle label="Intervention demandée" value={events.intervention_demandee} onChange={() => toggleEvent("intervention_demandee")} />
            <Toggle label="Devis reçu" value={events.devis_recu} onChange={() => toggleEvent("devis_recu")} />
            <Toggle label="Document généré" value={events.document_genere} onChange={() => toggleEvent("document_genere")} />
            <div>
              <Toggle label="Briefing IA quotidien" hint="Résumé de la journée par Althy" value={events.briefing_ia} onChange={() => toggleEvent("briefing_ia")} />
              {events.briefing_ia && (
                <div style={{ marginTop: 8, paddingLeft: 16 }}>
                  <FieldLabel>Heure</FieldLabel>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: 4 }}>
                    {["6h", "7h", "8h", "9h"].map(v => <Chip key={v} label={v} active={briefingHeure === v} onClick={() => setBriefingHeure(v)} />)}
                  </div>
                </div>
              )}
            </div>
            {isAgence && <Toggle label="Message d'un proprio (portail)" value={events.message_agence} onChange={() => toggleEvent("message_agence")} />}
          </FormStack>
        </Card>
      )}

      {isMarketplace && (
        <Card>
          <SectionTitle>Événements — Prestataire</SectionTitle>
          <FormStack>
            <Toggle label="Nouvelle mission proposée" value={events.nouvelle_mission} onChange={() => toggleEvent("nouvelle_mission")} />
            <Toggle label="Mission annulée" value={events.mission_annulee} onChange={() => toggleEvent("mission_annulee")} />
            <Toggle label="Paiement reçu" value={events.paiement_recu} onChange={() => toggleEvent("paiement_recu")} />
            <Toggle label="Nouveau message client" value={events.message_client} onChange={() => toggleEvent("message_client")} />
            <Toggle label="Rappel mission — 24h avant" value={events.rappel_24h} onChange={() => toggleEvent("rappel_24h")} />
            <Toggle label="Rappel mission — 2h avant" value={events.rappel_2h} onChange={() => toggleEvent("rappel_2h")} />
          </FormStack>
        </Card>
      )}

      {isAgence && (
        <Card>
          <SectionTitle>Événements — Agence</SectionTitle>
          <FormStack>
            <Toggle label="Nouveau mandat off-market (hunter)" value={events.nouveau_mandat} onChange={() => toggleEvent("nouveau_mandat")} />
            <Toggle label="Offre reçue sur un bien" value={events.offre_recue} onChange={() => toggleEvent("offre_recue")} />
            <Toggle label="Candidat soumet un dossier" value={events.dossier_soumis} onChange={() => toggleEvent("dossier_soumis")} />
            <Toggle label="Message d'un proprio (portail)" value={events.message_proprio} onChange={() => toggleEvent("message_proprio")} />
          </FormStack>
        </Card>
      )}

      <SaveBtn saving={saving} saved={false} onClick={save} />
    </FormStack>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 5 — SÉCURITÉ
// ──────────────────────────────────────────────────────────────────────────────
function TabSecurite() {
  const { show, Toast } = useToast();
  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [twofa, setTwofa] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const { data: sessions } = useQuery({ queryKey: ["security", "sessions"], queryFn: async () => { const { data } = await api.get("/auth/sessions"); return data; }, staleTime: 30_000, retry: false });

  async function changePassword() {
    if (pwNew !== pwConfirm) { show("Les mots de passe ne correspondent pas"); return; }
    if (pwNew.length < 8) { show("Minimum 8 caractères"); return; }
    setPwSaving(true);
    try {
      await api.post("/auth/change-password", { old_password: pwOld, new_password: pwNew });
      show("Mot de passe modifié"); setPwOld(""); setPwNew(""); setPwConfirm("");
    } catch { show("Mot de passe actuel incorrect"); } finally { setPwSaving(false); }
  }

  async function exportData() {
    try {
      const res = await api.get("/rgpd/export", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url;
      a.download = `althy-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    } catch { show("Erreur lors de l'export"); }
  }

  async function exportCSV() {
    try {
      const res = await api.get("/rgpd/export/loyers.csv", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a"); a.href = url;
      a.download = `althy-loyers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch { show("Erreur lors de l'export"); }
  }

  async function requestDelete() {
    if (deleteConfirm !== "SUPPRIMER") return;
    setDeletingAccount(true);
    try {
      await api.post("/rgpd/delete-account");
      show("Demande envoyée — traitement sous 30 jours (RGPD / LPD art. 25)");
    } catch { /* noop */ } finally { setDeletingAccount(false); setDeleteConfirm(""); }
  }

  return (
    <FormStack>
      <Toast />
      <Card>
        <SectionTitle>Changer le mot de passe</SectionTitle>
        <FormStack>
          <div style={{ position: "relative" }}>
            <Field label="Mot de passe actuel" value={pwOld} onChange={setPwOld} type={showOld ? "text" : "password"} placeholder="••••••••" />
            <button onClick={() => setShowOld(!showOld)} style={{ position: "absolute", right: 12, top: 32, background: "none", border: "none", cursor: "pointer", color: S.text3 }}>
              {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div style={{ position: "relative" }}>
            <Field label="Nouveau mot de passe" value={pwNew} onChange={setPwNew} type={showNew ? "text" : "password"} placeholder="••••••••" hint="Minimum 8 caractères" />
            <button onClick={() => setShowNew(!showNew)} style={{ position: "absolute", right: 12, top: 32, background: "none", border: "none", cursor: "pointer", color: S.text3 }}>
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <Field label="Confirmer le nouveau mot de passe" value={pwConfirm} onChange={setPwConfirm} type="password" placeholder="••••••••" />
          <button onClick={changePassword} disabled={pwSaving} style={{ padding: "11px 0", borderRadius: 12, background: S.orange, border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            {pwSaving ? "Modification…" : "Modifier le mot de passe"}
          </button>
        </FormStack>
      </Card>

      <Card>
        <SectionTitle>Authentification à deux facteurs (2FA)</SectionTitle>
        <FormStack>
          <Toggle label="Activer la 2FA" hint="TOTP (Google Authenticator) ou SMS" value={twofa} onChange={setTwofa} />
          {twofa && (
            <div style={{ padding: "1rem", background: S.amberBg, borderRadius: 12, border: `1px solid ${S.amber}` }}>
              <p style={{ fontSize: 12, color: S.amber, fontWeight: 600 }}>Configuration 2FA disponible via le portail Supabase Auth. Contactez privacy@althy.ch pour l'activer sur votre compte.</p>
            </div>
          )}
        </FormStack>
      </Card>

      {sessions?.items?.length > 0 && (
        <Card>
          <SectionTitle>Sessions actives</SectionTitle>
          <FormStack>
            {sessions.items.map((s: { id: string; device: string; last_seen: string; current: boolean }) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${S.border}` }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{s.device}</p>
                  <p style={{ fontSize: 11, color: S.text3 }}>Dernière activité : {new Date(s.last_seen).toLocaleString("fr-CH")}</p>
                </div>
                {s.current ? <Badge>Session active</Badge> : (
                  <button onClick={async () => { await api.delete(`/auth/sessions/${s.id}`); show("Session déconnectée"); }} style={{ padding: "6px 12px", borderRadius: 8, background: S.redBg, border: `1px solid ${S.red}`, color: S.red, fontSize: 12, cursor: "pointer" }}>
                    Déconnecter
                  </button>
                )}
              </div>
            ))}
          </FormStack>
        </Card>
      )}

      <Card>
        <SectionTitle>Export de mes données (RGPD / LPD art. 25)</SectionTitle>
        <FormStack>
          <p style={{ fontSize: 13, color: S.text2 }}>Téléchargez l'intégralité de vos données personnelles stockées sur Althy, conformément au RGPD et à la LPD suisse.</p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button onClick={exportData} style={{ flex: 1, padding: "10px 16px", borderRadius: 10, background: S.blueBg, border: `1px solid ${S.blue}`, color: S.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Download size={14} /> Export JSON (toutes données)
            </button>
            <button onClick={exportCSV} style={{ flex: 1, padding: "10px 16px", borderRadius: 10, background: S.greenBg, border: `1px solid ${S.green}`, color: S.green, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Download size={14} /> Export CSV (loyers)
            </button>
          </div>
          <button onClick={() => window.location.href = "mailto:privacy@althy.ch"} style={{ padding: "10px 16px", borderRadius: 10, background: S.surface2, border: `1px solid ${S.border}`, color: S.text2, fontSize: 13, cursor: "pointer" }}>
            Contacter le DPO — privacy@althy.ch
          </button>
        </FormStack>
      </Card>

      <Card style={{ border: `1px solid ${S.red}` }}>
        <SectionTitle>Zone de danger</SectionTitle>
        <FormStack>
          <p style={{ fontSize: 13, color: S.text2 }}>La suppression de votre compte est irréversible. Toutes vos données seront effacées dans un délai de 30 jours (LPD art. 25 / RGPD art. 17).</p>
          <Field label={`Tapez "SUPPRIMER" pour confirmer`} value={deleteConfirm} onChange={setDeleteConfirm} placeholder="SUPPRIMER" />
          <button onClick={requestDelete} disabled={deleteConfirm !== "SUPPRIMER" || deletingAccount} style={{ padding: "11px 0", borderRadius: 12, background: deleteConfirm === "SUPPRIMER" ? S.red : S.surface2, border: "none", color: deleteConfirm === "SUPPRIMER" ? "#fff" : S.text3, fontSize: 14, fontWeight: 700, cursor: deleteConfirm === "SUPPRIMER" ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
            <Trash2 size={14} style={{ display: "inline", marginRight: 6 }} />
            Demander la suppression du compte
          </button>
        </FormStack>
      </Card>
    </FormStack>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 6 — ÉQUIPE (agence)
// ──────────────────────────────────────────────────────────────────────────────
const AGENT_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "agent", label: "Agent standard" },
  { value: "readonly", label: "Lecture seule" },
];

function TabEquipe() {
  const qc = useQueryClient();
  const { show, Toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("agent");
  const [inviting, setInviting] = useState(false);

  const { data: team } = useQuery({ queryKey: ["team"], queryFn: async () => { const { data } = await api.get("/agency/team"); return data; }, staleTime: 30_000, retry: false });

  async function invite() {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      await api.post("/agency/invite", { email: inviteEmail, role: inviteRole });
      show(`Invitation envoyée à ${inviteEmail}`);
      setInviteEmail(""); qc.invalidateQueries({ queryKey: ["team"] });
    } catch { show("Erreur lors de l'invitation"); } finally { setInviting(false); }
  }

  async function removeAgent(agentId: string) {
    if (!confirm("Supprimer cet agent ? Ses biens seront réassignés.")) return;
    try {
      await api.delete(`/agency/team/${agentId}`);
      qc.invalidateQueries({ queryKey: ["team"] });
      show("Agent supprimé");
    } catch { /* noop */ }
  }

  async function changeRole(agentId: string, newRole: string) {
    try {
      await api.patch(`/agency/team/${agentId}`, { role: newRole });
      qc.invalidateQueries({ queryKey: ["team"] });
      show("Rôle mis à jour");
    } catch { /* noop */ }
  }

  const agentCount = team?.items?.length ?? 0;

  return (
    <FormStack>
      <Toast />
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <SectionTitle>Agents ({agentCount})</SectionTitle>
          <p style={{ fontSize: 12, color: S.orange, fontWeight: 700 }}>CHF {agentCount * 29}/mois</p>
        </div>
        <FormStack>
          {(team?.items ?? []).map((agent: { id: string; first_name: string; last_name: string; email: string; role: string; biens_count: number }) => (
            <div key={agent.id} style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "12px 0", borderBottom: `1px solid ${S.border}` }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: S.orangeBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: S.orange }}>{agent.first_name[0]}{agent.last_name[0]}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{agent.first_name} {agent.last_name}</p>
                <p style={{ fontSize: 11, color: S.text3 }}>{agent.email} · {agent.biens_count} bien{agent.biens_count !== 1 ? "s" : ""}</p>
              </div>
              <select value={agent.role} onChange={e => changeRole(agent.id, e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${S.border}`, background: S.surface, color: S.text, fontSize: 12, cursor: "pointer" }}>
                {AGENT_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <button onClick={() => removeAgent(agent.id)} style={{ padding: 6, borderRadius: 8, background: S.redBg, border: `1px solid ${S.red}`, color: S.red, cursor: "pointer", display: "flex" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </FormStack>
      </Card>

      <Card>
        <SectionTitle>Inviter un agent</SectionTitle>
        <FormStack>
          <Row>
            <Field label="Email" value={inviteEmail} onChange={setInviteEmail} type="email" placeholder="agent@agence.ch" />
            <SelectField label="Rôle" value={inviteRole} onChange={setInviteRole} options={AGENT_ROLES} />
          </Row>
          <p style={{ fontSize: 11, color: S.text3 }}>L'agent recevra un lien d'inscription par email. CHF 29/mois sera ajouté à votre abonnement.</p>
          <button onClick={invite} disabled={inviting || !inviteEmail} style={{ padding: "11px 0", borderRadius: 12, background: inviteEmail ? S.orange : S.surface2, border: "none", color: inviteEmail ? "#fff" : S.text3, fontSize: 14, fontWeight: 700, cursor: inviteEmail ? "pointer" : "not-allowed" }}>
            {inviting ? "Envoi…" : <><Plus size={14} style={{ display: "inline", marginRight: 6 }} />Envoyer l'invitation</>}
          </button>
        </FormStack>
      </Card>
    </FormStack>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 7 — INTÉGRATIONS
// ──────────────────────────────────────────────────────────────────────────────
const PORTALS = [
  { key: "on_homegate",  name: "Homegate",    price: "Tarif Homegate",    note: "4% Althy si flux via plateforme" },
  { key: "on_immoscout", name: "ImmoScout24", price: "Tarif ImmoScout",   note: "4% Althy si flux via plateforme" },
  { key: "on_comparis",  name: "Comparis",    price: "Tarif Comparis",    note: "4% Althy si flux via plateforme" },
  { key: "on_anibis",    name: "Anibis",      price: "Tarif Anibis",      note: "4% Althy si flux via plateforme" },
  { key: "on_airbnb",    name: "Airbnb",      price: "Commission Airbnb", note: "4% Althy sur réservations reçues" },
  { key: "on_booking",   name: "Booking.com", price: "Commission Booking",note: "4% Althy sur réservations reçues" },
];
const SOCIAL_PROVIDERS = [
  { key: "instagram", name: "Instagram", icon: "📸" },
  { key: "facebook", name: "Facebook", icon: "📘" },
  { key: "linkedin", name: "LinkedIn", icon: "💼" },
  { key: "tiktok", name: "TikTok", icon: "🎵", note: "An 2" },
];

function TabIntegrations() {
  const { show, Toast } = useToast();
  const qc = useQueryClient();
  const { data: integrations } = useQuery({ queryKey: ["integrations"], queryFn: async () => { const { data } = await api.get("/auth/integrations"); return data; }, staleTime: 30_000, retry: false });

  const connectMut = useMutation({
    mutationFn: ({ provider }: { provider: string }) => api.post(`/auth/integrations/${provider}/connect`),
    onSuccess: (data, { provider }) => { if (data.data?.auth_url) window.location.href = data.data.auth_url; qc.invalidateQueries({ queryKey: ["integrations"] }); },
  });
  const disconnectMut = useMutation({
    mutationFn: ({ provider }: { provider: string }) => api.delete(`/auth/integrations/${provider}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["integrations"] }); show("Intégration déconnectée"); },
  });

  const connected = (provider: string) => integrations?.items?.find((i: { provider: string }) => i.provider === provider);
  const [portals, setPortals] = useState<Record<string, boolean>>({});

  return (
    <FormStack>
      <Toast />
      {/* Email */}
      <Card>
        <SectionTitle>Email</SectionTitle>
        <FormStack>
          {[{ key: "gmail", label: "Gmail" }, { key: "outlook", label: "Outlook / Microsoft" }].map(p => {
            const conn = connected(p.key);
            return (
              <div key={p.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{p.label}</p>
                  {conn ? <p style={{ fontSize: 11, color: S.green }}>Connecté : {conn.email}</p> : <p style={{ fontSize: 11, color: S.text3 }}>Non connecté</p>}
                </div>
                {conn
                  ? <button onClick={() => disconnectMut.mutate({ provider: p.key })} style={{ padding: "7px 14px", borderRadius: 8, background: S.redBg, border: `1px solid ${S.red}`, color: S.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Déconnecter</button>
                  : <button onClick={() => connectMut.mutate({ provider: p.key })} style={{ padding: "7px 14px", borderRadius: 8, background: S.orangeBg, border: `1px solid ${S.orange}`, color: S.orange, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Connecter</button>
                }
              </div>
            );
          })}
        </FormStack>
      </Card>

      {/* Agenda */}
      <Card>
        <SectionTitle>Agenda</SectionTitle>
        <FormStack>
          {[{ key: "google_calendar", label: "Google Calendar" }, { key: "outlook_calendar", label: "Outlook Calendar" }].map(p => {
            const conn = connected(p.key);
            return (
              <div key={p.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{p.label}</p>
                  {conn ? <p style={{ fontSize: 11, color: S.green }}>Synchronisé</p> : <p style={{ fontSize: 11, color: S.text3 }}>Non connecté</p>}
                </div>
                {conn
                  ? <button onClick={() => disconnectMut.mutate({ provider: p.key })} style={{ padding: "7px 14px", borderRadius: 8, background: S.redBg, border: `1px solid ${S.red}`, color: S.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Déconnecter</button>
                  : <button onClick={() => connectMut.mutate({ provider: p.key })} style={{ padding: "7px 14px", borderRadius: 8, background: S.orangeBg, border: `1px solid ${S.orange}`, color: S.orange, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Connecter</button>
                }
              </div>
            );
          })}
        </FormStack>
      </Card>

      {/* WhatsApp */}
      <Card>
        <SectionTitle>WhatsApp</SectionTitle>
        <div style={{ padding: "1rem", background: S.greenBg, borderRadius: 12, border: `1px solid ${S.green}` }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: S.green, marginBottom: 4 }}>Phase 1 — Aucune connexion requise</p>
          <p style={{ fontSize: 12, color: S.text2 }}>Les liens WhatsApp (<code>wa.me/</code>) sont générés automatiquement depuis votre numéro de téléphone enregistré dans le profil.</p>
        </div>
      </Card>

      {/* Portails */}
      <Card>
        <SectionTitle>Portails immobiliers</SectionTitle>
        <p style={{ fontSize: 11, color: S.text3, marginBottom: "0.75rem" }}>Althy prélève 4% sur les paiements reçus via la plateforme. Paiement direct au portail : facturation séparée des 4%.</p>
        <FormStack>
          {PORTALS.map(p => (
            <div key={p.key} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{p.name}</p>
                <p style={{ fontSize: 11, color: S.orange, fontWeight: 600 }}>{p.price}</p>
                <p style={{ fontSize: 10, color: S.text3 }}>{p.note}</p>
              </div>
              <button onClick={() => setPortals(prev => ({ ...prev, [p.key]: !prev[p.key] }))} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: portals[p.key] ? S.orange : S.border, position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
                <span style={{ position: "absolute", top: 3, left: portals[p.key] ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </button>
            </div>
          ))}
        </FormStack>
      </Card>

      {/* Réseaux sociaux */}
      <Card>
        <SectionTitle>Réseaux sociaux</SectionTitle>
        <FormStack>
          {SOCIAL_PROVIDERS.map(p => {
            const conn = connected(p.key);
            return (
              <div key={p.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{p.icon}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{p.name} {p.note ? <span style={{ fontSize: 10, color: S.text3 }}>({p.note})</span> : null}</p>
                    {conn
                      ? <p style={{ fontSize: 11, color: S.green }}>Connecté · Dernière publi. : {conn.last_post ? new Date(conn.last_post).toLocaleDateString("fr-CH") : "—"}</p>
                      : <p style={{ fontSize: 11, color: S.text3 }}>Non connecté</p>
                    }
                  </div>
                </div>
                {p.note === "An 2"
                  ? <Badge>Bientôt</Badge>
                  : conn
                    ? <button onClick={() => disconnectMut.mutate({ provider: p.key })} style={{ padding: "7px 14px", borderRadius: 8, background: S.redBg, border: `1px solid ${S.red}`, color: S.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Déconnecter</button>
                    : <button onClick={() => connectMut.mutate({ provider: p.key })} style={{ padding: "7px 14px", borderRadius: 8, background: S.orangeBg, border: `1px solid ${S.orange}`, color: S.orange, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Connecter</button>
                }
              </div>
            );
          })}
        </FormStack>
      </Card>
    </FormStack>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAB 8 — COMPTABILITÉ
// ──────────────────────────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = ["Entretien courant", "Réparations", "Charges communes", "Assurances", "Impôts fonciers", "Honoraires de gestion", "Travaux de rénovation", "Frais divers"];

function TabComptabilite() {
  const { show, Toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    fiscal_year_start: "01-01", devise: "CHF", export_format: "pdf",
    export_auto: false, export_email: "", invoice_logo: true, invoice_conditions: "Paiement à 30 jours",
  });
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [newCategory, setNewCategory] = useState("");
  const set = (k: string, v: unknown) => setF(prev => ({ ...prev, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      await api.patch("/auth/me", { fiscal_year_start: f.fiscal_year_start, devise: f.devise, export_format: f.export_format, export_auto: f.export_auto, export_email: f.export_email || undefined, invoice_logo: f.invoice_logo, invoice_conditions: f.invoice_conditions, expense_categories: categories });
      show("Paramètres comptables sauvegardés");
    } catch { /* noop */ } finally { setSaving(false); }
  }

  return (
    <FormStack>
      <Toast />
      <Card>
        <SectionTitle>Exercice fiscal</SectionTitle>
        <FormStack>
          <Row>
            <SelectField label="Début de l'exercice" value={f.fiscal_year_start} onChange={v => set("fiscal_year_start", v)} options={[
              { value: "01-01", label: "1er janvier" }, { value: "04-01", label: "1er avril" },
              { value: "07-01", label: "1er juillet" }, { value: "10-01", label: "1er octobre" },
            ]} hint="01.01 par défaut (standard suisse)" />
            <SelectField label="Devise" value={f.devise} onChange={v => set("devise", v)} options={[
              { value: "CHF", label: "CHF (Franc suisse)" }, { value: "EUR", label: "EUR (Euro)" },
            ]} />
          </Row>
        </FormStack>
      </Card>

      <Card>
        <SectionTitle>Format des factures générées</SectionTitle>
        <FormStack>
          <Toggle label="Inclure le logo agence/propriétaire" value={f.invoice_logo} onChange={v => set("invoice_logo", v)} />
          <Field label="Conditions de paiement" value={f.invoice_conditions} onChange={v => set("invoice_conditions", v)} placeholder="Paiement à 30 jours" />
        </FormStack>
      </Card>

      <Card>
        <SectionTitle>Catégories de dépenses</SectionTitle>
        <FormStack>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {categories.map(cat => (
              <div key={cat} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 20, background: S.surface2, border: `1px solid ${S.border}`, fontSize: 12 }}>
                <span style={{ color: S.text }}>{cat}</span>
                <button onClick={() => setCategories(prev => prev.filter(c => c !== cat))} style={{ background: "none", border: "none", cursor: "pointer", color: S.text3, padding: 0, lineHeight: 1 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Nouvelle catégorie…" onKeyDown={e => { if (e.key === "Enter" && newCategory.trim()) { setCategories(prev => [...prev, newCategory.trim()]); setNewCategory(""); } }} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid ${S.border}`, background: S.surface, color: S.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            <button onClick={() => { if (newCategory.trim()) { setCategories(prev => [...prev, newCategory.trim()]); setNewCategory(""); } }} style={{ padding: "10px 16px", borderRadius: 10, background: S.orange, border: "none", color: "#fff", cursor: "pointer" }}>
              <Plus size={16} />
            </button>
          </div>
        </FormStack>
      </Card>

      <Card>
        <SectionTitle>Export automatique mensuel</SectionTitle>
        <FormStack>
          <Toggle label="Envoyer un export mensuel automatique" hint="À votre expert-comptable ou à vous-même" value={f.export_auto} onChange={v => set("export_auto", v)} />
          {f.export_auto && (
            <Field label="Email destinataire" value={f.export_email} onChange={v => set("export_email", v)} type="email" placeholder="comptable@cabinet.ch" />
          )}
          <div>
            <FieldLabel>Format d'export</FieldLabel>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: 6 }}>
              {[{ v: "pdf", l: "PDF" }, { v: "excel", l: "Excel" }, { v: "csv", l: "CSV" }].map(o => (
                <button key={o.v} onClick={() => set("export_format", o.v)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${f.export_format === o.v ? S.orange : S.border}`, background: f.export_format === o.v ? S.orangeBg : S.surface, color: f.export_format === o.v ? S.orange : S.text, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        </FormStack>
      </Card>

      <SaveBtn saving={saving} saved={false} onClick={save} />
    </FormStack>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TABS CONFIG
// ──────────────────────────────────────────────────────────────────────────────
type TabId = "identite" | "zone" | "paiement" | "notifications" | "securite" | "equipe" | "integrations" | "comptabilite";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ElementType;
  condition?: (r: ReturnType<typeof useRole>) => boolean;
}

const ALL_TABS: TabDef[] = [
  { id: "identite",      label: "Identité",        icon: User },
  { id: "zone",          label: "Zone",             icon: MapPin,     condition: r => r.isMarketplace || r.isHunter },
  { id: "paiement",      label: "Paiement",         icon: CreditCard },
  { id: "notifications", label: "Notifications",    icon: Bell },
  { id: "securite",      label: "Sécurité",         icon: Shield },
  { id: "equipe",        label: "Équipe",           icon: Users,      condition: r => r.isAgence },
  { id: "integrations",  label: "Intégrations",     icon: Link2,      condition: r => r.isManager },
  { id: "comptabilite",  label: "Comptabilité",     icon: Calculator, condition: r => r.isManager },
];

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const roleCtx = useRole();
  const [activeTab, setActiveTab] = useState<TabId>("identite");

  const tabs = ALL_TABS.filter(t => !t.condition || t.condition(roleCtx));

  // Reset to first visible tab if current becomes hidden
  useEffect(() => {
    if (!tabs.find(t => t.id === activeTab)) setActiveTab(tabs[0]?.id ?? "identite");
  }, [tabs, activeTab]);

  function renderContent() {
    switch (activeTab) {
      case "identite":      return <TabIdentite />;
      case "zone":          return <TabZone />;
      case "paiement":      return <TabPaiement />;
      case "notifications": return <TabNotifications />;
      case "securite":      return <TabSecurite />;
      case "equipe":        return <TabEquipe />;
      case "integrations":  return <TabIntegrations />;
      case "comptabilite":  return <TabComptabilite />;
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: S.bg, padding: "1.5rem" }}>
      {/* Page header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 300, color: S.text, marginBottom: 4 }}>
          Paramètres
        </h1>
        <p style={{ fontSize: 13, color: S.text3 }}>
          {roleCtx.label} · {roleCtx.price ?? ""}
        </p>
      </div>

      <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>

        {/* ── Sidebar (desktop) ────────────────────────────────────────────── */}
        <nav style={{ width: 220, flexShrink: 0, display: "none" }} className="settings-sidebar">
          <div style={{ background: S.surface, borderRadius: 16, border: `1px solid ${S.border}`, boxShadow: S.shadow, overflow: "hidden" }}>
            {tabs.map((tab, i) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "13px 16px", background: active ? S.orangeBg : "transparent", borderLeft: `3px solid ${active ? S.orange : "transparent"}`, borderRight: "none", borderTop: i === 0 ? "none" : `1px solid ${S.border}`, borderBottom: "none", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                  <Icon size={16} style={{ color: active ? S.orange : S.text3, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? S.orange : S.text2 }}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, paddingBottom: "5rem" }}>
          {renderContent()}
        </div>
      </div>

      {/* ── Bottom tabs (mobile) ─────────────────────────────────────────── */}
      <div className="settings-mobile-tabs" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: S.surface, borderTop: `1px solid ${S.border}`, display: "flex", overflowX: "auto", zIndex: 100, boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 16px", gap: 3, background: "none", border: "none", cursor: "pointer", borderTop: `2px solid ${active ? S.orange : "transparent"}` }}>
              <Icon size={18} style={{ color: active ? S.orange : S.text3 }} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? S.orange : S.text3, whiteSpace: "nowrap" }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <style>{`
        @media (min-width: 768px) {
          .settings-sidebar { display: block !important; }
          .settings-mobile-tabs { display: none !important; }
        }
      `}</style>
    </div>
  );
}
