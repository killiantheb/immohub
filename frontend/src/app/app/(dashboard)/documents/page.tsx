"use client";

/**
 * /app/documents — Page "Documents" (proprio_solo).
 *
 * Doctrine §B.15 (CLAUDE.md) :
 *   - Le panel "Scan de facture" (OCR IA + confirmation affectation OBLF) est
 *     Phase 2 (compta dynamique + OCR avancé, cf docs/2-ROADMAP.md §2.4.5).
 *     Endpoints /ai/scan-facture + /ai/confirmer-facture conservés backend.
 *   - "Mandat de gestion locative" concerne le rôle agence (Phase 2 — Lot D).
 *   - "Dossier vendeur" appartient au flux vente (Phase 2).
 *
 * Phase 1.0 disponible :
 *   - Demande de pièces (multi-profils)
 *   - Lettre de relance (3 niveaux : amiable, mise en demeure CO 102, CO 257d)
 *   - Réquisition de poursuite (art. 82 LP)
 *   - Historique des documents générés
 */

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { DocumentQuickGenerator } from "@/components/DocumentQuickGenerator";
import { BienContextBanner } from "@/components/biens/BienContextBanner";
import { AlertTriangle } from "lucide-react";
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
};

// Action card items — Phase 1.0 uniquement.
// "Mandat de gestion locative" + "Dossier vendeur" retirés (Phase 2, cf §B.15).
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
      {/* Banner contextuel — déjà dans Suspense parent (ligne 268) */}
      <BienContextBanner />

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
