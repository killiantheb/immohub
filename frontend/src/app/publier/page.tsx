"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  X,
  Sparkles,
  Loader2,
  Building2,
  MapPin,
  ChevronRight,
  ExternalLink,
  Star,
  Calendar,
  GripVertical,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

const API    = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const ORANGE = "#E8602C";
const BUCKET = "listings-photos";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormData {
  // étape 1
  mode:         "existing" | "new";
  property_id:  string;
  // nouveau bien
  type:         string;
  adresse:      string;
  ville:        string;
  code_postal:  string;
  canton:       string;
  surface:      string;
  pieces:       string;
  // étape 2
  photos:       string[];
  // étape 3
  transaction_type: "location" | "vente" | "colocation";
  prix:         string;
  charges:      string;
  caution:      string;
  disponible_le: string;
  is_furnished: boolean;
  has_parking:  boolean;
  has_balcony:  boolean;
  has_terrace:  boolean;
  has_garden:   boolean;
  pets_allowed: boolean;
  description:  string;
  tags_ia:      string[];
  // étape 4
  is_premium:   boolean;
}

interface ExistingProperty {
  id:    string;
  titre?: string;
  adresse_affichee?: string;
  ville?: string;
  type_label?: string;
}

const INITIAL: FormData = {
  mode: "new", property_id: "",
  type: "apartment", adresse: "", ville: "", code_postal: "", canton: "VD",
  surface: "", pieces: "",
  photos: [],
  transaction_type: "location", prix: "", charges: "", caution: "",
  disponible_le: "", is_furnished: false, has_parking: false,
  has_balcony: false, has_terrace: false, has_garden: false, pets_allowed: false,
  description: "", tags_ia: [],
  is_premium: false,
};

const STEPS = ["Votre bien", "Photos", "Annonce IA", "Publication"];

const TYPES = [
  { value: "apartment", label: "Appartement" },
  { value: "villa",     label: "Villa / Maison" },
  { value: "studio",    label: "Studio" },
  { value: "parking",   label: "Parking / Box" },
  { value: "office",    label: "Bureau / Commerce" },
];

const CANTONS = ["VD","GE","VS","FR","NE","JU","BE","ZH","BS","AG","SG","LU","TI"];

const TX_LABELS: Record<string, string> = {
  location: "Location", vente: "Vente", colocation: "Colocation",
};

function fmtCHF(n: string) {
  const v = parseFloat(n);
  return isNaN(v) ? "—" : new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(v);
}

// ── Composants UI ─────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: done ? "#2E5E22" : active ? ORANGE : "var(--althy-border)",
                color: done || active ? "#fff" : "var(--althy-text-3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 600, transition: "background 0.2s",
              }}>
                {done ? <Check size={15} /> : n}
              </div>
              <span style={{
                fontSize: 11, fontWeight: active ? 600 : 400,
                color: active ? ORANGE : done ? "#2E5E22" : "var(--althy-text-3)",
                whiteSpace: "nowrap",
              }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: "0 8px", marginBottom: 20,
                background: done ? "#2E5E22" : "var(--althy-border)",
                transition: "background 0.2s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "7px 14px", borderRadius: 20,
        border: `1.5px solid ${value ? ORANGE : "var(--althy-border)"}`,
        background: value ? "rgba(232,96,44,0.08)" : "transparent",
        color: value ? ORANGE : "var(--althy-text-2)",
        cursor: "pointer", fontSize: 13, fontWeight: value ? 600 : 400,
        transition: "all 0.15s",
      }}
    >
      {value && <Check size={12} />}
      {label}
    </button>
  );
}

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--althy-text-2)", marginBottom: 5 }}>
        {label}{required && <span style={{ color: ORANGE }}> *</span>}
      </label>
      {children}
      {hint && <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--althy-text-3)" }}>{hint}</p>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1.5px solid var(--althy-border)",
  borderRadius: "var(--radius-elem)", fontSize: 13, outline: "none",
  background: "var(--althy-bg)", color: "var(--althy-text)", boxSizing: "border-box",
  fontFamily: "inherit",
};

// ── Étape 1 — Quel bien ? ─────────────────────────────────────────────────────

function Step1({
  form, set, token,
}: {
  form: FormData;
  set: (k: keyof FormData, v: unknown) => void;
  token: string;
}) {
  const [properties, setProperties] = useState<ExistingProperty[]>([]);
  const [loadingProps, setLoadingProps] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<string | null>(null);

  // Charger les biens existants
  useEffect(() => {
    if (!token) return;
    setLoadingProps(true);
    fetch(`${API}/properties?page=1&size=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const items: ExistingProperty[] = data?.items ?? data ?? [];
        setProperties(items);
      })
      .catch(() => null)
      .finally(() => setLoadingProps(false));
  }, [token]);

  async function geocode() {
    if (!form.adresse || !form.ville) return;
    setGeocoding(true);
    setGeocodeResult(null);
    try {
      const q = `${form.adresse}, ${form.code_postal} ${form.ville}, Switzerland`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=ch`,
        { headers: { "Accept-Language": "fr", "User-Agent": "Althy/1.0 contact@althy.ch" } },
      );
      const data = await res.json();
      if (data[0]) {
        const disp = data[0].display_name as string;
        setGeocodeResult(`✓ Adresse localisée — ${disp.split(",").slice(0,3).join(",")}`);
      } else {
        setGeocodeResult("⚠ Adresse non trouvée — vérifiez et continuez quand même");
      }
    } catch {
      setGeocodeResult("⚠ Impossible de géolocaliser — vérifiez votre connexion");
    } finally {
      setGeocoding(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Choix mode */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {(["existing", "new"] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => set("mode", m)}
            style={{
              padding: "16px 14px", borderRadius: "var(--radius-card)",
              border: `2px solid ${form.mode === m ? ORANGE : "var(--althy-border)"}`,
              background: form.mode === m ? "rgba(232,96,44,0.06)" : "var(--althy-surface)",
              cursor: "pointer", textAlign: "left", transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: form.mode === m ? ORANGE : "var(--althy-text)", marginBottom: 3 }}>
              {m === "existing" ? "🏠 Mes biens existants" : "➕ Nouveau bien"}
            </div>
            <div style={{ fontSize: 12, color: "var(--althy-text-3)" }}>
              {m === "existing" ? "Publier depuis mon portefeuille" : "Créer et publier maintenant"}
            </div>
          </button>
        ))}
      </div>

      {/* Option A — Biens existants */}
      {form.mode === "existing" && (
        <Field label="Sélectionner votre bien" required>
          {loadingProps ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--althy-text-3)", fontSize: 13 }}>
              <Loader2 size={14} style={{ animation: "pub-spin 0.9s linear infinite" }} />
              Chargement de vos biens…
            </div>
          ) : properties.length === 0 ? (
            <div style={{
              padding: "14px 16px", borderRadius: "var(--radius-elem)",
              background: "rgba(232,96,44,0.06)", border: "1px solid rgba(232,96,44,0.20)",
              color: "var(--althy-text-2)", fontSize: 13,
            }}>
              Aucun bien dans votre portefeuille.{" "}
              <button
                onClick={() => set("mode", "new")}
                style={{ background: "none", border: "none", color: ORANGE, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
              >
                Créer un nouveau bien →
              </button>
            </div>
          ) : (
            <select
              style={inputStyle}
              value={form.property_id}
              onChange={e => set("property_id", e.target.value)}
            >
              <option value="">— Choisir un bien —</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.titre ?? p.adresse_affichee ?? p.id} {p.ville ? `· ${p.ville}` : ""}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      {/* Option B — Nouveau bien */}
      {form.mode === "new" && (
        <>
          {/* Type de bien */}
          <Field label="Type de bien" required>
            <select style={inputStyle} value={form.type} onChange={e => set("type", e.target.value)}>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>

          {/* Adresse */}
          <Field label="Adresse" required>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={form.adresse}
                onChange={e => set("adresse", e.target.value)}
                onBlur={geocode}
                placeholder="Rue de la Paix 12"
              />
              <button
                type="button"
                onClick={geocode}
                disabled={geocoding || !form.adresse}
                title="Géolocaliser l'adresse"
                style={{
                  padding: "9px 13px", borderRadius: "var(--radius-elem)",
                  border: `1.5px solid var(--althy-border)`,
                  background: "var(--althy-surface)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--althy-text-3)", flexShrink: 0,
                  opacity: geocoding || !form.adresse ? 0.5 : 1,
                }}
              >
                {geocoding ? <Loader2 size={16} style={{ animation: "pub-spin 0.9s linear infinite" }} /> : <MapPin size={16} />}
              </button>
            </div>
            {geocodeResult && (
              <p style={{
                margin: "5px 0 0", fontSize: 11,
                color: geocodeResult.startsWith("✓") ? "#2E5E22" : "#B45309",
              }}>
                {geocodeResult}
              </p>
            )}
          </Field>

          {/* Ville + CP + Canton */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 90px", gap: 10 }}>
            <Field label="Ville" required>
              <input style={inputStyle} value={form.ville} onChange={e => set("ville", e.target.value)} placeholder="Lausanne" />
            </Field>
            <Field label="Code postal" required>
              <input style={inputStyle} value={form.code_postal} onChange={e => set("code_postal", e.target.value)} placeholder="1000" maxLength={4} />
            </Field>
            <Field label="Canton">
              <select style={inputStyle} value={form.canton} onChange={e => set("canton", e.target.value)}>
                {CANTONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          {/* Surface + Pièces */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Surface (m²)">
              <input style={inputStyle} type="number" value={form.surface} onChange={e => set("surface", e.target.value)} placeholder="65" min={0} />
            </Field>
            <Field label="Pièces">
              <input style={inputStyle} type="number" value={form.pieces} onChange={e => set("pieces", e.target.value)} placeholder="3.5" min={0} step={0.5} />
            </Field>
          </div>
        </>
      )}
    </div>
  );
}

// ── Étape 2 — Photos ──────────────────────────────────────────────────────────

function Step2({
  form, set, token,
}: {
  form: FormData;
  set: (k: keyof FormData, v: unknown) => void;
  token: string;
}) {
  const [uploading, setUploading]   = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [progress, setProgress]     = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files).slice(0, 10 - form.photos.length);
    if (!arr.length) return;
    setUploading(true);
    setProgress(0);
    const supabase = createClient();
    const uploaded: string[] = [];
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      if (file.size > 5 * 1024 * 1024) continue;
      const ext  = file.name.split(".").pop() ?? "jpg";
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
        uploaded.push(publicUrl);
      }
      setProgress(Math.round(((i + 1) / arr.length) * 100));
    }
    set("photos", [...form.photos, ...uploaded]);
    setUploading(false);
    setProgress(0);
  }

  function removePhoto(url: string) {
    set("photos", form.photos.filter(p => p !== url));
  }

  function setCover(url: string) {
    const rest = form.photos.filter(p => p !== url);
    set("photos", [url, ...rest]);
  }

  // Drag-to-reorder
  function onDragStart(i: number) { dragIndexRef.current = i; }
  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === i) return;
    const arr = [...form.photos];
    const [item] = arr.splice(from, 1);
    arr.splice(i, 0, item);
    dragIndexRef.current = i;
    set("photos", arr);
  }
  function onDragEnd() { dragIndexRef.current = null; }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Compteur */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--althy-text-2)", fontWeight: 600 }}>
          {form.photos.length}/10 photos
        </span>
        {form.photos.length > 0 && (
          <span style={{ fontSize: 11, color: "var(--althy-text-3)" }}>
            Faites glisser pour réordonner · 1re photo = couverture
          </span>
        )}
      </div>

      {/* Drop zone */}
      {form.photos.length < 10 && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? ORANGE : "var(--althy-border)"}`,
            borderRadius: "var(--radius-card)",
            background: dragOver ? "rgba(232,96,44,0.06)" : "var(--althy-bg)",
            padding: "36px 24px", textAlign: "center",
            cursor: "pointer", transition: "all 0.15s",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={e => e.target.files && uploadFiles(e.target.files)}
          />
          {uploading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <Loader2 size={28} color={ORANGE} style={{ animation: "pub-spin 0.9s linear infinite" }} />
              <p style={{ color: "var(--althy-text-2)", fontSize: 14, margin: 0 }}>Téléchargement… {progress}%</p>
              <div style={{ width: "60%", height: 4, borderRadius: 2, background: "var(--althy-border)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: ORANGE, transition: "width 0.2s" }} />
              </div>
            </div>
          ) : (
            <>
              <Upload size={30} color="var(--althy-text-3)" style={{ marginBottom: 10, opacity: 0.45 }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--althy-text-2)", margin: "0 0 4px" }}>
                Glissez vos photos ici
              </p>
              <p style={{ fontSize: 12, color: "var(--althy-text-3)", margin: 0 }}>
                ou cliquez — JPG, PNG, WebP · max 5 Mo · max 10 photos
              </p>
            </>
          )}
        </div>
      )}

      {/* Grille de prévisualisation avec reorder */}
      {form.photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {form.photos.map((url, i) => (
            <div
              key={url}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={e => onDragOver(e, i)}
              onDragEnd={onDragEnd}
              style={{
                position: "relative", borderRadius: "var(--radius-elem)",
                overflow: "hidden", aspectRatio: "4/3",
                border: i === 0 ? `2px solid ${ORANGE}` : "2px solid transparent",
                cursor: "grab",
              }}
            >
              <img src={url} alt={`Photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />

              {/* Grip */}
              <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.5)", borderRadius: 4, padding: "2px 4px" }}>
                <GripVertical size={12} color="#fff" />
              </div>

              {/* Supprimer */}
              <button
                onClick={() => removePhoto(url)}
                style={{
                  position: "absolute", top: 6, right: 6,
                  background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%",
                  width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#fff",
                }}
              >
                <X size={13} />
              </button>

              {/* Badge cover */}
              {i === 0 ? (
                <span style={{
                  position: "absolute", bottom: 6, left: 6,
                  background: ORANGE, color: "#fff",
                  fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 3,
                }}>
                  Couverture
                </span>
              ) : (
                <button
                  onClick={() => setCover(url)}
                  style={{
                    position: "absolute", bottom: 6, left: 6,
                    background: "rgba(0,0,0,0.45)", border: "none", borderRadius: 3,
                    color: "#fff", fontSize: 10, fontWeight: 500, padding: "2px 7px",
                    cursor: "pointer",
                  }}
                >
                  Définir couverture
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p style={{ color: form.photos.length === 0 ? "var(--althy-text-3)" : ORANGE, fontSize: 12, textAlign: "center", margin: 0, fontWeight: form.photos.length === 0 ? 400 : 600 }}>
        {form.photos.length === 0
          ? "1 photo minimum requise · les biens avec photos reçoivent 3× plus de contacts"
          : `${form.photos.length} photo${form.photos.length > 1 ? "s" : ""} prête${form.photos.length > 1 ? "s" : ""} ✓`}
      </p>
    </div>
  );
}

// ── Étape 3 — Annonce IA ──────────────────────────────────────────────────────

function Step3({
  form, set, token,
}: {
  form: FormData;
  set: (k: keyof FormData, v: unknown) => void;
  token: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [generated,  setGenerated]  = useState(false);
  const [tagInput,   setTagInput]   = useState("");

  async function generate() {
    setGenerating(true);
    set("description", "");
    try {
      const res = await fetch(`${API}/ai/generer-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: form.type,
          transaction_type: form.transaction_type,
          ville: form.ville,
          surface:   form.surface   ? parseFloat(form.surface)  : undefined,
          pieces:    form.pieces    ? parseFloat(form.pieces)   : undefined,
          prix:      form.prix      ? parseFloat(form.prix)     : undefined,
          charges:   form.charges   ? parseFloat(form.charges)  : undefined,
          is_furnished: form.is_furnished, has_parking: form.has_parking,
          has_balcony: form.has_balcony, has_terrace: form.has_terrace,
          has_garden: form.has_garden, pets_allowed: form.pets_allowed,
        }),
      });

      if (!res.ok) { setGenerating(false); return; }

      const contentType = res.headers.get("content-type") ?? "";

      if (contentType.includes("text/event-stream")) {
        // SSE streaming — typewriter via reader
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const token = line.slice(6).trim();
            if (token === "[DONE]") break;
            acc += token;
            set("description", acc);
          }
        }
      } else {
        // JSON response — simulate typewriter
        const data = await res.json();
        const full: string = data.description ?? data.text ?? "";
        const tags: string[] = data.tags_ia ?? [];
        set("tags_ia", tags);
        // Typewriter effect
        let i = 0;
        const interval = setInterval(() => {
          i = Math.min(i + 4, full.length);
          set("description", full.slice(0, i));
          if (i >= full.length) clearInterval(interval);
        }, 16);
      }

      setGenerated(true);
    } catch {
      // silently fail — user can still type manually
    } finally {
      setGenerating(false);
    }
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags_ia.includes(t)) set("tags_ia", [...form.tags_ia, t]);
    setTagInput("");
  }

  const isVente = form.transaction_type === "vente";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Transaction type */}
      <Field label="Type de transaction" required>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["location","colocation","vente"] as const).map(tx => (
            <button
              key={tx}
              type="button"
              onClick={() => set("transaction_type", tx)}
              style={{
                padding: "8px 18px", borderRadius: 20,
                border: `2px solid ${form.transaction_type === tx ? ORANGE : "var(--althy-border)"}`,
                background: form.transaction_type === tx ? "rgba(232,96,44,0.08)" : "transparent",
                color: form.transaction_type === tx ? ORANGE : "var(--althy-text-2)",
                cursor: "pointer", fontSize: 13, fontWeight: form.transaction_type === tx ? 700 : 400,
                transition: "all 0.15s",
              }}
            >
              {TX_LABELS[tx]}
            </button>
          ))}
        </div>
      </Field>

      {/* Prix */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label={`Prix CHF${isVente ? "" : "/mois"}`} required>
          <input style={inputStyle} type="number" value={form.prix} onChange={e => set("prix", e.target.value)} placeholder={isVente ? "450 000" : "1 800"} min={0} />
        </Field>
        {!isVente && (
          <Field label="Charges CHF/mois">
            <input style={inputStyle} type="number" value={form.charges} onChange={e => set("charges", e.target.value)} placeholder="150" min={0} />
          </Field>
        )}
        {!isVente && (
          <Field label="Caution CHF">
            <input style={inputStyle} type="number" value={form.caution} onChange={e => set("caution", e.target.value)} placeholder="5 400" min={0} />
          </Field>
        )}
      </div>

      {/* Disponibilité */}
      <Field label="Disponible à partir du">
        <div style={{ position: "relative" }}>
          <Calendar size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--althy-text-3)", pointerEvents: "none" }} />
          <input
            type="date"
            style={{ ...inputStyle, paddingLeft: 32 }}
            value={form.disponible_le}
            onChange={e => set("disponible_le", e.target.value)}
          />
        </div>
      </Field>

      {/* Équipements */}
      <Field label="Équipements & Options">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          <Toggle value={form.is_furnished} onChange={v => set("is_furnished", v)} label="Meublé" />
          <Toggle value={form.has_parking}  onChange={v => set("has_parking",  v)} label="Parking" />
          <Toggle value={form.has_balcony}  onChange={v => set("has_balcony",  v)} label="Balcon" />
          <Toggle value={form.has_terrace}  onChange={v => set("has_terrace",  v)} label="Terrasse" />
          <Toggle value={form.has_garden}   onChange={v => set("has_garden",   v)} label="Jardin" />
          <Toggle value={form.pets_allowed} onChange={v => set("pets_allowed", v)} label="Animaux" />
        </div>
      </Field>

      {/* Description IA */}
      <Field label="Description de l'annonce" hint="Cliquez sur « Générer » pour qu'Althy rédige votre annonce en quelques secondes.">
        <div style={{ position: "relative" }}>
          <textarea
            value={form.description}
            onChange={e => set("description", e.target.value)}
            rows={8}
            placeholder={generating ? "Althy rédige votre annonce..." : "Cliquez sur « Générer avec Althy » ci-dessous…"}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.65, opacity: generating ? 0.6 : 1 }}
          />
          {generating && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
              background: "rgba(255,255,255,0.82)", borderRadius: "var(--radius-elem)", backdropFilter: "blur(2px)",
            }}>
              <Sparkles size={24} color={ORANGE} style={{ animation: "pub-pulse 1.2s ease-in-out infinite" }} />
              <span style={{ fontSize: 13, color: "var(--althy-text-2)", fontWeight: 600 }}>Althy rédige votre annonce…</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={generate}
            disabled={generating}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 16px", borderRadius: "var(--radius-elem)",
              border: "none",
              background: generating ? "var(--althy-border)" : "rgba(232,96,44,0.1)",
              color: ORANGE, fontSize: 12, fontWeight: 700,
              cursor: generating ? "not-allowed" : "pointer",
            }}
          >
            {generating
              ? <Loader2 size={13} style={{ animation: "pub-spin 0.9s linear infinite" }} />
              : <Sparkles size={13} />}
            {generated ? "Régénérer avec Althy" : "Générer avec Althy"}
          </button>
          {form.description.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--althy-text-3)", alignSelf: "center" }}>
              {form.description.length} caractères
            </span>
          )}
        </div>
      </Field>

      {/* Tags IA */}
      <Field label="Mots-clés / Tags IA">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
          {form.tags_ia.map(tag => (
            <span key={tag} style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(232,96,44,0.08)", color: ORANGE,
              fontSize: 12, padding: "4px 10px", borderRadius: 20,
            }}>
              {tag}
              <button
                onClick={() => set("tags_ia", form.tags_ia.filter(t => t !== tag))}
                style={{ background: "none", border: "none", cursor: "pointer", color: ORANGE, padding: 0, lineHeight: 1 }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="Ajouter un mot-clé (Entrée)"
          />
          <button
            onClick={addTag}
            disabled={!tagInput.trim()}
            style={{
              padding: "8px 16px", borderRadius: "var(--radius-elem)",
              border: `1.5px solid ${ORANGE}`, background: "transparent",
              color: ORANGE, fontSize: 13, fontWeight: 600,
              cursor: tagInput.trim() ? "pointer" : "not-allowed",
              opacity: tagInput.trim() ? 1 : 0.5,
            }}
          >
            Ajouter
          </button>
        </div>
      </Field>
    </div>
  );
}

// ── Étape 4 — Publication ─────────────────────────────────────────────────────

function Step4({
  form, set, onEdit,
}: {
  form: FormData;
  set: (k: keyof FormData, v: unknown) => void;
  onEdit: (step: number) => void;
}) {
  const checks = [
    { ok: form.photos.length > 0, label: `Photos (${form.photos.length})`, step: 2 },
    { ok: !!form.prix, label: form.prix ? `Prix : ${fmtCHF(form.prix)}${form.transaction_type !== "vente" ? "/mois" : ""}` : "Prix manquant", step: 3 },
    { ok: form.description.length > 50, label: form.description.length > 50 ? "Description générée ✓" : "Description manquante ou trop courte", step: 3 },
    { ok: !!(form.mode === "existing" ? form.property_id : form.adresse && form.ville), label: "Adresse confirmée", step: 1 },
  ];

  const allOk = checks.every(c => c.ok);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Preview carte */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--althy-text-3)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Aperçu de votre annonce
        </p>
        <div style={{
          background: "var(--althy-surface)", border: "1px solid var(--althy-border)",
          borderRadius: "var(--radius-card)", overflow: "hidden",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}>
          {/* Photo */}
          {form.photos.length > 0 ? (
            <div style={{ height: 168, position: "relative" }}>
              <img src={form.photos[0]} alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <span style={{ position: "absolute", top: 10, left: 10, background: ORANGE, color: "#fff", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4 }}>
                {TX_LABELS[form.transaction_type]}
              </span>
              {form.photos.length > 1 && (
                <span style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 11, padding: "2px 7px", borderRadius: 4 }}>
                  +{form.photos.length - 1} photo{form.photos.length > 2 ? "s" : ""}
                </span>
              )}
            </div>
          ) : (
            <div style={{ height: 100, background: "linear-gradient(135deg, #FEF2EB, rgba(232,96,44,0.1))", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={32} color={ORANGE} style={{ opacity: 0.3 }} />
            </div>
          )}

          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--althy-text)", margin: "0 0 4px" }}>
                  {TYPES.find(t => t.value === form.type)?.label}{form.pieces ? ` · ${form.pieces} pièces` : ""}
                </p>
                <p style={{ fontSize: 12, color: "var(--althy-text-3)", margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin size={11} />{form.adresse || "Adresse non définie"}, {form.ville}
                </p>
              </div>
              <p style={{ fontSize: 20, fontWeight: 700, color: ORANGE, margin: 0 }}>
                {form.prix ? fmtCHF(form.prix) : "—"}
                {form.transaction_type !== "vente" && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--althy-text-3)" }}>/mois</span>}
              </p>
            </div>
            {form.tags_ia.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {form.tags_ia.slice(0, 4).map(tag => (
                  <span key={tag} style={{ background: "rgba(232,96,44,0.08)", color: ORANGE, fontSize: 11, padding: "2px 8px", borderRadius: 20 }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div style={{ background: "var(--althy-bg)", borderRadius: "var(--radius-card)", border: "1px solid var(--althy-border)", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--althy-border)", background: "var(--althy-surface)" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--althy-text)" }}>
            Checklist avant publication
          </p>
        </div>
        {checks.map((c, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 16px",
            borderBottom: i < checks.length - 1 ? "1px solid var(--althy-border)" : "none",
            background: "var(--althy-surface)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: c.ok ? "#EBF4E8" : "rgba(231,76,60,0.10)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {c.ok
                  ? <Check size={12} color="#2E5E22" strokeWidth={2.5} />
                  : <X size={11} color="#C0392B" strokeWidth={2.5} />}
              </div>
              <span style={{ fontSize: 13, color: c.ok ? "var(--althy-text)" : "#C0392B" }}>{c.label}</span>
            </div>
            {!c.ok && (
              <button
                onClick={() => onEdit(c.step)}
                style={{ background: "none", border: "none", color: ORANGE, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Compléter →
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Durée + Premium */}
      <div style={{ background: "var(--althy-surface)", border: "1px solid var(--althy-border)", borderRadius: "var(--radius-card)", padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: "var(--althy-text)" }}>Durée de publication</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--althy-text-3)" }}>30 jours · renouvelable automatiquement</p>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#2E5E22" }}>Gratuit</span>
        </div>

        <div style={{ borderTop: "1px solid var(--althy-border)", paddingTop: 14 }}>
          <button
            type="button"
            onClick={() => set("is_premium", !form.is_premium)}
            style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              background: form.is_premium ? "rgba(245,158,11,0.06)" : "transparent",
              border: `1.5px solid ${form.is_premium ? "#F59E0B" : "var(--althy-border)"}`,
              borderRadius: "var(--radius-elem)", padding: "12px 14px",
              cursor: "pointer", width: "100%", textAlign: "left",
              transition: "all 0.15s",
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
              background: form.is_premium ? "#F59E0B" : "var(--althy-border)",
              display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1,
            }}>
              {form.is_premium ? <Check size={12} color="#fff" strokeWidth={3} /> : <Star size={11} color="#fff" />}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 700, color: form.is_premium ? "#B45309" : "var(--althy-text)" }}>
                Position Premium · +CHF 49/mois
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--althy-text-3)" }}>
                Votre annonce apparaît en 1re position · badge "Premium" · +67% de visibilité
              </p>
            </div>
          </button>
        </div>
      </div>

      {!allOk && (
        <div style={{
          padding: "10px 14px", borderRadius: "var(--radius-elem)",
          background: "rgba(231,76,60,0.07)", border: "1px solid rgba(231,76,60,0.20)",
          color: "#C0392B", fontSize: 13,
        }}>
          Complétez les éléments manquants avant de publier.
        </div>
      )}
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function PublierPage() {
  const router = useRouter();
  const [step,        setStep]        = useState(1);
  const [form,        setForm]        = useState<FormData>(INITIAL);
  const [token,       setToken]       = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [publishing,  setPublishing]  = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [error,       setError]       = useState("");

  function set(key: keyof FormData, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // Vérification auth
  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login?callbackUrl=/publier");
      } else {
        setToken(session.access_token);
        setAuthLoading(false);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validations par étape
  function validateStep(): string {
    if (step === 1) {
      if (form.mode === "existing" && !form.property_id) return "Sélectionnez un bien ou créez-en un nouveau.";
      if (form.mode === "new") {
        if (!form.adresse) return "L'adresse est requise.";
        if (!form.ville)   return "La ville est requise.";
        if (!form.code_postal) return "Le code postal est requis.";
      }
    }
    if (step === 2 && form.photos.length === 0) {
      return "Au moins 1 photo est requise.";
    }
    if (step === 3 && !form.prix) {
      return "Le prix est requis.";
    }
    return "";
  }

  async function handleNext() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError("");
    setStep(s => s + 1);
  }

  async function handlePublier() {
    const checklist = [
      form.photos.length > 0,
      !!form.prix,
      form.description.length > 50,
      form.mode === "existing" ? !!form.property_id : !!(form.adresse && form.ville),
    ];
    if (!checklist.every(Boolean)) {
      setError("Complétez tous les éléments de la checklist avant de publier.");
      return;
    }

    setPublishing(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        transaction_type: form.transaction_type,
        prix:      parseFloat(form.prix),
        charges:   form.charges   ? parseFloat(form.charges)  : null,
        caution:   form.caution   ? parseFloat(form.caution)  : null,
        description: form.description || null,
        tags_ia:   form.tags_ia,
        photos:    form.photos,
        is_premium: form.is_premium,
        disponible_le: form.disponible_le || null,
        is_furnished: form.is_furnished, has_parking: form.has_parking,
        has_balcony: form.has_balcony, has_terrace: form.has_terrace,
        has_garden: form.has_garden, pets_allowed: form.pets_allowed,
      };

      if (form.mode === "existing") {
        body.property_id = form.property_id;
      } else {
        body.type        = form.type;
        body.adresse     = form.adresse;
        body.ville       = form.ville;
        body.code_postal = form.code_postal;
        body.canton      = form.canton;
        body.surface     = form.surface ? parseFloat(form.surface) : null;
        body.pieces      = form.pieces  ? Math.round(parseFloat(form.pieces)) : null;
      }

      const res = await fetch(`${API}/marketplace/publier`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? "Erreur lors de la publication.");
        return;
      }

      const data = await res.json();
      setPublishedId((data as { id: string }).id);
    } catch {
      setError("Erreur réseau — réessayez.");
    } finally {
      setPublishing(false);
    }
  }

  // ── Loading auth ─────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--althy-bg)" }}>
        <Loader2 size={28} color={ORANGE} style={{ animation: "pub-spin 0.9s linear infinite" }} />
        <style>{`@keyframes pub-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  // ── Succès ───────────────────────────────────────────────────────────────

  if (publishedId) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--althy-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{
          background: "var(--althy-surface)", borderRadius: "var(--radius-card)",
          border: "1px solid var(--althy-border)", padding: "44px 36px",
          maxWidth: 440, width: "100%", textAlign: "center",
          boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
        }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#EBF4E8", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
            <Check size={28} color="#2E5E22" />
          </div>
          <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 26, color: "var(--althy-text)", margin: "0 0 8px" }}>
            Votre bien est en ligne !
          </h2>
          <p style={{ color: "var(--althy-text-3)", fontSize: 14, margin: "0 0 10px" }}>
            Votre annonce est visible sur la marketplace Althy.
          </p>
          <p style={{ color: "var(--althy-text-3)", fontSize: 12, margin: "0 0 28px" }}>
            Publication valable 30 jours · renouvelable depuis votre tableau de bord.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href={`/biens/${publishedId}`} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: ORANGE, color: "#fff", padding: "12px 20px",
              borderRadius: "var(--radius-elem)", textDecoration: "none",
              fontSize: 14, fontWeight: 600,
            }}>
              Voir mon annonce <ExternalLink size={14} />
            </Link>
            <Link href="/app" style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1.5px solid var(--althy-border)", color: "var(--althy-text-2)",
              padding: "10px 20px", borderRadius: "var(--radius-elem)",
              textDecoration: "none", fontSize: 13,
            }}>
              Tableau de bord →
            </Link>
          </div>
        </div>
        <style>{`@keyframes pub-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  // ── Wizard ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--althy-bg)" }}>
      <style>{`
        @keyframes pub-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pub-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.15)} }
      `}</style>

      {/* Header */}
      <header style={{
        background: "var(--althy-surface)", borderBottom: "1px solid var(--althy-border)",
        padding: "0 24px", height: 54, display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100,
      }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 300, color: "var(--althy-text)", letterSpacing: "0.05em" }}>
            ALT<span style={{ color: ORANGE }}>H</span>Y
          </span>
        </Link>
        <Link href="/biens" style={{ fontSize: 13, color: "var(--althy-text-3)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={13} /> Retour aux biens
        </Link>
      </header>

      <div style={{ maxWidth: 660, margin: "0 auto", padding: "36px 20px 80px" }}>
        {/* Titre */}
        <div style={{ marginBottom: 30 }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 28, color: "var(--althy-text)", margin: "0 0 4px" }}>
            Publier votre bien
          </h1>
          <p style={{ color: "var(--althy-text-3)", fontSize: 14, margin: 0 }}>
            En ligne en 2 minutes · Althy rédige l'annonce pour vous
          </p>
        </div>

        {/* Progress */}
        <StepIndicator current={step} />

        {/* Contenu de l'étape */}
        <div style={{
          background: "var(--althy-surface)", border: "1px solid var(--althy-border)",
          borderRadius: "var(--radius-card)", padding: "28px 28px",
          boxShadow: "0 2px 14px rgba(0,0,0,0.04)", marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--althy-text)", margin: "0 0 24px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: ORANGE, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {step}
            </span>
            {STEPS[step - 1]}
          </h2>

          {step === 1 && <Step1 form={form} set={set} token={token} />}
          {step === 2 && <Step2 form={form} set={set} token={token} />}
          {step === 3 && <Step3 form={form} set={set} token={token} />}
          {step === 4 && <Step4 form={form} set={set} onEdit={setStep} />}
        </div>

        {/* Erreur */}
        {error && (
          <div style={{
            background: "#FDECEA", border: "1px solid #F5C6CB",
            borderRadius: "var(--radius-elem)", padding: "10px 14px",
            color: "#C0392B", fontSize: 13, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={() => step > 1 ? (setStep(s => s - 1), setError("")) : router.push("/biens")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "1.5px solid var(--althy-border)",
              borderRadius: "var(--radius-elem)", padding: "9px 18px",
              fontSize: 13, color: "var(--althy-text-2)", cursor: "pointer",
            }}
          >
            <ArrowLeft size={14} /> {step === 1 ? "Annuler" : "Retour"}
          </button>

          {step < 4 ? (
            <button
              onClick={handleNext}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: ORANGE, border: "none",
                borderRadius: "var(--radius-elem)", padding: "9px 22px",
                fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer",
              }}
            >
              Continuer <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handlePublier}
              disabled={publishing}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: publishing ? "var(--althy-border)" : ORANGE, border: "none",
                borderRadius: "var(--radius-elem)", padding: "10px 24px",
                fontSize: 14, fontWeight: 700, color: publishing ? "var(--althy-text-3)" : "#fff",
                cursor: publishing ? "not-allowed" : "pointer",
              }}
            >
              {publishing ? (
                <><Loader2 size={14} style={{ animation: "pub-spin 0.9s linear infinite" }} /> Publication en cours…</>
              ) : (
                <>{form.is_premium ? <Star size={14} fill="#fff" /> : null} Publier mon bien <ChevronRight size={14} /></>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
