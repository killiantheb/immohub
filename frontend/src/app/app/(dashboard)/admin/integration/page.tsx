"use client";

/**
 * /app/admin/integration — Intégration clients
 * 3 onglets : Sphère IA (scrape auto) | Lien magique | QR Code
 * Suivi temps réel des sessions via Supabase Realtime.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Download, FileUp, Link2, Loader2, QrCode, RefreshCw, Sparkles, Trash2, Upload, UserPlus, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";

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
  shadow:   "var(--althy-shadow)",
  shadowMd: "var(--althy-shadow-md)",
} as const;

type Tab = "sphere" | "lien" | "qr" | "csv";

const ROLES_DISPONIBLES = [
  { value: "agence",           label: "Agent d'agence" },
  { value: "portail_proprio",  label: "Propriétaire portail" },
  { value: "proprio_solo",     label: "Propriétaire solo" },
  { value: "artisan",          label: "Artisan" },
  { value: "opener",           label: "Ouvreur" },
  { value: "locataire",        label: "Locataire" },
  { value: "hunter",           label: "Hunter" },
  { value: "expert",           label: "Expert" },
];

// ── Shared input style ────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: `1px solid var(--border-subtle)`,
  borderRadius: 10,
  fontSize: 13,
  background: "var(--cream)",
  color: "var(--charcoal)",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-tertiary)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  marginBottom: 5,
};

// ── Field helper ──────────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inp} />
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScrapedData {
  nom_officiel:    string | null;
  adresse:         string | null;
  npa:             string | null;
  ville:           string | null;
  canton:          string | null;
  telephone:       string | null;
  email_contact:   string | null;
  logo_url:        string | null;
  description:     string | null;
  couleur_principale: string | null;
  agents:          Array<{ nom: string; titre: string; email?: string | null }>;
  confidence:      Record<string, number>;
  session_id:      string | null;
}

interface OnboardingSession {
  id:          string;
  role:        string;
  completed:   boolean;
  created_at:  string;
  data:        { requete?: string; synth?: { nom_officiel?: string } };
}

// ── Tab : Sphère IA ───────────────────────────────────────────────────────────

function TabSphere() {
  const [requete,   setRequete]   = useState("");
  const [role,      setRole]      = useState("agence");
  const [loading,   setLoading]   = useState(false);
  const [scraped,   setScraped]   = useState<ScrapedData | null>(null);
  const [edited,    setEdited]    = useState<ScrapedData | null>(null);
  const [sending,   setSending]   = useState(false);
  const [sent,      setSent]      = useState<{ url: string; qr?: string } | null>(null);
  const [erreur,    setErreur]    = useState<string | null>(null);

  // Realtime sessions
  const [sessions, setSessions] = useState<OnboardingSession[]>([]);
  const { data: sessionsData } = useQuery<OnboardingSession[]>({
    queryKey: ["onboarding-sessions"],
    queryFn:  () => api.get("/onboarding/sessions").then(r => r.data).catch(() => []),
    refetchInterval: 10_000,
  });
  useEffect(() => { if (sessionsData) setSessions(sessionsData); }, [sessionsData]);

  // Supabase Realtime — sessions table
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel("onboarding_sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_sessions" }, payload => {
        const row = payload.new as OnboardingSession;
        setSessions(prev => {
          const idx = prev.findIndex(s => s.id === row.id);
          if (idx >= 0) { const next = [...prev]; next[idx] = row; return next; }
          return [row, ...prev].slice(0, 20);
        });
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, []);

  async function analyser() {
    if (!requete.trim()) return;
    setLoading(true);
    setErreur(null);
    setScraped(null);
    setEdited(null);
    setSent(null);
    try {
      const r = await api.post<ScrapedData>("/onboarding/analyser", { requete: requete.trim(), role });
      setScraped(r.data);
      setEdited(r.data);
    } catch {
      setErreur("Impossible d'analyser cette requête. Vérifiez le nom ou l'URL et réessayez.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmer() {
    if (!edited) return;
    setSending(true);
    setErreur(null);
    try {
      const email = edited.email_contact;
      if (!email) { setErreur("Email de contact requis pour envoyer l'invitation."); setSending(false); return; }
      const r = await api.post<{ magic_link_url: string; qr_base64?: string }>("/onboarding/creer-compte", {
        session_id:  scraped?.session_id ?? null,
        donnees:     edited,
        mode_envoi:  "email",
        email:       email,
        role,
      });
      setSent({ url: r.data.magic_link_url, qr: r.data.qr_base64 });
    } catch {
      setErreur("Erreur lors de la création du compte. Réessayez.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Search bar */}
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: 20 }}>
        <p style={{ fontSize: 13, color: S.text3, margin: "0 0 14px" }}>
          Entrez le nom d'une agence, une URL ou une adresse — Althy scrape et synthétise automatiquement.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={requete}
            onChange={e => setRequete(e.target.value)}
            onKeyDown={e => e.key === "Enter" && analyser()}
            placeholder="ex: Agence Dumont Genève ou https://agence-dumont.ch"
            style={{ ...inp, flex: "1 1 280px" }}
          />
          <select value={role} onChange={e => setRole(e.target.value)}
            style={{ ...inp, flex: "0 0 180px", width: "auto" }}>
            {ROLES_DISPONIBLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button onClick={analyser} disabled={loading || !requete.trim()}
            style={{ padding: "10px 20px", borderRadius: 10, background: S.orange, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
            {loading ? "Analyse…" : "Analyser"}
          </button>
        </div>
        {erreur && <p style={{ fontSize: 12, color: S.red, margin: "10px 0 0" }}>{erreur}</p>}
      </div>

      {/* Scraped data — editable */}
      {edited && !sent && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            {edited.logo_url && (
              <img src={edited.logo_url} alt="logo" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "contain", border: `1px solid ${S.border}` }} />
            )}
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: S.text }}>{edited.nom_officiel ?? "—"}</h3>
              <p style={{ margin: 0, fontSize: 12, color: S.text3 }}>Données extraites — vérifiez et corrigez si besoin</p>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {Object.entries(edited.confidence ?? {}).map(([k, v]) => (
                <span key={k} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: v >= 0.7 ? S.greenBg : S.orangeBg, color: v >= 0.7 ? S.green : S.orange }}>
                  {k} {Math.round(v * 100)}%
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <Field label="Nom officiel"   value={edited.nom_officiel ?? ""} onChange={v => setEdited(p => p ? { ...p, nom_officiel: v } : p)} />
            <Field label="Email contact"  value={edited.email_contact ?? ""} onChange={v => setEdited(p => p ? { ...p, email_contact: v } : p)} type="email" />
            <Field label="Adresse"        value={edited.adresse ?? ""} onChange={v => setEdited(p => p ? { ...p, adresse: v } : p)} />
            <Field label="Téléphone"      value={edited.telephone ?? ""} onChange={v => setEdited(p => p ? { ...p, telephone: v } : p)} />
            <Field label="Ville"          value={edited.ville ?? ""} onChange={v => setEdited(p => p ? { ...p, ville: v } : p)} />
            <Field label="Canton"         value={edited.canton ?? ""} onChange={v => setEdited(p => p ? { ...p, canton: v } : p)} placeholder="GE" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Description</label>
            <textarea value={edited.description ?? ""} onChange={e => setEdited(p => p ? { ...p, description: e.target.value } : p)}
              rows={3} style={{ ...inp, resize: "vertical" }} />
          </div>

          {/* Agents */}
          {edited.agents?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Agents trouvés</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {edited.agents.map((a, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: S.surface2, borderRadius: 8, border: `1px solid ${S.border}` }}>
                    <span style={{ fontSize: 13, color: S.text, fontWeight: 600 }}>{a.nom}</span>
                    <span style={{ fontSize: 11, color: S.text3 }}>{a.titre}</span>
                    <button onClick={() => setEdited(p => p ? { ...p, agents: p.agents.filter((_, j) => j !== i) } : p)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: S.text3, padding: 0 }}><X size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={confirmer} disabled={sending}
            style={{ padding: "11px 24px", borderRadius: 10, background: S.orange, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: sending ? "not-allowed" : "pointer", opacity: sending ? 0.7 : 1, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
            {sending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <UserPlus size={14} />}
            {sending ? "Création en cours…" : "Créer le compte et envoyer l'invitation"}
          </button>
        </div>
      )}

      {/* Success */}
      {sent && (
        <div style={{ background: S.greenBg, border: `1px solid ${S.green}`, borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Check size={18} color={S.green} />
            <span style={{ fontSize: 14, fontWeight: 700, color: S.green }}>Compte créé et invitation envoyée !</span>
          </div>
          <p style={{ fontSize: 12, color: S.text3, margin: "0 0 8px" }}>Lien d'accès (valable 7 jours) :</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input readOnly value={sent.url} style={{ ...inp, flex: 1, fontSize: 12, color: S.orange }} />
            <button onClick={() => navigator.clipboard?.writeText(sent.url)}
              style={{ padding: "10px 14px", borderRadius: 10, background: S.surface, border: `1px solid ${S.border}`, cursor: "pointer", color: S.text2, fontSize: 12, fontFamily: "inherit" }}>
              Copier
            </button>
          </div>

          {/* Scan onboarding info */}
          {role !== "locataire" && (
            <div style={{ marginTop: 14, padding: "12px 14px", background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Sparkles size={14} color={S.orange} style={{ marginTop: 1, flexShrink: 0 }} />
              <div>
                <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 700, color: S.text }}>
                  Scan en cours…
                </p>
                <p style={{ margin: 0, fontSize: 11, color: S.text3, lineHeight: 1.5 }}>
                  Althy recherche les annonces existantes du client sur Homegate, ImmoScout24, Immobilier.ch et son site web.
                  À sa première connexion, il arrivera sur <span style={{ color: S.orange, fontWeight: 600 }}>/onboarding/scan</span> pour valider et importer ses biens en un clic.
                </p>
              </div>
            </div>
          )}

          <button onClick={() => { setScraped(null); setEdited(null); setSent(null); setRequete(""); }}
            style={{ marginTop: 14, fontSize: 12, color: S.orange, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            Intégrer un autre client →
          </button>
        </div>
      )}

      {/* Sessions en cours */}
      {sessions.length > 0 && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: 20 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: S.text }}>Sessions récentes</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sessions.slice(0, 8).map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: S.bg, borderRadius: 10, border: `1px solid ${S.border}` }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.completed ? S.green : S.orange, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: S.text, flex: 1 }}>
                  {s.data?.synth?.nom_officiel ?? s.data?.requete ?? "Session"}
                </span>
                <span style={{ fontSize: 11, color: S.text3 }}>{s.role}</span>
                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: s.completed ? S.greenBg : S.orangeBg, color: s.completed ? S.green : S.orange, fontWeight: 600 }}>
                  {s.completed ? "Complété" : "En cours"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab : Lien magique ────────────────────────────────────────────────────────

function TabLienMagique() {
  const [prenom,    setPrenom]    = useState("");
  const [nom,       setNom]       = useState("");
  const [email,     setEmail]     = useState("");
  const [telephone, setTelephone] = useState("");
  const [role,      setRole]      = useState("agence");
  const [modeSms,   setModeSms]   = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<{ url: string } | null>(null);
  const [erreur,    setErreur]    = useState<string | null>(null);
  const [copied,    setCopied]    = useState(false);

  async function creer() {
    if (!email.trim()) return;
    setLoading(true);
    setErreur(null);
    setResult(null);
    try {
      const mode = modeSms && telephone.trim() ? "email+sms" : "email";
      const r = await api.post<{ magic_link_url: string }>("/onboarding/creer-compte", {
        donnees:    { nom_officiel: `${prenom} ${nom}`.trim() },
        mode_envoi: mode,
        prenom:     prenom.trim() || undefined,
        nom:        nom.trim() || undefined,
        email:      email.trim().toLowerCase(),
        telephone:  telephone.trim() || undefined,
        role,
      });
      setResult({ url: r.data.magic_link_url });
    } catch {
      setErreur("Erreur lors de la création du lien. L'email est peut-être déjà utilisé.");
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (!result) return;
    navigator.clipboard?.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: S.text3 }}>
        Créez un lien personnalisé à envoyer à un client. Un email de bienvenue est envoyé automatiquement.
      </p>

      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Prénom" value={prenom} onChange={setPrenom} placeholder="Marie" />
          <Field label="Nom"    value={nom}    onChange={setNom}    placeholder="Dupont" />
        </div>
        <Field label="Email *" value={email} onChange={setEmail} type="email" placeholder="marie@agence.ch" />

        <div>
          <label style={lbl}>Rôle</label>
          <select value={role} onChange={e => setRole(e.target.value)} style={inp}>
            {ROLES_DISPONIBLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={modeSms} onChange={e => setModeSms(e.target.checked)} style={{ accentColor: S.orange, width: 15, height: 15 }} />
          <span style={{ fontSize: 13, color: S.text }}>Envoyer aussi par SMS</span>
        </label>

        {modeSms && (
          <Field label="Téléphone" value={telephone} onChange={setTelephone} type="tel" placeholder="+41 79 xxx xx xx" />
        )}

        {erreur && <p style={{ fontSize: 12, color: S.red, margin: 0 }}>{erreur}</p>}

        {!result ? (
          <button onClick={creer} disabled={loading || !email.trim()}
            style={{ padding: "11px 20px", borderRadius: 10, background: S.orange, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: loading || !email.trim() ? "not-allowed" : "pointer", opacity: loading || !email.trim() ? 0.7 : 1, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
            {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Link2 size={14} />}
            {loading ? "Création…" : "Créer et envoyer le lien"}
          </button>
        ) : (
          <div style={{ background: S.greenBg, border: `1px solid ${S.green}`, borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Check size={16} color={S.green} />
              <span style={{ fontSize: 13, fontWeight: 700, color: S.green }}>Lien créé — email envoyé !</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input readOnly value={result.url} style={{ ...inp, flex: 1, fontSize: 12, color: S.orange }} />
              <button onClick={copy}
                style={{ padding: "10px 14px", borderRadius: 10, background: copied ? S.green : S.surface, border: `1px solid ${S.border}`, cursor: "pointer", color: copied ? "#fff" : S.text2, fontSize: 12, fontFamily: "inherit", transition: "all 0.2s" }}>
                {copied ? "Copié !" : "Copier"}
              </button>
            </div>
            <button onClick={() => { setResult(null); setEmail(""); setPrenom(""); setNom(""); }}
              style={{ marginTop: 12, fontSize: 12, color: S.orange, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
              Créer un autre lien
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab : QR Code ─────────────────────────────────────────────────────────────

function TabQrCode() {
  const [email,   setEmail]   = useState("");
  const [prenom,  setPrenom]  = useState("");
  const [role,    setRole]    = useState("agence");
  const [loading, setLoading] = useState(false);
  const [qrData,  setQrData]  = useState<{ base64: string; url: string } | null>(null);
  const [erreur,  setErreur]  = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  async function generer() {
    if (!email.trim()) return;
    setLoading(true);
    setErreur(null);
    setQrData(null);
    try {
      const r = await api.post<{ magic_link_url: string; qr_base64: string }>("/onboarding/creer-compte", {
        donnees:    { nom_officiel: prenom || email },
        mode_envoi: "qr",
        prenom:     prenom.trim() || undefined,
        email:      email.trim().toLowerCase(),
        role,
      });
      setQrData({ base64: r.data.qr_base64, url: r.data.magic_link_url });
    } catch {
      setErreur("Erreur lors de la génération. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  function telecharger() {
    if (!qrData?.base64) return;
    const a = document.createElement("a");
    a.href = qrData.base64;
    a.download = `invitation-althy-${email.replace("@", "-")}.png`;
    a.click();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: S.text3 }}>
        Générez un QR code à imprimer ou afficher sur tablette. Le client le scanne et accède directement à son espace.
      </p>

      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Prénom (optionnel)" value={prenom} onChange={setPrenom} placeholder="Marie" />
            <Field label="Email *" value={email} onChange={setEmail} type="email" placeholder="marie@agence.ch" />
          </div>
          <div>
            <label style={lbl}>Rôle</label>
            <select value={role} onChange={e => setRole(e.target.value)} style={inp}>
              {ROLES_DISPONIBLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        {erreur && <p style={{ fontSize: 12, color: S.red, margin: "0 0 12px" }}>{erreur}</p>}

        {!qrData ? (
          <button onClick={generer} disabled={loading || !email.trim()}
            style={{ padding: "11px 20px", borderRadius: 10, background: S.orange, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: loading || !email.trim() ? "not-allowed" : "pointer", opacity: loading || !email.trim() ? 0.7 : 1, display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}>
            {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <QrCode size={14} />}
            {loading ? "Génération…" : "Générer le QR Code"}
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ padding: 24, background: "#fff", borderRadius: 16, border: `1px solid ${S.border}`, boxShadow: S.shadowMd }}>
              {qrData.base64 ? (
                <img ref={imgRef} src={qrData.base64} alt="QR Code invitation Althy" style={{ width: 240, height: 240, display: "block" }} />
              ) : (
                <div style={{ width: 240, height: 240, display: "flex", alignItems: "center", justifyContent: "center", background: S.surface2, borderRadius: 12 }}>
                  <QrCode size={64} color={S.border} />
                </div>
              )}
            </div>

            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: S.text, margin: "0 0 4px" }}>
                Invitation pour {prenom || email}
              </p>
              <p style={{ fontSize: 11, color: S.text3, margin: "0 0 14px" }}>Valable 7 jours · Rôle : {role}</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={telecharger}
                  style={{ padding: "9px 18px", borderRadius: 10, background: S.orange, color: "#fff", border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                  <Download size={13} /> Télécharger PNG
                </button>
                <button onClick={() => { setQrData(null); setEmail(""); setPrenom(""); }}
                  style={{ padding: "9px 18px", borderRadius: 10, background: S.surface, border: `1px solid ${S.border}`, fontSize: 12, cursor: "pointer", color: S.text2, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }}>
                  <RefreshCw size={12} /> Nouveau QR
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab : Import CSV ──────────────────────────────────────────────────────────

interface CsvRow {
  adresse: string; ville: string; cp: string; type: string;
  loyer: string; charges: string; surface: string; statut: string;
  locataire_nom: string; locataire_prenom: string; date_entree: string;
  erreurs: string[];
}
interface CsvPreview { rows: CsvRow[]; colonnes_detectees: Record<string,string>; total_lignes: number; colonnes_inconnues: string[] }
interface CsvResult  { biens_crees: number; locataires_crees: number; total_lignes: number; lignes_ignorees: number; erreurs: {ligne:number;message:string}[] }

const TYPE_OPTIONS = ["appartement","villa","studio","maison","commerce","bureau","parking","garage","cave","autre"];
const STATUT_OPTIONS = [
  { value: "vacant", label: "Vacant" },
  { value: "loue",   label: "Loué" },
  { value: "en_travaux", label: "Travaux" },
];

function TabImportCSV() {
  const [phase, setPhase]     = useState<"upload"|"preview"|"importing"|"done">("upload");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rows, setRows]       = useState<CsvRow[]>([]);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [result, setResult]   = useState<CsvResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [erreur, setErreur]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rowsValides = rows.filter(r => !r.erreurs.length);
  const rowsErreurs = rows.filter(r => r.erreurs.length > 0);

  async function handleFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx"].includes(ext ?? "")) {
      setErreur("Format non supporté. Utilisez un fichier .csv ou .xlsx");
      return;
    }
    setUploading(true);
    setErreur(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api.post<CsvPreview>("/onboarding/import-csv/preview", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPreview(r.data);
      setRows(r.data.rows);
      setPhase("preview");
    } catch (e: unknown) {
      const msg = (e as {response?:{data?:{detail?:string}}})?.response?.data?.detail ?? "Erreur lors de l'analyse du fichier.";
      setErreur(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function editRow(idx: number, field: keyof CsvRow, value: string) {
    setRows(prev => {
      const next = [...prev];
      const row = { ...next[idx], [field]: value };
      // Re-validate required fields
      const errs: string[] = [];
      if (!row.adresse.trim()) errs.push("Adresse manquante");
      if (!row.ville.trim())   errs.push("Ville manquante");
      if (!row.cp.trim())      errs.push("NPA manquant");
      next[idx] = { ...row, erreurs: errs };
      return next;
    });
  }

  function removeRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleImport() {
    if (!rowsValides.length) return;
    setPhase("importing");
    setProgress(0);

    // Simulate progress while request is in flight
    const tick = setInterval(() => {
      setProgress(p => p < 85 ? p + Math.random() * 12 : p);
    }, 300);

    try {
      const r = await api.post<CsvResult>("/onboarding/import-csv", { rows: rowsValides });
      clearInterval(tick);
      setProgress(100);
      setResult(r.data);
      setPhase("done");
    } catch (e: unknown) {
      clearInterval(tick);
      const msg = (e as {response?:{data?:{detail?:string}}})?.response?.data?.detail ?? "Erreur lors de l'import.";
      setErreur(typeof msg === "string" ? msg : "Erreur lors de l'import.");
      setPhase("preview");
      setProgress(0);
    }
  }

  function reset() {
    setPhase("upload"); setRows([]); setPreview(null);
    setResult(null); setProgress(0); setErreur(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Upload zone ──────────────────────────────────────────────────────────────
  if (phase === "upload") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: S.text3 }}>
        Importez vos biens depuis un fichier CSV ou Excel. Colonnes reconnues :{" "}
        <code style={{ fontSize: 11, background: S.surface2, padding: "1px 5px", borderRadius: 4 }}>
          adresse, ville, cp/npa, type, loyer, charges, surface, statut, locataire_nom, locataire_prenom, date_entree
        </code>
      </p>

      {erreur && (
        <div style={{ display: "flex", gap: 8, padding: "10px 14px", background: S.redBg, border: `1px solid ${S.red}`, borderRadius: 10 }}>
          <AlertTriangle size={14} color={S.red} style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: S.red }}>{erreur}</span>
        </div>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? S.orange : S.border}`,
          borderRadius: 16, padding: "48px 32px", textAlign: "center", cursor: "pointer",
          background: dragging ? S.orangeBg : S.surface,
          transition: "all 0.18s",
        }}
      >
        <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {uploading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <Loader2 size={32} color={S.orange} style={{ animation: "spin 1s linear infinite" }} />
            <p style={{ margin: 0, fontSize: 13, color: S.text2 }}>Analyse en cours…</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: S.orangeBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Upload size={24} color={S.orange} />
            </div>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: S.text }}>
                Glissez votre fichier ici
              </p>
              <p style={{ margin: 0, fontSize: 12, color: S.text3 }}>
                ou cliquez pour sélectionner — CSV, XLSX · max 10 Mo
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Template download hint */}
      <p style={{ margin: 0, fontSize: 12, color: S.text3, textAlign: "center" }}>
        Format minimal requis : <strong>adresse</strong>, <strong>ville</strong>, <strong>npa</strong>
      </p>
    </div>
  );

  // ── Importing ────────────────────────────────────────────────────────────────
  if (phase === "importing") return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
      <Loader2 size={36} color={S.orange} style={{ animation: "spin 1s linear infinite", marginBottom: 16 }} />
      <p style={{ margin: "0 0 20px", fontSize: 14, fontWeight: 600, color: S.text }}>
        Import en cours — {rowsValides.length} biens…
      </p>
      <div style={{ background: S.surface2, borderRadius: 99, height: 8, overflow: "hidden", maxWidth: 320, margin: "0 auto" }}>
        <div style={{
          height: "100%", borderRadius: 99, background: S.orange,
          width: `${progress}%`, transition: "width 0.3s ease",
        }} />
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 12, color: S.text3 }}>{Math.round(progress)}%</p>
    </div>
  );

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (phase === "done" && result) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: S.greenBg, border: `1px solid ${S.green}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <CheckCircle2 size={22} color={S.green} />
          <span style={{ fontSize: 16, fontWeight: 700, color: S.green }}>Import terminé !</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {[
            { label: "Biens créés",       val: result.biens_crees,      color: S.green },
            { label: "Locataires créés",  val: result.locataires_crees,  color: S.orange },
            { label: "Lignes ignorées",   val: result.lignes_ignorees,   color: result.lignes_ignorees > 0 ? S.red : S.text3 },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
              <p style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 800, color: kpi.color }}>{kpi.val}</p>
              <p style={{ margin: 0, fontSize: 11, color: S.text3, textTransform: "uppercase", letterSpacing: "0.05em" }}>{kpi.label}</p>
            </div>
          ))}
        </div>
      </div>

      {result.erreurs.length > 0 && (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: 16 }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: S.red, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {result.erreurs.length} erreur(s)
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
            {result.erreurs.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: S.text2 }}>
                <span style={{ color: S.text3, flexShrink: 0 }}>Ligne {e.ligne}</span>
                <span>{e.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={reset}
        style={{ padding: "11px 24px", borderRadius: 10, background: S.orange, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", alignSelf: "flex-start" }}>
        <FileUp size={14} /> Importer un autre fichier
      </button>
    </div>
  );

  // ── Preview ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {erreur && (
        <div style={{ display: "flex", gap: 8, padding: "10px 14px", background: S.redBg, border: `1px solid ${S.red}`, borderRadius: 10 }}>
          <AlertTriangle size={14} color={S.red} style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: S.red }}>{erreur}</span>
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: S.surface, border: `1px solid ${S.border}`, borderRadius: 12, padding: "12px 16px", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 20 }}>
          <span style={{ fontSize: 13, color: S.text }}>
            <strong style={{ color: S.green }}>{rowsValides.length}</strong> biens valides
          </span>
          {rowsErreurs.length > 0 && (
            <span style={{ fontSize: 13, color: S.red }}>
              <strong>{rowsErreurs.length}</strong> erreur{rowsErreurs.length > 1 ? "s" : ""}
            </span>
          )}
          {preview?.colonnes_inconnues.length ? (
            <span style={{ fontSize: 12, color: S.text3 }}>
              Colonnes ignorées : {preview.colonnes_inconnues.join(", ")}
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={reset}
            style={{ padding: "7px 14px", borderRadius: 9, background: S.surface2, border: `1px solid ${S.border}`, fontSize: 12, cursor: "pointer", color: S.text2, fontFamily: "inherit" }}>
            ← Autre fichier
          </button>
          <button onClick={handleImport} disabled={!rowsValides.length}
            style={{ padding: "7px 18px", borderRadius: 9, background: rowsValides.length ? S.orange : S.border, color: rowsValides.length ? "#fff" : S.text3, border: "none", fontSize: 13, fontWeight: 700, cursor: rowsValides.length ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7 }}>
            <CheckCircle2 size={13} /> Importer {rowsValides.length} bien{rowsValides.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: S.surface2, borderBottom: `1px solid ${S.border}` }}>
                {["Adresse *", "Ville *", "NPA *", "Type", "Loyer CHF", "Locataire", "Statut", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "9px 12px", fontSize: 10, fontWeight: 700, color: S.text3, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const hasErr = row.erreurs.length > 0;
                const rowStyle: React.CSSProperties = {
                  borderBottom: `1px solid ${S.border}`,
                  background: hasErr ? "rgba(229,62,62,0.04)" : undefined,
                };
                const cellStyle = (field: keyof CsvRow): React.CSSProperties => ({
                  padding: "4px 6px",
                });
                const inp2: React.CSSProperties = {
                  width: "100%", padding: "5px 8px", border: `1px solid ${S.border}`, borderRadius: 6,
                  fontSize: 12, background: S.bg, color: S.text, outline: "none", fontFamily: "inherit",
                  boxSizing: "border-box",
                };
                const errInp: React.CSSProperties = { ...inp2, borderColor: S.red, background: S.redBg };
                return (
                  <tr key={idx} style={rowStyle}>
                    <td style={cellStyle("adresse")}>
                      <input value={row.adresse} onChange={e => editRow(idx, "adresse", e.target.value)}
                        style={!row.adresse.trim() ? errInp : inp2} placeholder="15 rue du Lac" />
                    </td>
                    <td style={cellStyle("ville")}>
                      <input value={row.ville} onChange={e => editRow(idx, "ville", e.target.value)}
                        style={!row.ville.trim() ? errInp : inp2} placeholder="Genève" />
                    </td>
                    <td style={{ ...cellStyle("cp"), width: 72 }}>
                      <input value={row.cp} onChange={e => editRow(idx, "cp", e.target.value)}
                        style={!row.cp.trim() ? errInp : { ...inp2, textAlign: "center" }} placeholder="1201" />
                    </td>
                    <td style={{ ...cellStyle("type"), width: 120 }}>
                      <select value={row.type} onChange={e => editRow(idx, "type", e.target.value)} style={inp2}>
                        {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td style={{ ...cellStyle("loyer"), width: 90 }}>
                      <input value={row.loyer} onChange={e => editRow(idx, "loyer", e.target.value)}
                        style={{ ...inp2, textAlign: "right" }} placeholder="1500" />
                    </td>
                    <td style={cellStyle("locataire_nom")}>
                      <input value={`${row.locataire_prenom} ${row.locataire_nom}`.trim()}
                        onChange={e => {
                          const parts = e.target.value.trim().split(/\s+/);
                          editRow(idx, "locataire_prenom", parts[0] ?? "");
                          editRow(idx, "locataire_nom", parts.slice(1).join(" "));
                        }}
                        style={inp2} placeholder="Marie Dupont" />
                    </td>
                    <td style={{ ...cellStyle("statut"), width: 100 }}>
                      <select value={row.statut} onChange={e => editRow(idx, "statut", e.target.value)} style={inp2}>
                        {STATUT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "4px 8px", width: 36 }}>
                      <button onClick={() => removeRow(idx)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: S.text3, padding: 2, display: "flex", alignItems: "center" }}
                        title="Supprimer cette ligne">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: S.text3 }}>
            Toutes les lignes ont été supprimées.
          </div>
        )}
      </div>

      {rowsErreurs.length > 0 && (
        <div style={{ padding: "10px 14px", background: S.redBg, border: `1px solid ${S.red}`, borderRadius: 10 }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: S.red, textTransform: "uppercase" }}>
            Lignes en erreur — corrigez ou supprimez avant import
          </p>
          {rowsErreurs.slice(0, 5).map((r, i) => (
            <p key={i} style={{ margin: "2px 0", fontSize: 12, color: S.red }}>
              {r.erreurs.join(" · ")} — {r.adresse || "(sans adresse)"}
            </p>
          ))}
          {rowsErreurs.length > 5 && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: S.red }}>+ {rowsErreurs.length - 5} autres</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "sphere", label: "Sphère IA",    icon: <Sparkles size={14} /> },
  { id: "lien",   label: "Lien magique", icon: <Link2 size={14} /> },
  { id: "qr",     label: "QR Code",      icon: <QrCode size={14} /> },
  { id: "csv",    label: "Import CSV",   icon: <FileUp size={14} /> },
];

export default function IntegrationPage() {
  const [tab, setTab] = useState<Tab>("sphere");

  return (
    <div style={{ padding: "28px 24px", maxWidth: 820, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <UserPlus size={22} color={S.orange} />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: S.text, letterSpacing: "-0.02em" }}>
            Intégration clients
          </h1>
        </div>
        <p style={{ margin: 0, color: S.text3, fontSize: 13.5 }}>
          Invitez vos clients en 30 secondes — Althy crée leur compte et leur envoie le lien d'accès.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: S.surface, borderRadius: 12, padding: 4, border: `1px solid ${S.border}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 9, border: "none",
              background: tab === t.id ? S.orange : "transparent",
              color: tab === t.id ? "#fff" : S.text3,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              fontFamily: "inherit", transition: "all 0.18s",
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "sphere" && <TabSphere />}
      {tab === "lien"   && <TabLienMagique />}
      {tab === "qr"     && <TabQrCode />}
      {tab === "csv"    && <TabImportCSV />}
    </div>
  );
}
