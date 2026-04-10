"use client";

/**
 * /app/admin/integration — Intégration clients
 * 3 onglets : Sphère IA (scrape auto) | Lien magique | QR Code
 * Suivi temps réel des sessions via Supabase Realtime.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Link2, Loader2, QrCode, RefreshCw, Sparkles, UserPlus, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase";

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
  shadow:   "var(--althy-shadow)",
  shadowMd: "var(--althy-shadow-md)",
} as const;

type Tab = "sphere" | "lien" | "qr";

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
  border: `1px solid var(--althy-border)`,
  borderRadius: 10,
  fontSize: 13,
  background: "var(--althy-bg)",
  color: "var(--althy-text)",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--althy-text-3)",
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

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "sphere", label: "Sphère IA", icon: <Sparkles size={14} /> },
  { id: "lien",   label: "Lien magique", icon: <Link2 size={14} /> },
  { id: "qr",     label: "QR Code", icon: <QrCode size={14} /> },
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
    </div>
  );
}
