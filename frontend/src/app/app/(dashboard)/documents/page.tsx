"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { DocumentQuickGenerator } from "@/components/DocumentQuickGenerator";

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
};

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
    <div style={{ padding: "2rem", maxWidth: 900, margin: "0 auto", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Documents</h1>
      <p style={{ fontSize: 13, color: "#888", margin: "0 0 2rem" }}>
        Les baux et fiches se génèrent directement depuis la page du contrat ou du bien.
      </p>

      {/* Actions rapides */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: "2.5rem" }}>

        {/* Demande de pièces */}
        <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "20px 20px 16px" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>Demande de pièces</h2>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 14px", lineHeight: 1.6 }}>
            2 questions → le bon document selon le profil du locataire (particulier, société, saisonnier, commercial…)
          </p>
          <DocumentQuickGenerator
            label="Générer"
            icon="📋"
            smartPieces
            variant="primary"
          />
        </div>

        {/* Mandat de gestion */}
        <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "20px 20px 16px" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🤝</div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>Mandat de gestion locative</h2>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 14px", lineHeight: 1.6 }}>
            Contrat entre le propriétaire et l'agence. À lier à un bien existant.
          </p>
          <DocumentQuickGenerator
            label="Générer"
            icon="🤝"
            templateType="mandat_gestion"
            variant="primary"
          />
        </div>

        {/* Réquisition de poursuite */}
        <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 12, padding: "20px 20px 16px" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚖️</div>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>Réquisition de poursuite</h2>
          <p style={{ fontSize: 12, color: "#888", margin: "0 0 14px", lineHeight: 1.6 }}>
            Formulaire LP à envoyer à l'office des poursuites en cas de loyers impayés (art. 82 LP).
          </p>
          <DocumentQuickGenerator
            label="Générer"
            icon="⚖️"
            templateType="requisition_poursuite"
            variant="primary"
          />
        </div>
      </div>

      {/* Rappel */}
      <div style={{ background: "#f9f6f2", borderRadius: 10, padding: "14px 18px", marginBottom: "2rem", fontSize: 12, color: "#a05c28", lineHeight: 1.7 }}>
        <strong>Baux et fiches :</strong> rendez-vous directement sur la page du contrat (bouton <strong>Générer le bail</strong>)
        ou sur la page du bien (bouton <strong>Fiche PDF</strong>). Les données sont pré-remplies automatiquement.
      </div>

      {/* Historique */}
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Documents générés récemment</h2>
      {loadingHistory ? (
        <p style={{ fontSize: 13, color: "#aaa" }}>Chargement…</p>
      ) : history.length === 0 ? (
        <p style={{ fontSize: 13, color: "#aaa" }}>Aucun document généré pour le moment.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {history.map((doc) => (
            <button
              key={doc.id}
              onClick={() => openDoc(doc.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ fontSize: 18 }}>📄</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{TYPE_LABELS[doc.template_type] || doc.template_type}</div>
                <div style={{ fontSize: 11, color: "#aaa" }}>{new Date(doc.created_at).toLocaleDateString("fr-CH")} à {new Date(doc.created_at).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <span style={{ fontSize: 11, padding: "3px 8px", background: "#f0f0f0", borderRadius: 20, color: "#666" }}>{doc.status}</span>
            </button>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 40 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "min(92vw, 900px)", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #eee" }}>
              <span style={{ fontWeight: 700 }}>Aperçu du document</span>
              <button onClick={() => setPreviewOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#888" }}>×</button>
            </div>
            <iframe srcDoc={previewHtml} style={{ flex: 1, border: "none" }} title="Aperçu" />
            <div style={{ padding: "12px 20px", borderTop: "1px solid #eee", display: "flex", gap: 10 }}>
              <button onClick={print} style={{ padding: "8px 16px", background: "#D4601A", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: 600 }}>
                🖨️ Imprimer / PDF
              </button>
              <button onClick={() => setPreviewOpen(false)} style={{ padding: "8px 16px", background: "#fff", color: "#555", border: "1px solid #e5e5e5", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
