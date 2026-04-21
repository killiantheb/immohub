"use client";

import { useCallback, useRef, useState } from "react";
import { Download, FileText, Loader2, ScanLine, Upload, Check, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";

interface OcrResult {
  montant: number | null;
  date_iso: string | null;
  fournisseur: string | null;
  description: string | null;
  numero_facture: string | null;
  type: "gros_entretien" | "menu_entretien" | "autre";
  affectation: "proprio" | "locataire";
}

interface Bien { id: string; adresse: string; ville: string; }

const TYPE_LABELS: Record<string, string> = {
  gros_entretien: "Gros entretien (proprio)",
  menu_entretien: "Menu entretien (locataire)",
  autre:          "Autre",
};

const AFFECTATION_LABELS: Record<string, string> = {
  proprio:   "À charge du propriétaire",
  locataire: "À charge du locataire",
};

function ScanSection() {
  const fileRef  = useRef<HTMLInputElement>(null);
  const [dragging,  setDragging]  = useState(false);
  const [scanning,  setScanning]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [result,    setResult]    = useState<OcrResult | null>(null);
  const [edited,    setEdited]    = useState<OcrResult | null>(null);
  const [biens,     setBiens]     = useState<Bien[]>([]);
  const [bienId,    setBienId]    = useState("");
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const loadBiens = useCallback(async () => {
    if (biens.length > 0) return;
    try {
      const r = await api.get<Bien[]>("/biens/");
      setBiens(r.data);
      if (r.data[0]) setBienId(r.data[0].id);
    } catch { /* ignore */ }
  }, [biens.length]);

  async function analyser(file: File) {
    setScanning(true);
    setResult(null);
    setEdited(null);
    setSaved(false);
    setError(null);
    await loadBiens();
    try {
      const formData = new FormData();
      formData.append("fichier", file);
      const res = await api.post<OcrResult>("/factures/analyser", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      setEdited(res.data);
    } catch {
      setError("Impossible d'analyser cette facture. Vérifiez le format (JPEG, PNG, PDF).");
    } finally {
      setScanning(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) analyser(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) analyser(file);
  }

  async function enregistrer() {
    if (!edited) return;
    setSaving(true);
    try {
      await api.post("/depenses/", {
        bien_id:        bienId || null,
        montant:        edited.montant,
        date_facture:   edited.date_iso,
        fournisseur:    edited.fournisseur,
        description:    edited.description,
        numero_facture: edited.numero_facture,
        type_entretien: edited.type,
        affectation:    edited.affectation,
      });
      setSaved(true);
      setResult(null);
      setEdited(null);
    } catch {
      setError("Erreur lors de l'enregistrement. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, val: string, key: keyof OcrResult, type: "text" | "number" | "date" = "text") => (
    <div key={key}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
        {label}
      </label>
      <input
        type={type}
        value={val}
        onChange={e => setEdited(prev => prev ? { ...prev, [key]: type === "number" ? parseFloat(e.target.value) || null : e.target.value } : prev)}
        style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, background: C.bg, color: C.text, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
      />
    </div>
  );

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <ScanLine size={18} color={C.orange} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>Scanner une facture</h3>
        <span style={{ fontSize: 11, color: C.text3, marginLeft: "auto" }}>IA · JPEG / PNG / PDF</span>
      </div>

      {!result && !scanning && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? C.orange : C.border}`,
            borderRadius: 12,
            padding: "32px 24px",
            textAlign: "center",
            cursor: "pointer",
            background: dragging ? C.orangeBg : C.bg,
            transition: "all 0.18s",
            marginBottom: saved ? 12 : 0,
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: "none" }}
            onChange={onFileChange}
          />
          <Upload size={28} color={dragging ? C.orange : C.text3} style={{ marginBottom: 10 }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: dragging ? C.orange : C.text }}>
            Glissez une facture ici
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.text3 }}>
            ou cliquez pour sélectionner · JPEG, PNG, PDF
          </p>
        </div>
      )}

      {scanning && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "32px 0" }}>
          <Loader2 size={20} color={C.orange} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 13, color: C.text3 }}>Althy analyse la facture…</span>
        </div>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: C.redBg, borderRadius: 9, border: `1px solid ${C.red}`, marginTop: 12 }}>
          <AlertCircle size={14} color={C.red} />
          <span style={{ fontSize: 12, color: C.red }}>{error}</span>
        </div>
      )}

      {saved && !scanning && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: C.greenBg, borderRadius: 9, border: `1px solid ${C.green}` }}>
          <Check size={14} color={C.green} />
          <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>Dépense enregistrée avec succès.</span>
          <button onClick={() => setSaved(false)} style={{ marginLeft: "auto", fontSize: 11, color: C.text3, background: "none", border: "none", cursor: "pointer" }}>
            Scanner une autre
          </button>
        </div>
      )}

      {edited && !scanning && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.orangeBg, borderRadius: 9, border: `1px solid rgba(15,46,76,0.2)`, marginBottom: 18 }}>
            <Check size={13} color={C.orange} />
            <span style={{ fontSize: 12, color: C.orange, fontWeight: 600 }}>Données extraites par Althy — vérifiez et complétez si nécessaire</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            {field("Fournisseur", edited.fournisseur ?? "", "fournisseur")}
            {field("Montant (CHF)", String(edited.montant ?? ""), "montant", "number")}
            {field("Date de la facture", edited.date_iso ?? "", "date_iso", "date")}
            {field("N° de facture", edited.numero_facture ?? "", "numero_facture")}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
              Description
            </label>
            <textarea
              value={edited.description ?? ""}
              onChange={e => setEdited(prev => prev ? { ...prev, description: e.target.value } : prev)}
              rows={2}
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, background: C.bg, color: C.text, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                Bien concerné
              </label>
              <select
                value={bienId}
                onChange={e => setBienId(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, background: C.bg, color: C.text, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              >
                <option value="">— Aucun bien —</option>
                {biens.map(b => (
                  <option key={b.id} value={b.id}>{b.adresse}, {b.ville}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                Type OBLF
              </label>
              <select
                value={edited.type}
                onChange={e => setEdited(prev => prev ? { ...prev, type: e.target.value as OcrResult["type"] } : prev)}
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, background: C.bg, color: C.text, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                À charge de
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(["proprio", "locataire"] as const).map(v => (
                  <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="affectation"
                      value={v}
                      checked={edited.affectation === v}
                      onChange={() => setEdited(prev => prev ? { ...prev, affectation: v } : prev)}
                      style={{ accentColor: C.orange, width: 14, height: 14 }}
                    />
                    <span style={{ fontSize: 12, color: C.text }}>{AFFECTATION_LABELS[v]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={enregistrer}
              disabled={saving}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: C.orange, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, fontFamily: "inherit" }}
            >
              {saving ? "Enregistrement…" : "Enregistrer la dépense"}
            </button>
            <button
              onClick={() => { setEdited(null); setResult(null); setError(null); }}
              style={{ padding: "10px 18px", borderRadius: 10, background: C.bg, color: C.text3, border: `1px solid ${C.border}`, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type ExportAction = "download_pdf" | "export_excel" | "tax_declaration" | "rapport_gestion";

const EXPORTS: { icon: string; title: string; sub: string; btn: string; action: ExportAction }[] = [
  { icon: "📄", title: "État locatif annuel",     sub: "Récapitulatif loyers par bien · PDF",  btn: "Générer PDF",   action: "download_pdf" },
  { icon: "📊", title: "Export Excel fiduciaire", sub: "Format compatible ERP suisse · XLSX",  btn: "Générer Excel", action: "export_excel" },
  { icon: "🧾", title: "Déclaration fiscale IA",  sub: "Revenus locatifs préremplis · PDF",    btn: "Préparer",      action: "tax_declaration" },
  { icon: "📈", title: "Rapport de gestion",      sub: "Performances & rendements · PDF",      btn: "Générer",       action: "rapport_gestion" },
];

const ACTION_ENDPOINTS: Record<ExportAction, (year: number) => string> = {
  download_pdf:     (y) => `/export/etat-locatif-pdf?year=${y}`,
  export_excel:     (y) => `/export/etat-locatif-xlsx?year=${y}`,
  tax_declaration:  (y) => `/export/declaration-fiscale?year=${y}`,
  rapport_gestion:  (y) => `/export/rapport-gestion?year=${y}`,
};

function ExportSection({ year }: { year: number }) {
  const [loading, setLoading] = useState<ExportAction | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function handleExport(action: ExportAction) {
    setLoading(action);
    setError(null);
    try {
      const url = ACTION_ENDPOINTS[action](year);
      const resp = await api.get(url, { responseType: "blob" });
      const contentDisp = resp.headers["content-disposition"] || "";
      const filenameMatch = contentDisp.match(/filename=(.+)/);
      const filename = filenameMatch ? filenameMatch[1] : `export_${action}_${year}`;
      const blobUrl = URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError("Erreur lors de la génération. Réessayez.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.text }}>Exports disponibles</h3>
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.redBg, borderRadius: 9, border: `1px solid ${C.red}`, marginBottom: 14 }}>
          <AlertCircle size={13} color={C.red} />
          <span style={{ fontSize: 12, color: C.red }}>{error}</span>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {EXPORTS.map(e => {
          const isLoading = loading === e.action;
          return (
            <div key={e.title} style={{ padding: "16px 18px", border: `1px solid ${C.border}`, borderRadius: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{e.icon}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, marginBottom: 3 }}>{e.title}</div>
              <div style={{ fontSize: 11.5, color: C.text3, marginBottom: 12 }}>{e.sub}</div>
              <button
                onClick={() => handleExport(e.action)}
                disabled={isLoading || loading !== null}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", border: `1px solid ${C.border}`, borderRadius: 8,
                  backgroundColor: isLoading ? C.orangeBg : C.surface2,
                  color: isLoading ? C.orange : C.text2,
                  fontSize: 12, fontWeight: 600,
                  cursor: isLoading || loading !== null ? "default" : "pointer",
                  opacity: loading !== null && !isLoading ? 0.5 : 1,
                }}
              >
                {isLoading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
                {e.btn}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const YEAR = new Date().getFullYear();

export function ComptabiliteView() {
  const [year, setYear] = useState(YEAR);
  const [exportingCsv, setExportingCsv] = useState(false);

  async function downloadCsv() {
    setExportingCsv(true);
    try {
      const resp = await api.get(`/ai/export/etat-locatif?year=${year}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([resp.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `etat_locatif_${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <p style={{ margin: 0, color: C.text3, fontSize: 13 }}>États locatifs · Rapport annuel · Export fiduciaire</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, backgroundColor: C.surface, color: C.text, outline: "none" }}>
            {[YEAR, YEAR - 1, YEAR - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => window.print()}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: `1px solid ${C.border}`, borderRadius: 9, backgroundColor: C.surface, color: C.text2, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Download size={14} /> Export PDF
          </button>
          <button
            onClick={downloadCsv}
            disabled={exportingCsv}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: `1px solid ${C.orange}`, borderRadius: 9, backgroundColor: C.orangeBg, color: C.orange, fontSize: 13, fontWeight: 600, cursor: exportingCsv ? "default" : "pointer" }}
          >
            {exportingCsv ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <FileText size={14} />}
            Export CSV fiduciaire
          </button>
        </div>
      </div>

      <ScanSection />

      <ExportSection year={year} />
    </div>
  );
}
