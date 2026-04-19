"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useCreateContract } from "@/lib/hooks/useContracts";
import type { ContractType } from "@/lib/types";
import { C } from "@/lib/design-tokens";

const TYPE_OPTIONS: { value: ContractType; label: string }[] = [
  { value: "long_term",  label: "Longue durée" },
  { value: "seasonal",   label: "Saisonnier" },
  { value: "short_term", label: "Courte durée" },
  { value: "sale",       label: "Vente" },
];

const cardStyle: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  boxShadow: C.shadow,
  padding: "1.25rem",
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "9px 14px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text,
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: C.text3,
  marginBottom: 5,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: C.text2,
  marginBottom: "0.75rem",
};

export default function NewContractPage() {
  const router = useRouter();
  const create = useCreateContract();

  const [form, setForm] = useState({
    property_id: "",
    tenant_id: "",
    agency_id: "",
    type: "long_term" as ContractType,
    start_date: "",
    end_date: "",
    monthly_rent: "",
    charges: "",
    deposit: "",
    // Extended
    is_furnished: false,
    payment_day: "5",
    notice_period_months: "3",
    deposit_type: "gocaution",
    canton: "VS",
    signed_at_city: "",
    bank_name: "",
    bank_iban: "",
    bank_bic: "",
    occupants_count: "",
    tenant_nationality: "",
    tourist_tax_amount: "",
    cleaning_fee_hourly: "42",
    subletting_allowed: false,
    animals_allowed: false,
    smoking_allowed: false,
    is_for_sale: false,
    linen_fee_included: false,
  });

  const [nlpInput, setNlpInput] = useState("");
  const [nlpLoading, setNlpLoading] = useState(false);
  const [nlpResult, setNlpResult] = useState<{
    ai_recommendations?: string[];
    warnings?: string[];
  } | null>(null);

  const set = (k: keyof typeof form, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  async function handleNlpParse() {
    if (!nlpInput.trim() || nlpLoading) return;
    setNlpLoading(true);
    setNlpResult(null);
    try {
      const { api } = await import("@/lib/api");
      const { data } = await api.post<{
        type?: string;
        deposit_months?: number;
        commission_pct?: number;
        notice_months?: number;
        min_duration_months?: number;
        included_charges?: boolean;
        ai_recommendations?: string[];
        warnings?: string[];
      }>("/sphere/parse-contract-params", { description: nlpInput });

      if (data.type && TYPE_OPTIONS.find((t) => t.value === data.type)) {
        set("type", data.type as ContractType);
      }
      setNlpResult({ ai_recommendations: data.ai_recommendations, warnings: data.warnings });
    } catch {
      setNlpResult({ warnings: ["Impossible d'analyser la description."] });
    } finally {
      setNlpLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      property_id: form.property_id,
      tenant_id: form.tenant_id || undefined,
      agency_id: form.agency_id || undefined,
      type: form.type,
      start_date: new Date(form.start_date).toISOString(),
      end_date: form.end_date ? new Date(form.end_date).toISOString() : undefined,
      monthly_rent: form.monthly_rent ? parseFloat(form.monthly_rent) : undefined,
      charges: form.charges ? parseFloat(form.charges) : undefined,
      deposit: form.deposit ? parseFloat(form.deposit) : undefined,
      // Extended
      is_furnished: form.is_furnished,
      payment_day: form.payment_day ? parseInt(form.payment_day) : 5,
      notice_period_months: form.notice_period_months ? parseInt(form.notice_period_months) : 3,
      deposit_type: form.deposit_type,
      canton: form.canton || "VS",
      signed_at_city: form.signed_at_city || undefined,
      bank_name: form.bank_name || undefined,
      bank_iban: form.bank_iban || undefined,
      bank_bic: form.bank_bic || undefined,
      occupants_count: form.occupants_count ? parseInt(form.occupants_count) : undefined,
      tenant_nationality: form.tenant_nationality || undefined,
      tourist_tax_amount: form.tourist_tax_amount ? parseFloat(form.tourist_tax_amount) : undefined,
      cleaning_fee_hourly: form.cleaning_fee_hourly ? parseFloat(form.cleaning_fee_hourly) : 42,
      subletting_allowed: form.subletting_allowed,
      animals_allowed: form.animals_allowed,
      smoking_allowed: form.smoking_allowed,
      is_for_sale: form.is_for_sale,
      linen_fee_included: form.linen_fee_included,
    });
    router.push("/app/contracts");
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/app/contracts" style={{ color: C.text3, display: "flex", alignItems: "center" }}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 28, color: C.text }}>
          Nouveau contrat
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* AI NLP Parser */}
        <div style={{ ...cardStyle, background: C.amberBg, border: `1px solid ${C.amber}` }} className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: C.amber }} />
            <h2 style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>Générer avec l&apos;IA</h2>
          </div>
          <p style={{ fontSize: 12, color: C.text2 }}>Décrivez votre contrat en langage naturel et l&apos;IA pré-remplira les paramètres.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={nlpInput}
              onChange={(e) => setNlpInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault() || (e.key === "Enter" && handleNlpParse())}
              placeholder="Ex : saisonnier 15% commission, dépôt 2 mois, préavis 1 mois…"
              style={{ ...inputStyle, flex: 1, fontSize: 12 }}
            />
            <button
              type="button"
              onClick={handleNlpParse}
              disabled={!nlpInput.trim() || nlpLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.orange, color: "#fff", borderRadius: 10, padding: "10px 16px", fontSize: 12, fontWeight: 700, border: "none", cursor: !nlpInput.trim() || nlpLoading ? "not-allowed" : "pointer", opacity: !nlpInput.trim() || nlpLoading ? 0.5 : 1, whiteSpace: "nowrap" }}
            >
              {nlpLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Analyser
            </button>
          </div>
          {nlpResult && (
            <div className="space-y-1.5">
              {nlpResult.warnings?.map((w, i) => (
                <p key={i} style={{ fontSize: 12, color: C.red }}>! {w}</p>
              ))}
              {nlpResult.ai_recommendations?.map((r, i) => (
                <p key={i} style={{ fontSize: 12, color: C.text2 }}>+ {r}</p>
              ))}
            </div>
          )}
        </div>

        {/* Parties */}
        <div style={cardStyle} className="space-y-4">
          <h2 style={sectionTitleStyle}>Parties</h2>
          <div>
            <label style={labelStyle}>ID du bien *</label>
            <input
              required
              type="text"
              value={form.property_id}
              onChange={(e) => set("property_id", e.target.value)}
              style={inputStyle}
              placeholder="UUID du bien"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>ID du locataire</label>
              <input
                type="text"
                value={form.tenant_id}
                onChange={(e) => set("tenant_id", e.target.value)}
                style={inputStyle}
                placeholder="UUID (optionnel)"
              />
            </div>
            <div>
              <label style={labelStyle}>ID de l&apos;agence</label>
              <input
                type="text"
                value={form.agency_id}
                onChange={(e) => set("agency_id", e.target.value)}
                style={inputStyle}
                placeholder="UUID (optionnel)"
              />
            </div>
          </div>
        </div>

        {/* Contract terms */}
        <div style={cardStyle} className="space-y-4">
          <h2 style={sectionTitleStyle}>Conditions</h2>
          <div>
            <label style={labelStyle}>Type de contrat *</label>
            <select
              required
              value={form.type}
              onChange={(e) => set("type", e.target.value as ContractType)}
              style={inputStyle}
            >
              {TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Date de début *</label>
              <input
                required
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Date de fin</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Financials */}
        <div style={cardStyle} className="space-y-4">
          <h2 style={sectionTitleStyle}>Finances</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label style={labelStyle}>Loyer mensuel (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_rent}
                onChange={(e) => set("monthly_rent", e.target.value)}
                style={inputStyle}
                placeholder="0.00"
              />
            </div>
            <div>
              <label style={labelStyle}>Charges (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.charges}
                onChange={(e) => set("charges", e.target.value)}
                style={inputStyle}
                placeholder="0.00"
              />
            </div>
            <div>
              <label style={labelStyle}>Dépôt de garantie (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.deposit}
                onChange={(e) => set("deposit", e.target.value)}
                style={inputStyle}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* Bail details */}
        <div style={cardStyle} className="space-y-4">
          <h2 style={sectionTitleStyle}>Paramètres du bail</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label style={labelStyle}>Jour de paiement</label>
              <input type="number" min="1" max="28" value={form.payment_day} onChange={(e) => set("payment_day", e.target.value)} style={inputStyle} placeholder="5" />
            </div>
            <div>
              <label style={labelStyle}>Préavis (mois)</label>
              <input type="number" min="0" max="12" value={form.notice_period_months} onChange={(e) => set("notice_period_months", e.target.value)} style={inputStyle} placeholder="3" />
            </div>
            <div>
              <label style={labelStyle}>Nb d'occupants</label>
              <input type="number" min="1" value={form.occupants_count} onChange={(e) => set("occupants_count", e.target.value)} style={inputStyle} placeholder="1" />
            </div>
            <div>
              <label style={labelStyle}>Nationalité locataire</label>
              <input type="text" value={form.tenant_nationality} onChange={(e) => set("tenant_nationality", e.target.value)} style={inputStyle} placeholder="Suisse" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label style={labelStyle}>Type de dépôt</label>
              <select value={form.deposit_type} onChange={(e) => set("deposit_type", e.target.value)} style={inputStyle}>
                <option value="gocaution">Gocaution</option>
                <option value="bank">Compte bancaire bloqué</option>
                <option value="cash">Espèces</option>
                <option value="insurance">Assurance caution</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Canton</label>
              <select value={form.canton} onChange={(e) => set("canton", e.target.value)} style={inputStyle}>
                {["VS","VD","GE","BE","FR","NE","JU","TI","ZH","BS","BL","AG","SO","LU","ZG","SG","TG"].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Lieu de signature</label>
              <input type="text" value={form.signed_at_city} onChange={(e) => set("signed_at_city", e.target.value)} style={inputStyle} placeholder="Crans-Montana" />
            </div>
          </div>
          {(form.type === "seasonal" || form.type === "short_term") && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Taxe de séjour (CHF/nuit)</label>
                <input type="number" min="0" step="0.01" value={form.tourist_tax_amount} onChange={(e) => set("tourist_tax_amount", e.target.value)} style={inputStyle} placeholder="0.00" />
              </div>
              <div>
                <label style={labelStyle}>Nettoyage (CHF/h)</label>
                <input type="number" min="0" step="0.50" value={form.cleaning_fee_hourly} onChange={(e) => set("cleaning_fee_hourly", e.target.value)} style={inputStyle} placeholder="42" />
              </div>
            </div>
          )}
        </div>

        {/* Bank account */}
        <div style={cardStyle} className="space-y-4">
          <h2 style={sectionTitleStyle}>Compte bancaire pour le loyer</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label style={labelStyle}>Banque</label>
              <input type="text" value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} style={inputStyle} placeholder="Raiffeisen" />
            </div>
            <div>
              <label style={labelStyle}>IBAN</label>
              <input type="text" value={form.bank_iban} onChange={(e) => set("bank_iban", e.target.value.toUpperCase())} style={{ ...inputStyle, fontFamily: "monospace" }} placeholder="CH56 0483 5012 3456 7800 9" />
            </div>
            <div>
              <label style={labelStyle}>BIC/SWIFT</label>
              <input type="text" value={form.bank_bic} onChange={(e) => set("bank_bic", e.target.value.toUpperCase())} style={{ ...inputStyle, fontFamily: "monospace" }} placeholder="RAIFCH22" />
            </div>
          </div>
        </div>

        {/* Options */}
        <div style={cardStyle} className="space-y-3">
          <h2 style={sectionTitleStyle}>Clauses particulières</h2>
          <div className="flex flex-wrap gap-4">
            {[
              { key: "is_furnished", label: "Meublé" },
              { key: "linen_fee_included", label: "Linge de maison inclus" },
              { key: "subletting_allowed", label: "Sous-location autorisée" },
              { key: "animals_allowed", label: "Animaux acceptés" },
              { key: "smoking_allowed", label: "Fumeurs acceptés" },
              { key: "is_for_sale", label: "Avec clause de vente" },
            ].map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form[key as keyof typeof form] as boolean}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: C.orange }}
                />
                <span style={{ fontSize: 13, color: C.text }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link
            href="/app/contracts"
            style={{ display: "inline-flex", alignItems: "center", padding: "10px 20px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text2, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={create.isPending}
            style={{ display: "inline-flex", alignItems: "center", background: C.orange, color: "#fff", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, border: "none", cursor: create.isPending ? "not-allowed" : "pointer", opacity: create.isPending ? 0.7 : 1 }}
          >
            {create.isPending ? "Création…" : "Créer le contrat"}
          </button>
        </div>

        {create.isError && (
          <p style={{ fontSize: 13, color: C.red }}>Une erreur est survenue. Vérifiez les informations.</p>
        )}
      </form>
    </div>
  );
}
