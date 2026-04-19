"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { DocumentQuickGenerator } from "@/components/DocumentQuickGenerator";
import { Camera, Upload, Check, AlertTriangle, Loader2, X } from "lucide-react";
import { C } from "@/lib/design-tokens";

interface GeneratedDoc {
  id: string;
  template_type: string;
  status: string;
  created_at: string;
}

const DISCLAIMER = "Document généré automatiquement à titre indicatif. À faire valider par un professionnel si nécessaire.";

const TYPE_LABELS: Record<string, string> = {
  bail_annee:                "Bail à l'année",
  bail_annee_avec_vente:     "Bail à l'année + vente",
  bail_saison:               "Bail saisonnier",
  mandat_gestion:            "Mandat de gestion",
  fiche_bien:                "Fiche de présentation",
  demande_pieces_annee:      "Demande de pièces — Annuel",
  demande_pieces_saison:     "Demande de pièces — Saisonnier",
  demande_pieces_nuitee:     "Demande de pièces — Nuitée",
  demande_pieces_societe:    "Demande de pièces — Société",
  demande_pieces_commercial: "Demande de pièces — Commercial",
  requisition_poursuite:     "Réquisition de poursuite",
  quittance_loyer:           "Quittance de loyer",
  relance_1:                 "Relance — Rappel amiable",
  relance_2:                 "Relance — Mise en demeure",
  relance_3:                 "Relance — Résiliation CO 257d",
  dossier_vendeur:           "Dossier vendeur",
};

const OBLF_LABELS: Record<string, string> = {
  entretien:    "Entretien courant",
  reparation:   "Réparations",
  assurance:    "Assurances",
  impots:       "Impôts & taxes",
  frais_admin:  "Frais administratifs",
  amortissement:"Amortissement",
  autre:        "Autre",
};

interface ScanResult {
  id: string;
  montant: number | null;
  fournisseur: string | null;
  date_facture: string | null;
  description: string | null;
  categorie_oblf: string | null;
  bien_id: string | null;
  bien_adresse: string | null;
  statut: string;
  confidence: number;
}

function ScanFacturePanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setScanning(true);
    setResult(null);
    setError(null);
    setConfirmed(false);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<ScanResult>("/ai/scan-facture", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
    } catch {
      setError("Échec du scan. Vérifiez que le fichier est une image ou un PDF lisible.");
    } finally {
      setScanning(false);
    }
  }

  async function handleConfirm() {
    if (!result?.id || !result.bien_id) return;
    setConfirming(true);
    try {
      await api.post("/ai/confirmer-facture", {
        depense_id: result.id,
        bien_id: result.bien_id,
        categorie_oblf: result.categorie_oblf || "autre",
      });
      setConfirmed(true);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: 20, boxShadow: C.shadow,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Camera size={18} color={C.orange} />
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>Scan de facture</h2>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: C.text3, lineHeight: 1.6 }}>
        Photo ou PDF → Althy extrait le montant, le fournisseur, la date et propose l&apos;affectation OBLF.
      </p>

      {/* Drop zone */}
      {!result && !scanning && (
        <div
          style={{
            border: `2px dashed ${C.border}`, borderRadius: 10, padding: "24px 16px",
            textAlign: "center", cursor: "pointer",
          }}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        >
          <Upload size={24} style={{ color: C.text3, margin: "0 auto 8px" }} />
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: C.text2 }}>
            Glisser-déposer ou cliquer pour uploader
          </p>
          <p style={{ margin: 0, fontSize: 11, color: C.text3 }}>JPEG · PNG · WEBP · PDF</p>
          <input
            ref={fileRef} type="file" style={{ display: "none" }}
            accept="image/*,.pdf"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}

      {scanning && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <Loader2 size={28} style={{ color: C.orange, animation: "spin 1s linear infinite", marginBottom: 8 }} />
          <p style={{ color: C.text3, fontSize: 13 }}>Althy analyse la facture…</p>
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: C.redBg, color: C.red, fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Result card */}
      {result && !confirmed && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Résultat du scan</span>
            <span style={{
              padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: result.confidence >= 0.7 ? C.greenBg : C.amberBg,
              color: result.confidence >= 0.7 ? C.green : C.amber,
            }}>
              Confiance : {Math.round(result.confidence * 100)}%
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Montant", value: result.montant ? `CHF ${result.montant.toFixed(2)}` : "—" },
              { label: "Fournisseur", value: result.fournisseur || "—" },
              { label: "Date", value: result.date_facture || "—" },
              { label: "Catégorie OBLF", value: OBLF_LABELS[result.categorie_oblf || ""] || result.categorie_oblf || "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: C.surface2, borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 10, color: C.text3, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Affectation proposition */}
          <div style={{
            padding: "10px 14px", borderRadius: 8,
            background: C.orangeBg, border: `1px solid rgba(181,90,48,0.25)`,
            fontSize: 13, color: C.text, marginBottom: 12,
          }}>
            <strong>Althy propose :</strong> Facture CHF {result.montant?.toFixed(2) ?? "?"} →{" "}
            {OBLF_LABELS[result.categorie_oblf || ""] || result.categorie_oblf || "Autre"} →{" "}
            {result.bien_adresse || "Bien à préciser"}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
                background: C.green, color: "#fff", fontSize: 13, fontWeight: 600,
                cursor: confirming ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {confirming ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />}
              Confirmer l&apos;affectation
            </button>
            <button
              onClick={() => { setResult(null); setError(null); }}
              style={{
                padding: "9px 14px", borderRadius: 8, border: `1px solid ${C.border}`,
                background: C.surface, color: C.text3, fontSize: 13, cursor: "pointer",
              }}
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {confirmed && (
        <div style={{
          textAlign: "center", padding: 16, borderRadius: 10,
          background: C.greenBg, border: `1px solid rgba(46,94,34,0.2)`,
        }}>
          <Check size={20} color={C.green} style={{ margin: "0 auto 6px" }} />
          <p style={{ margin: 0, fontWeight: 700, color: C.green, fontSize: 13 }}>Dépense enregistrée</p>
          <button
            onClick={() => { setResult(null); setConfirmed(false); }}
            style={{ marginTop: 8, fontSize: 12, color: C.text3, background: "none", border: "none", cursor: "pointer" }}
          >
            Scanner une autre facture
          </button>
        </div>
      )}
    </div>
  );
}

// Action card items
const ACTION_CARDS = [
  {
    title: "Demande de pièces",
    description: "2 questions → le bon document selon le profil du locataire (particulier, société, saisonnier, commercial…)",
    generatorProps: { label: "Générer", smartPieces: true, variant: "primary" as const },
  },
  {
    title: "Lettre de relance",
    description: "3 niveaux : rappel amiable, mise en demeure (CO 102), résiliation (CO 257d).",
    generatorProps: { label: "Niveau 1", templateType: "relance_1", variant: "primary" as const },
  },
  {
    title: "Mandat de gestion locative",
    description: "Contrat entre le propriétaire et l'agence. À lier à un bien existant.",
    generatorProps: { label: "Générer", templateType: "mandat_gestion", variant: "primary" as const },
  },
  {
    title: "Dossier vendeur",
    description: "Présentation complète du bien pour la vente : données, loyer, rendement, documents.",
    generatorProps: { label: "Générer", templateType: "dossier_vendeur", variant: "primary" as const },
  },
  {
    title: "Réquisition de poursuite",
    description: "Formulaire LP à envoyer à l'office des poursuites en cas de loyers impayés (art. 82 LP).",
    generatorProps: { label: "Générer", templateType: "requisition_poursuite", variant: "primary" as const },
  },
];

export default function DocumentsPage() {
  return (
    <Suspense>
      <DocumentsContent />
    </Suspense>
  );
}

function DocumentsContent() {
  const searchParams = useSearchParams();
  const generatorRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<GeneratedDoc[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  // Deep-link: ?action=generer → scroll to generators section
  useEffect(() => {
    if (searchParams.get("action") === "generer" && generatorRef.current) {
      setTimeout(() => generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  }, [searchParams]);

  useEffect(() => {
    api.get<GeneratedDoc[]>("/documents/?limit=30")
      .then((r) => setHistory(r.data))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  async function openDoc(id: string) {
    const { data } = await api.get<{ content_html: string }>(`/documents/${id}`);
    setPreviewHtml(data.content_html);
    setPreviewOpen(true);
  }

  function print() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(previewHtml);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-sans)", padding: "28px 0" }}>

      {/* Header */}
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 400, color: C.text, margin: "0 0 4px" }}>Documents</h1>
      <p style={{ fontSize: 13, color: C.text3, margin: "0 0 2rem" }}>
        Tous les documents sont gratuits et générés instantanément.
      </p>

      {/* Global disclaimer */}
      <div style={{
        background: C.amberBg, border: `1px solid rgba(200,130,0,0.3)`,
        borderRadius: 10, padding: "10px 16px", marginBottom: "1.5rem",
        fontSize: 12, color: C.amber, display: "flex", alignItems: "flex-start", gap: 8,
      }}>
        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{DISCLAIMER}</span>
      </div>

      {/* Actions rapides */}
      <div ref={generatorRef} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: "2rem" }}>
        {ACTION_CARDS.map((card) => (
          <div key={card.title} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 20px 16px", boxShadow: C.shadow }}>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 400, color: C.text, margin: "0 0 6px" }}>{card.title}</h2>
            <p style={{ fontSize: 13, color: C.text3, margin: "0 0 14px", lineHeight: 1.6 }}>
              {card.description}
            </p>
            <DocumentQuickGenerator {...card.generatorProps} />
          </div>
        ))}
      </div>

      {/* Scan factures */}
      <div style={{ marginBottom: "2rem" }}>
        <ScanFacturePanel />
      </div>

      {/* Rappel baux */}
      <div style={{ background: C.orangeBg, borderRadius: 10, padding: "14px 18px", marginBottom: "2rem", fontSize: 13, color: C.orange, lineHeight: 1.7, border: `1px solid ${C.border}` }}>
        <strong>Baux et fiches :</strong> rendez-vous directement sur la page du contrat (bouton <strong>Générer le bail</strong>)
        ou sur la page du bien (bouton <strong>Fiche PDF</strong>). Les données sont pré-remplies automatiquement.
      </div>

      {/* Historique */}
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontWeight: 400, color: C.text, marginBottom: 12 }}>Documents générés récemment</h2>
      {loadingHistory ? (
        <p style={{ fontSize: 13, color: C.text3 }}>Chargement…</p>
      ) : history.length === 0 ? (
        <p style={{ fontSize: 13, color: C.text3 }}>Aucun document généré pour le moment.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {history.map((doc) => (
            <button
              key={doc.id}
              onClick={() => openDoc(doc.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit", boxShadow: C.shadow }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.orangeBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 16, color: C.orange }}>&#128196;</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{TYPE_LABELS[doc.template_type] || doc.template_type}</div>
                <div style={{ fontSize: 12, color: C.text3 }}>{new Date(doc.created_at).toLocaleDateString("fr-CH")} à {new Date(doc.created_at).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <span style={{ fontSize: 12, padding: "3px 10px", background: C.bg, borderRadius: 20, color: C.text2, border: `1px solid ${C.border}` }}>{doc.status}</span>
            </button>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 40 }}>
          <div style={{ background: C.surface, borderRadius: 14, width: "min(92vw, 900px)", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: C.shadowMd }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>Aperçu du document</span>
              <button onClick={() => setPreviewOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: C.text3, fontFamily: "inherit" }}>x</button>
            </div>
            <iframe srcDoc={previewHtml} style={{ flex: 1, border: "none" }} title="Aperçu" />
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
              <button onClick={print} style={{ padding: "8px 16px", background: C.orange, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600 }}>
                Imprimer / PDF
              </button>
              <button onClick={() => setPreviewOpen(false)} style={{ padding: "8px 16px", background: C.surface, color: C.text2, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
