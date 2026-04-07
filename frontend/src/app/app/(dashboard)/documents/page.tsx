"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TemplateType {
  key: string;
  label: string;
  icon: string;
}

interface Contract {
  id: string;
  reference: string;
  type: string;
  status: string;
  start_date: string;
}

interface Property {
  id: string;
  address: string;
  city: string;
  building_name?: string;
}

interface GeneratedDoc {
  id: string;
  template_type: string;
  status: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROFILE_OPTIONS = [
  { value: "annee", label: "Individuel — annuel" },
  { value: "saison", label: "Individuel — saisonnier" },
  { value: "nuitee", label: "Individuel — nuitée" },
  { value: "societe", label: "Société" },
  { value: "commercial", label: "Bail commercial" },
];

const TYPE_LABELS: Record<string, string> = {
  bail_annee: "Bail à l'année",
  bail_annee_avec_vente: "Bail annuel + vente",
  bail_saison: "Bail saisonnier",
  mandat_gestion: "Mandat de gestion",
  fiche_bien: "Fiche de présentation",
  demande_pieces_annee: "Demande de pièces",
  demande_pieces_saison: "Demande de pièces",
  demande_pieces_nuitee: "Demande de pièces",
  demande_pieces_societe: "Demande de pièces",
  demande_pieces_commercial: "Demande de pièces",
  requisition_poursuite: "Réquisition de poursuite",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [step, setStep] = useState<"pick" | "configure" | "preview">("pick");
  const [templates, setTemplates] = useState<TemplateType[]>([]);
  const [selectedType, setSelectedType] = useState<TemplateType | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [profile, setProfile] = useState("annee");
  const [extra, setExtra] = useState<Record<string, string>>({
    charges_label: "charges comprises",
    signed_date: new Date().toLocaleDateString("fr-CH"),
  });
  const [generating, setGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [generatedId, setGeneratedId] = useState("");
  const [history, setHistory] = useState<GeneratedDoc[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    api.get<TemplateType[]>("/documents/types").then((r) => setTemplates(r.data)).catch(() => {});
    api.get<{ items: Contract[] }>("/contracts/?size=100").then((r) => setContracts(r.data.items || [])).catch(() => {});
    api.get<{ items: Property[] }>("/properties/?size=100").then((r) => setProperties(r.data.items || [])).catch(() => {});
    api.get<GeneratedDoc[]>("/documents/?limit=20")
      .then((r) => setHistory(r.data))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

  function selectType(t: TemplateType) {
    setSelectedType(t);
    setStep("configure");
  }

  async function generate() {
    if (!selectedType) return;
    setGenerating(true);
    try {
      const { data } = await api.post<{ id: string; content_html: string }>("/documents/generate", {
        template_type: selectedType.key,
        contract_id: selectedContractId || null,
        property_id: selectedPropertyId || null,
        profile,
        extra,
      });
      setGeneratedHtml(data.content_html);
      setGeneratedId(data.id);
      setStep("preview");
      // refresh history
      api.get<GeneratedDoc[]>("/documents/?limit=20").then((r) => setHistory(r.data)).catch(() => {});
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Erreur lors de la génération";
      alert(msg);
    } finally {
      setGenerating(false);
    }
  }

  function printDocument() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(generatedHtml);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  async function loadHistoryDoc(id: string) {
    try {
      const { data } = await api.get<{ content_html: string }>(`/documents/${id}`);
      setGeneratedHtml(data.content_html);
      setGeneratedId(id);
      setStep("preview");
    } catch {
      alert("Erreur lors du chargement du document");
    }
  }

  const needsProfile = selectedType?.key.startsWith("demande_pieces");
  const needsContract = ["bail_annee", "bail_annee_avec_vente", "bail_saison", "requisition_poursuite"].includes(selectedType?.key || "");
  const needsProperty = ["mandat_gestion", "fiche_bien"].includes(selectedType?.key || "");

  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto", fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Documents</h1>
        <p style={{ fontSize: 13, color: "#888", margin: "4px 0 0" }}>
          Générés automatiquement par l'IA — adaptés à votre situation et à votre agence
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>

        {/* Left — wizard */}
        <div>

          {/* Step 1 — Pick type */}
          {step === "pick" && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "#888", marginBottom: 12 }}>
                Choisissez un type de document
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {templates.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => selectType(t)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10, cursor: "pointer", textAlign: "left", transition: "border-color 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#D4601A")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e5e5")}
                  >
                    <span style={{ fontSize: 22 }}>{t.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Configure */}
          {step === "configure" && selectedType && (
            <div>
              <button onClick={() => setStep("pick")} style={{ marginBottom: 16, background: "none", border: "none", color: "#D4601A", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                ← Retour
              </button>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selectedType.icon} {selectedType.label}</h2>
              <p style={{ fontSize: 12, color: "#888", marginBottom: 20 }}>Complétez les informations nécessaires à la génération</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {needsContract && (
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Contrat lié</span>
                    <select
                      value={selectedContractId}
                      onChange={(e) => setSelectedContractId(e.target.value)}
                      style={{ padding: "8px 12px", border: "1px solid #e5e5e5", borderRadius: 8, fontSize: 13, background: "#fff" }}
                    >
                      <option value="">— Aucun contrat (saisie manuelle) —</option>
                      {contracts.map((c) => (
                        <option key={c.id} value={c.id}>{c.reference} — {c.type} ({c.status})</option>
                      ))}
                    </select>
                  </label>
                )}

                {needsProperty && (
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Bien immobilier</span>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      style={{ padding: "8px 12px", border: "1px solid #e5e5e5", borderRadius: 8, fontSize: 13, background: "#fff" }}
                    >
                      <option value="">— Sélectionner un bien —</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>{p.building_name || p.address} — {p.city}</option>
                      ))}
                    </select>
                  </label>
                )}

                {needsProfile && (
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Profil du locataire</span>
                    <select
                      value={profile}
                      onChange={(e) => setProfile(e.target.value)}
                      style={{ padding: "8px 12px", border: "1px solid #e5e5e5", borderRadius: 8, fontSize: 13, background: "#fff" }}
                    >
                      {PROFILE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                )}

                {/* Extra fields */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>Paramètres complémentaires (optionnel)</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      { key: "charges_label", label: "Libellé des charges", placeholder: "charges comprises" },
                      { key: "signed_date", label: "Date de signature", placeholder: "07.04.2026" },
                      { key: "partial_period_label", label: "Libellé période partielle", placeholder: "octobre 2026" },
                      { key: "owner_address", label: "Adresse du propriétaire", placeholder: "Rue des Fleurs 1, 1200 Genève" },
                    ].map(({ key, label, placeholder }) => (
                      <label key={key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 11, color: "#888" }}>{label}</span>
                        <input
                          value={extra[key] || ""}
                          onChange={(e) => setExtra((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={placeholder}
                          style={{ padding: "7px 10px", border: "1px solid #e5e5e5", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }}
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ background: "#fff8f0", border: "1px solid #f5d0a9", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#a05c28", lineHeight: 1.6 }}>
                  <strong>Rappel :</strong> Ce document est généré à titre indicatif. La responsabilité juridique incombe exclusivement aux signataires.
                  Althy décline toute responsabilité quant aux effets légaux du document.
                </div>

                <button
                  onClick={generate}
                  disabled={generating}
                  style={{ padding: "12px 24px", background: generating ? "#ccc" : "#D4601A", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: generating ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                >
                  {generating ? "Génération en cours…" : "Générer le document"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Preview */}
          {step === "preview" && (
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
                <button onClick={() => setStep("pick")} style={{ background: "none", border: "1px solid #e5e5e5", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: "#555", fontFamily: "inherit" }}>
                  ← Nouveau document
                </button>
                <button onClick={printDocument} style={{ background: "#D4601A", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#fff", fontFamily: "inherit" }}>
                  Imprimer / Télécharger PDF
                </button>
                <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>Réf. {generatedId.slice(0, 8).toUpperCase()}</span>
              </div>

              <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
                <iframe
                  srcDoc={generatedHtml}
                  style={{ width: "100%", height: 700, border: "none" }}
                  title="Aperçu du document"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right — history */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "#888", marginBottom: 12 }}>
            Documents récents
          </p>
          {loadingHistory ? (
            <p style={{ fontSize: 12, color: "#aaa" }}>Chargement…</p>
          ) : history.length === 0 ? (
            <p style={{ fontSize: 12, color: "#aaa" }}>Aucun document généré</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => loadHistoryDoc(doc.id)}
                  style={{ display: "flex", flexDirection: "column", gap: 3, padding: "10px 12px", background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a" }}>{TYPE_LABELS[doc.template_type] || doc.template_type}</span>
                  <span style={{ fontSize: 10, color: "#aaa" }}>{new Date(doc.created_at).toLocaleDateString("fr-CH")} — {doc.status}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 24, padding: "14px 16px", background: "#f9f6f2", borderRadius: 10, fontSize: 12, color: "#a05c28", lineHeight: 1.7 }}>
            <strong style={{ display: "block", marginBottom: 4 }}>Types de documents disponibles</strong>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>Baux annuels (standard, avec vente)</li>
              <li>Bail saisonnier meublé</li>
              <li>Mandat de gestion locative</li>
              <li>Fiche de présentation bien</li>
              <li>Demandes de pièces (4 profils)</li>
              <li>Réquisition de poursuite LP</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
