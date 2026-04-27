"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const supabase = createClient();

// ── Types ─────────────────────────────────────────────────────────────────────

type DocType = "cni" | "fiche_salaire" | "reference" | "autre";

interface DocFile {
  id: string;
  file: File;
  type: DocType;
  url?: string;
  uploading: boolean;
  error?: string;
}

interface Listing {
  id: string;
  titre: string;
  ville: string;
  prix: number;
  cover: string | null;
  transaction_type: string;
  surface: number | null;
  pieces: number | null;
}

interface ScoreResult {
  score_ia: number;
  score_details: {
    recommendation: "approve" | "review" | "reject";
    risk_flags: string[];
    summary: string;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<DocType, string> = {
  cni: "CNI / Passeport",
  fiche_salaire: "Fiche de salaire",
  reference: "Référence propriétaire",
  autre: "Autre document",
};

const DOC_TYPES: DocType[] = ["cni", "fiche_salaire", "reference", "autre"];

const SCORE_COLOR = (score: number) => {
  if (score >= 70) return "var(--althy-orange)";
  if (score >= 50) return "var(--althy-warning)";
  return "var(--althy-red)";
};

const SCORE_LABEL = (score: number) => {
  if (score >= 70) return "Excellent dossier";
  if (score >= 50) return "Dossier à compléter";
  return "Dossier risqué";
};

const RECO_LABEL = {
  approve: "Dossier recommandé ✓",
  review: "Vérification conseillée",
  reject: "Dossier à renforcer",
};

const RECO_COLOR = {
  approve: "var(--althy-green)",
  review: "var(--althy-warning)",
  reject: "var(--althy-red)",
};

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = ["Documents", "Message", "Envoi"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < step;
        const active = idx === step;
        return (
          <div key={idx} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: done ? "var(--althy-green)" : active ? "var(--althy-orange)" : "var(--althy-border)",
                  color: done || active ? "#fff" : "var(--althy-text-3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 600,
                }}
              >
                {done ? "✓" : idx}
              </div>
              <span style={{
                fontSize: 11, color: active ? "var(--althy-text)" : "var(--althy-text-3)",
                fontWeight: active ? 600 : 400, whiteSpace: "nowrap",
              }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: "0 8px", marginBottom: 20,
                background: done ? "var(--althy-green)" : "var(--althy-border)",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PostulerPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.listing_id as string;

  const [listing, setListing] = useState<Listing | null>(null);
  const [step, setStep] = useState(1);
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.push(`/login?callbackUrl=/postuler/${listingId}`);
      } else {
        setSession(data.session);
      }
    });
  }, [listingId, router]);

  // ── Fetch listing ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/marketplace/${listingId}`)
      .then((r) => r.json())
      .then((d) => setListing(d))
      .catch(() => {});
  }, [listingId]);

  // ── Upload file to Supabase Storage ─────────────────────────────────────────
  const uploadDoc = async (docId: string, file: File) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, uploading: true, error: undefined } : d))
    );

    const path = `candidatures/${listingId}/${Date.now()}_${file.name}`;
    const { data, error: uploadErr } = await supabase.storage
      .from("althy-docs")
      .upload(path, file, { upsert: false });

    if (uploadErr || !data) {
      setDocs((prev) =>
        prev.map((d) =>
          d.id === docId ? { ...d, uploading: false, error: "Échec de l'upload" } : d
        )
      );
      return;
    }

    const { data: urlData } = supabase.storage.from("althy-docs").getPublicUrl(path);
    setDocs((prev) =>
      prev.map((d) =>
        d.id === docId ? { ...d, uploading: false, url: urlData.publicUrl } : d
      )
    );
  };

  // ── File drop ───────────────────────────────────────────────────────────────
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const docId = `${Date.now()}_${Math.random()}`;
      const newDoc: DocFile = { id: docId, file, type: "autre", uploading: false };
      setDocs((prev) => [...prev, newDoc]);
      uploadDoc(docId, file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const removeDoc = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const setDocType = (id: string, type: DocType) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, type } : d)));
  };

  // ── Validation step 1 ───────────────────────────────────────────────────────
  const canGoStep2 = docs.length > 0 && docs.every((d) => d.url && !d.uploading);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!session) return;
    setSubmitting(true);
    setError(null);

    const body = {
      listing_id: listingId,
      documents: docs.map((d) => ({ type: d.type, url: d.url!, nom: d.file.name })),
      message: message.trim() || null,
    };

    try {
      const res = await fetch(`${API}/marketplace/postuler`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Erreur lors de l'envoi");
      }

      const data = await res.json();
      setResult({
        score_ia: data.score_ia ?? 0,
        score_details: data.score_details ?? {
          recommendation: "review",
          risk_flags: [],
          summary: "Dossier reçu, en cours d'analyse.",
        },
      });
      setStep(3);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!session || !listing) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--althy-bg)" }}>
        <div style={{ width: 40, height: 40, border: "3px solid var(--althy-border)", borderTopColor: "var(--althy-orange)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--althy-bg)", padding: "0 16px 60px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ maxWidth: 680, margin: "0 auto", paddingTop: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <Link
            href="/"
            style={{ color: "var(--althy-text-2)", fontSize: 14, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
          >
            ← Retour à l'accueil
          </Link>
        </div>

        {/* Bien card recap */}
        <div style={{
          background: "var(--althy-surface)", borderRadius: "var(--radius-card)",
          border: "1px solid var(--althy-border)", padding: 16, marginBottom: 32,
          display: "flex", gap: 16, alignItems: "center",
        }}>
          {listing.cover && (
            <img
              src={listing.cover}
              alt={listing.titre}
              style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
            />
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--althy-text)", marginBottom: 2 }}>{listing.titre}</div>
            <div style={{ fontSize: 13, color: "var(--althy-text-2)" }}>{listing.ville}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--althy-orange)", marginTop: 4 }}>
              CHF {listing.prix?.toLocaleString("fr-CH")} / mois
            </div>
          </div>
        </div>

        <h1 style={{ font: "300 26px/1.2 var(--font-serif)", color: "var(--althy-text)", marginBottom: 8 }}>
          Envoyer mon dossier
        </h1>
        <p style={{ fontSize: 14, color: "var(--althy-text-2)", marginBottom: 32 }}>
          Votre dossier sera analysé automatiquement par Althy IA et transmis au propriétaire.
        </p>

        <StepIndicator step={step} />

        {/* ── STEP 1 : Documents ──────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--althy-text)", marginBottom: 6 }}>
              Vos documents
            </h2>
            <p style={{ fontSize: 13, color: "var(--althy-text-2)", marginBottom: 20 }}>
              Ajoutez au minimum : CNI/passeport, 3 fiches de salaire, et si possible une lettre de référence.
            </p>

            {/* Documents requis checklist */}
            <div style={{
              background: "var(--althy-orange-bg)", borderRadius: 8,
              padding: "12px 16px", marginBottom: 20, display: "flex", gap: 24, flexWrap: "wrap",
            }}>
              {(["cni", "fiche_salaire", "fiche_salaire", "fiche_salaire", "reference"] as DocType[]).map((type, i) => {
                const count = docs.filter((d) => d.type === type).length;
                const label =
                  type === "fiche_salaire" ? `Fiche de salaire ${i < 4 ? i - 1 : ""}`.trim() :
                  type === "cni" ? "CNI / Passeport" : "Référence";
                const done = type === "fiche_salaire" ? docs.filter((d) => d.type === "fiche_salaire").length >= 3
                  : docs.some((d) => d.type === type);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <span style={{ color: done ? "var(--althy-green)" : "var(--althy-text-3)" }}>{done ? "✓" : "○"}</span>
                    <span style={{ color: done ? "var(--althy-green)" : "var(--althy-text-2)" }}>{DOC_TYPE_LABELS[type]}</span>
                  </div>
                );
              })}
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: "2px dashed var(--althy-border)", borderRadius: "var(--radius-card)",
                padding: "32px 24px", textAlign: "center", cursor: "pointer",
                background: "var(--althy-surface)", marginBottom: 20,
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--althy-orange)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--althy-border)")}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--althy-text)", marginBottom: 4 }}>
                Glissez vos fichiers ici
              </div>
              <div style={{ fontSize: 13, color: "var(--althy-text-2)" }}>
                ou cliquez pour parcourir — PDF, JPG, PNG acceptés
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: "none" }}
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {/* Documents list */}
            {docs.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      background: "var(--althy-surface)", border: "1px solid var(--althy-border)",
                      borderRadius: 8, padding: "12px 14px",
                      display: "flex", alignItems: "center", gap: 12,
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 6, background: "var(--althy-orange-bg)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      fontSize: 16,
                    }}>
                      {doc.uploading ? "⏳" : doc.error ? "❌" : "✅"}
                    </div>

                    {/* Nom */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--althy-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {doc.file.name}
                      </div>
                      {doc.error && <div style={{ fontSize: 12, color: "var(--althy-red)" }}>{doc.error}</div>}
                      {doc.uploading && <div style={{ fontSize: 12, color: "var(--althy-text-3)" }}>Envoi en cours…</div>}
                    </div>

                    {/* Type selector */}
                    <select
                      value={doc.type}
                      onChange={(e) => setDocType(doc.id, e.target.value as DocType)}
                      style={{
                        fontSize: 13, padding: "4px 8px", borderRadius: 6,
                        border: "1px solid var(--althy-border)", background: "#fff",
                        color: "var(--althy-text)", cursor: "pointer",
                      }}
                    >
                      {DOC_TYPES.map((t) => (
                        <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
                      ))}
                    </select>

                    {/* Remove */}
                    <button
                      onClick={() => removeDoc(doc.id)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--althy-text-3)", fontSize: 16, padding: 4, lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Nav */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setStep(2)}
                disabled={!canGoStep2}
                style={{
                  background: canGoStep2 ? "var(--althy-orange)" : "var(--althy-border)",
                  color: canGoStep2 ? "#fff" : "var(--althy-text-3)",
                  border: "none", borderRadius: 8, padding: "12px 28px",
                  fontSize: 15, fontWeight: 600, cursor: canGoStep2 ? "pointer" : "not-allowed",
                  transition: "background 0.15s",
                }}
              >
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 : Message ────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--althy-text)", marginBottom: 6 }}>
              Message au propriétaire
            </h2>
            <p style={{ fontSize: 13, color: "var(--althy-text-2)", marginBottom: 20 }}>
              Optionnel — présentez-vous brièvement et expliquez pourquoi ce logement vous correspond.
            </p>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Bonjour, je suis intéressé par votre bien car…"
              maxLength={800}
              rows={6}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 8,
                border: "1px solid var(--althy-border)", background: "#fff",
                fontSize: 14, color: "var(--althy-text)", resize: "vertical",
                outline: "none", fontFamily: "inherit", boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 12, color: "var(--althy-text-3)", textAlign: "right", marginTop: 4 }}>
              {message.length}/800 caractères
            </div>

            {error && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8,
                padding: "12px 14px", marginTop: 16, fontSize: 14, color: "var(--althy-red)",
              }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <button
                onClick={() => { setStep(1); setError(null); }}
                style={{
                  background: "none", border: "1px solid var(--althy-border)", borderRadius: 8,
                  padding: "12px 24px", fontSize: 15, cursor: "pointer", color: "var(--althy-text)",
                }}
              >
                ← Retour
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  background: "var(--althy-orange)", color: "#fff", border: "none",
                  borderRadius: 8, padding: "12px 28px", fontSize: 15, fontWeight: 600,
                  cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1,
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                {submitting ? (
                  <>
                    <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    Envoi en cours…
                  </>
                ) : "Envoyer mon dossier →"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 : Résultat du scoring ────────────────────────────────── */}
        {step === 3 && result && (
          <div style={{ textAlign: "center" }}>
            {/* Score circle */}
            <div style={{
              width: 120, height: 120, borderRadius: "50%", margin: "0 auto 24px",
              border: `6px solid ${SCORE_COLOR(result.score_ia)}`,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: "var(--althy-surface)",
            }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: SCORE_COLOR(result.score_ia) }}>
                {result.score_ia}
              </div>
              <div style={{ fontSize: 11, color: "var(--althy-text-3)" }}>/ 100</div>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 300, fontFamily: "var(--font-serif)", color: "var(--althy-text)", marginBottom: 8 }}>
              Dossier envoyé !
            </h2>
            <p style={{ fontSize: 14, color: "var(--althy-text-2)", marginBottom: 24 }}>
              Althy IA a analysé votre dossier et l'a transmis au propriétaire.
            </p>

            {/* Score label */}
            <div style={{
              display: "inline-block", background: `${SCORE_COLOR(result.score_ia)}18`,
              border: `1px solid ${SCORE_COLOR(result.score_ia)}40`,
              borderRadius: 20, padding: "6px 16px", marginBottom: 24,
              fontSize: 14, fontWeight: 600, color: SCORE_COLOR(result.score_ia),
            }}>
              {SCORE_LABEL(result.score_ia)}
            </div>

            {/* Recommendation */}
            <div style={{
              background: "var(--althy-surface)", border: "1px solid var(--althy-border)",
              borderRadius: "var(--radius-card)", padding: 20, marginBottom: 16, textAlign: "left",
            }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: RECO_COLOR[result.score_details.recommendation],
                marginBottom: 8,
              }}>
                {RECO_LABEL[result.score_details.recommendation]}
              </div>
              <p style={{ fontSize: 14, color: "var(--althy-text-2)", margin: 0 }}>
                {result.score_details.summary}
              </p>
            </div>

            {/* Risk flags */}
            {result.score_details.risk_flags.length > 0 && (
              <div style={{
                background: "#fef9f0", border: "1px solid #fed7aa",
                borderRadius: 8, padding: "12px 16px", marginBottom: 24, textAlign: "left",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 8 }}>
                  Points à renforcer
                </div>
                <ul style={{ margin: 0, padding: "0 0 0 18px" }}>
                  {result.score_details.risk_flags.map((flag, i) => (
                    <li key={i} style={{ fontSize: 13, color: "#78350f", marginBottom: 2 }}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Trust signals */}
            <div style={{
              display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap",
              marginBottom: 32,
            }}>
              {[
                "🔒 Documents chiffrés et sécurisés",
                "👁 Visibles uniquement par le propriétaire",
                "✅ Postuler 100% gratuit — aucun frais pour vous",
              ].map((txt) => (
                <div key={txt} style={{
                  background: "var(--althy-surface)", border: "1px solid var(--althy-border)",
                  borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "var(--althy-text-2)",
                }}>
                  {txt}
                </div>
              ))}
            </div>

            {/* CTA — Phase 1 : marketplace publique masquée, retour landing uniquement */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link
                href="/"
                style={{
                  background: "var(--althy-prussian)", color: "#fff", border: "none",
                  borderRadius: 8, padding: "12px 24px", fontSize: 15, fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                ← Retour à l'accueil
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
