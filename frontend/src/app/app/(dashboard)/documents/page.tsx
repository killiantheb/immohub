"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { DocumentQuickGenerator } from "@/components/DocumentQuickGenerator";

// ── Althy tokens ──────────────────────────────────────────────────────────────
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

interface GeneratedDoc {
  id: string;
  template_type: string;
  status: string;
  created_at: string;
}

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
};

// Action card items
const ACTION_CARDS = [
  {
    title: "Demande de pièces",
    description: "2 questions → le bon document selon le profil du locataire (particulier, société, saisonnier, commercial…)",
    generatorProps: { label: "Générer", smartPieces: true, variant: "primary" as const },
  },
  {
    title: "Mandat de gestion locative",
    description: "Contrat entre le propriétaire et l'agence. À lier à un bien existant.",
    generatorProps: { label: "Générer", templateType: "mandat_gestion", variant: "primary" as const },
  },
  {
    title: "Réquisition de poursuite",
    description: "Formulaire LP à envoyer à l'office des poursuites en cas de loyers impayés (art. 82 LP).",
    generatorProps: { label: "Générer", templateType: "requisition_poursuite", variant: "primary" as const },
  },
];

export default function DocumentsPage() {
  const [history, setHistory] = useState<GeneratedDoc[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

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
    <div style={{ maxWidth: 900, margin: "0 auto", fontFamily: "var(--font-sans)" }}>

      {/* Header */}
      <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontSize: 26, fontWeight: 400, color: S.text, margin: "0 0 4px" }}>Documents</h1>
      <p style={{ fontSize: 13, color: S.text3, margin: "0 0 2rem" }}>
        Les baux et fiches se génèrent directement depuis la page du contrat ou du bien.
      </p>

      {/* Actions rapides */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: "2.5rem" }}>
        {ACTION_CARDS.map((card) => (
          <div key={card.title} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: "20px 20px 16px", boxShadow: S.shadow }}>
            <h2 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontSize: 17, fontWeight: 400, color: S.text, margin: "0 0 6px" }}>{card.title}</h2>
            <p style={{ fontSize: 13, color: S.text3, margin: "0 0 14px", lineHeight: 1.6 }}>
              {card.description}
            </p>
            <DocumentQuickGenerator {...card.generatorProps} />
          </div>
        ))}
      </div>

      {/* Rappel */}
      <div style={{ background: S.orangeBg, borderRadius: 10, padding: "14px 18px", marginBottom: "2rem", fontSize: 13, color: S.orange, lineHeight: 1.7, border: `1px solid ${S.border}` }}>
        <strong>Baux et fiches :</strong> rendez-vous directement sur la page du contrat (bouton <strong>Générer le bail</strong>)
        ou sur la page du bien (bouton <strong>Fiche PDF</strong>). Les données sont pré-remplies automatiquement.
      </div>

      {/* Historique */}
      <h2 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontSize: 18, fontWeight: 400, color: S.text, marginBottom: 12 }}>Documents générés récemment</h2>
      {loadingHistory ? (
        <p style={{ fontSize: 13, color: S.text3 }}>Chargement…</p>
      ) : history.length === 0 ? (
        <p style={{ fontSize: 13, color: S.text3 }}>Aucun document généré pour le moment.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {history.map((doc) => (
            <button
              key={doc.id}
              onClick={() => openDoc(doc.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: S.surface, border: `1px solid ${S.border}`, borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit", boxShadow: S.shadow }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: S.orangeBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 16, color: S.orange }}>&#128196;</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: S.text }}>{TYPE_LABELS[doc.template_type] || doc.template_type}</div>
                <div style={{ fontSize: 12, color: S.text3 }}>{new Date(doc.created_at).toLocaleDateString("fr-CH")} à {new Date(doc.created_at).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <span style={{ fontSize: 12, padding: "3px 10px", background: S.bg, borderRadius: 20, color: S.text2, border: `1px solid ${S.border}` }}>{doc.status}</span>
            </button>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 40 }}>
          <div style={{ background: S.surface, borderRadius: 14, width: "min(92vw, 900px)", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: S.shadowMd }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${S.border}` }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: S.text }}>Aperçu du document</span>
              <button onClick={() => setPreviewOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: S.text3, fontFamily: "inherit" }}>x</button>
            </div>
            <iframe srcDoc={previewHtml} style={{ flex: 1, border: "none" }} title="Aperçu" />
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${S.border}`, display: "flex", gap: 10 }}>
              <button onClick={print} style={{ padding: "8px 16px", background: S.orange, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600 }}>
                Imprimer / PDF
              </button>
              <button onClick={() => setPreviewOpen(false)} style={{ padding: "8px 16px", background: S.surface, color: S.text2, border: `1px solid ${S.border}`, borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
