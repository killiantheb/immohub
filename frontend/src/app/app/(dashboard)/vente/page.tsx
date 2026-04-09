"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Plus, TrendingUp, Home, Users, FileText, CheckCircle, Loader2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

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
  amber:    "var(--althy-amber)",
  amberBg:  "var(--althy-amber-bg)",
  border2:  "var(--althy-border)",
  shadow:   "var(--althy-shadow)",
} as const;

const DISCLAIMER = "⚠️ Estimation générée automatiquement à titre indicatif uniquement. Althy décline toute responsabilité. Faire valider par un expert immobilier agréé.";

function fmt(n: number | null | undefined) {
  if (!n) return "—";
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n);
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  actif:   { label: "Actif",     color: S.green,  bg: S.greenBg  },
  offre:   { label: "Offre",     color: S.orange, bg: S.orangeBg },
  vendu:   { label: "Vendu",     color: S.text3,  bg: S.surface2 },
  retire:  { label: "Retiré",    color: S.red,    bg: S.redBg    },
};

const OFFER_CFG: Record<string, { label: string; color: string }> = {
  recu:         { label: "Reçue",         color: S.orange },
  accepte:      { label: "Acceptée",      color: S.green  },
  refuse:       { label: "Refusée",       color: S.red    },
  contre_offre: { label: "Contre-offre",  color: S.amber  },
  expire:       { label: "Expirée",       color: S.text3  },
};

interface EstimateResult {
  estimate_low: number;
  estimate_high: number;
  estimate_mid: number;
  rapport: string;
  disclaimer: string;
  mandate_type: string;
}

interface Offer {
  id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  offer_price: number;
  counter_offer_price: number | null;
  status: string;
  message: string | null;
  created_at: string;
}

interface Mandate {
  id: string;
  address: string | null;
  city: string | null;
  surface_m2: number | null;
  nb_rooms: number | null;
  year_built: number | null;
  description: string | null;
  asking_price: number | null;
  ia_estimate: number | null;
  ia_estimate_report: string | null;
  mandate_type: string;
  status: string;
  sale_price_final: number | null;
  sold_at: string | null;
  created_at: string;
}

// ── Step 1: Estimate ──────────────────────────────────────────────────────────

function EstimatePanel({ onMandateCreated }: { onMandateCreated: () => void }) {
  const [form, setForm] = useState({ address: "", city: "", surface_m2: "", nb_rooms: "", year_built: "", description: "", mandate_type: "solo" });
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [showReport, setShowReport] = useState(false);

  const estimateMut = useMutation({
    mutationFn: (data: object) => api.post<EstimateResult>("/vente/estimate", data).then(r => r.data),
    onSuccess: (data) => setResult(data),
  });

  const createMandateMut = useMutation({
    mutationFn: (data: object) => api.post("/vente/mandates", data).then(r => r.data),
    onSuccess: () => { setResult(null); onMandateCreated(); },
  });

  function doEstimate() {
    estimateMut.mutate({
      address: form.address,
      city: form.city,
      surface_m2: parseFloat(form.surface_m2),
      nb_rooms: parseFloat(form.nb_rooms),
      year_built: form.year_built ? parseInt(form.year_built) : null,
      description: form.description || null,
      mandate_type: form.mandate_type,
    });
  }

  function createMandate() {
    createMandateMut.mutate({
      address: form.address,
      city: form.city,
      surface_m2: parseFloat(form.surface_m2),
      nb_rooms: parseFloat(form.nb_rooms),
      year_built: form.year_built ? parseInt(form.year_built) : null,
      description: form.description || null,
      mandate_type: form.mandate_type,
      ia_estimate: result?.estimate_mid,
      ia_estimate_report: result?.rapport,
    });
  }

  return (
    <div style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: 24 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: S.text }}>Estimation IA gratuite</h3>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: S.text3 }}>Obtenez une estimation en 30 secondes, sans engagement.</p>

      {/* Disclaimer */}
      <div style={{ display: "flex", gap: 8, padding: "10px 14px", backgroundColor: S.amberBg, border: `1px solid ${S.amber}`, borderRadius: 10, marginBottom: 20, fontSize: 12, color: S.amber }}>
        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{DISCLAIMER}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {[
          { key: "address",    label: "Adresse",         placeholder: "Rue de Rive 12",  col: "1/3" },
          { key: "city",       label: "Ville",           placeholder: "Genève" },
          { key: "surface_m2", label: "Surface (m²)",    placeholder: "85", type: "number" },
          { key: "nb_rooms",   label: "Nombre de pièces", placeholder: "3.5", type: "number" },
          { key: "year_built", label: "Année construction", placeholder: "1985", type: "number" },
        ].map(({ key, label, placeholder, type, col }) => (
          <div key={key} style={{ gridColumn: col ?? "auto" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: S.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
            <input
              type={type ?? "text"}
              value={(form as Record<string, string>)[key]}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              placeholder={placeholder}
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${S.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: S.surface2, color: S.text, outline: "none", boxSizing: "border-box" }}
            />
          </div>
        ))}
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: S.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Type de vente</label>
          <select value={form.mandate_type} onChange={e => setForm(p => ({ ...p, mandate_type: e.target.value }))}
            style={{ width: "100%", padding: "9px 12px", border: `1px solid ${S.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: S.surface2, color: S.text, outline: "none" }}>
            <option value="solo">Vente solo (upsells Althy)</option>
            <option value="agency">Via agence (referral fee)</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: S.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Description (optionnel)</label>
        <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          rows={2} placeholder="Rénové 2020, vue lac, parking inclus…"
          style={{ width: "100%", padding: "9px 12px", border: `1px solid ${S.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: S.surface2, color: S.text, outline: "none", resize: "vertical", boxSizing: "border-box" }}
        />
      </div>

      <button
        onClick={doEstimate}
        disabled={!form.address || !form.city || !form.surface_m2 || !form.nb_rooms || estimateMut.isPending}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", backgroundColor: S.orange, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: estimateMut.isPending ? "default" : "pointer", opacity: estimateMut.isPending ? 0.7 : 1 }}
      >
        {estimateMut.isPending ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <TrendingUp size={14} />}
        {estimateMut.isPending ? "Estimation en cours…" : "Estimer maintenant"}
      </button>

      {/* Result */}
      {result && (
        <div style={{ marginTop: 20, padding: 20, backgroundColor: S.greenBg, border: `1px solid ${S.green}`, borderRadius: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "Estimation basse",   value: fmt(result.estimate_low) },
              { label: "Estimation médiane", value: fmt(result.estimate_mid), highlight: true },
              { label: "Estimation haute",   value: fmt(result.estimate_high) },
            ].map(k => (
              <div key={k.label} style={{ textAlign: "center", padding: "12px 8px", backgroundColor: k.highlight ? S.green : "rgba(90,125,84,0.1)", borderRadius: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: k.highlight ? "#fff" : S.green }}>{k.value}</div>
                <div style={{ fontSize: 10.5, color: k.highlight ? "rgba(255,255,255,0.8)" : S.text3, marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {form.mandate_type === "agency" && (
            <div style={{ padding: "10px 14px", backgroundColor: S.orangeBg, border: `1px solid ${S.orange}`, borderRadius: 10, marginBottom: 14, fontSize: 12.5, color: S.text }}>
              <strong>Vente via agence :</strong> Commission typique 3–5% → CHF {fmt(result.estimate_mid * 0.04)} / Referral notaire : CHF 200–400 via Althy
            </div>
          )}
          {form.mandate_type === "solo" && (
            <div style={{ padding: "10px 14px", backgroundColor: S.orangeBg, border: `1px solid ${S.orange}`, borderRadius: 10, marginBottom: 14, fontSize: 12.5, color: S.text }}>
              <strong>Vente solo :</strong> Économisez ~CHF {fmt(result.estimate_mid * 0.04)} de commission · Althy gère dossier, annonces et visites
            </div>
          )}

          <button
            onClick={() => setShowReport(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: S.green, fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginBottom: showReport ? 10 : 0 }}
          >
            {showReport ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showReport ? "Masquer" : "Voir"} l&apos;analyse complète
          </button>
          {showReport && (
            <pre style={{ margin: 0, fontSize: 12, color: S.text2, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{result.rapport}</pre>
          )}

          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button
              onClick={createMandate}
              disabled={createMandateMut.isPending}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", backgroundColor: S.orange, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              <Plus size={14} /> Créer le mandat
            </button>
            <button onClick={() => setResult(null)} style={{ padding: "10px 18px", border: `1px solid ${S.border}`, borderRadius: 10, backgroundColor: "transparent", color: S.text3, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Recommencer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Offer modal ───────────────────────────────────────────────────────────────

function AddOfferModal({ mandateId, askingPrice, onClose }: { mandateId: string; askingPrice: number | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ buyer_name: "", buyer_email: "", buyer_phone: "", offer_price: "", message: "" });

  const mutation = useMutation({
    mutationFn: (data: object) => api.post(`/vente/mandates/${mandateId}/offers`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mandate", mandateId] }); onClose(); },
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ backgroundColor: S.surface, borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: S.text }}>Enregistrer une offre</h2>
        {askingPrice && <p style={{ margin: "0 0 20px", fontSize: 13, color: S.text3 }}>Prix demandé : {fmt(askingPrice)}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { key: "buyer_name",  label: "Nom acheteur",  placeholder: "Jean Dupont" },
            { key: "buyer_email", label: "Email",          placeholder: "acheteur@email.ch" },
            { key: "buyer_phone", label: "Téléphone",      placeholder: "+41 79 000 00 00" },
            { key: "offer_price", label: "Montant de l'offre (CHF)", placeholder: "750000", type: "number" },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: S.text3, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
              <input type={type ?? "text"} value={(f as Record<string, string>)[key]} onChange={e => setF(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${S.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: S.surface2, color: S.text, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          ))}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: S.text3, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Message (optionnel)</label>
            <textarea value={f.message} onChange={e => setF(p => ({ ...p, message: e.target.value }))} rows={2}
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${S.border}`, borderRadius: 9, fontSize: 13, backgroundColor: S.surface2, color: S.text, outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", border: `1px solid ${S.border}`, borderRadius: 9, backgroundColor: "transparent", color: S.text2, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
          <button
            disabled={!f.offer_price || mutation.isPending}
            onClick={() => mutation.mutate({ buyer_name: f.buyer_name || null, buyer_email: f.buyer_email || null, buyer_phone: f.buyer_phone || null, offer_price: parseFloat(f.offer_price), message: f.message || null })}
            style={{ flex: 2, padding: "10px 0", border: "none", borderRadius: 9, backgroundColor: S.orange, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {mutation.isPending ? "Enregistrement…" : "Enregistrer l'offre"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mandate detail ────────────────────────────────────────────────────────────

function MandateDetail({ mandateId, onBack }: { mandateId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [showAddOffer, setShowAddOffer] = useState(false);
  const [counterPrice, setCounterPrice] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["mandate", mandateId],
    queryFn: () => api.get<{ mandate: Mandate; offers: Offer[]; disclaimer: string }>(`/vente/mandates/${mandateId}`).then(r => r.data),
  });

  const actionMut = useMutation({
    mutationFn: ({ offerId, action, counter_price }: { offerId: string; action: string; counter_price?: number }) =>
      api.post(`/vente/mandates/${mandateId}/offers/${offerId}/action`, { action, counter_price }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mandate", mandateId] }),
  });

  const soldMut = useMutation({
    mutationFn: (sale_price_final: number) =>
      api.post(`/vente/mandates/${mandateId}/sold`, { sale_price_final, notary_referral_fee: 300 }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mandate", mandateId] }); qc.invalidateQueries({ queryKey: ["mandates"] }); },
  });

  if (isLoading || !data) return <div style={{ padding: 40, textAlign: "center", color: S.text3 }}>Chargement…</div>;

  const { mandate, offers } = data;
  const sc = STATUS_CFG[mandate.status] ?? STATUS_CFG.actif;

  return (
    <div>
      {showAddOffer && <AddOfferModal mandateId={mandateId} askingPrice={mandate.asking_price} onClose={() => setShowAddOffer(false)} />}

      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: S.text3, fontSize: 13, cursor: "pointer", marginBottom: 20 }}>← Retour</button>

      {/* Mandate header */}
      <div style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: S.text }}>{mandate.address}, {mandate.city}</span>
              <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 600, backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
            </div>
            <div style={{ fontSize: 13, color: S.text3 }}>{mandate.surface_m2} m² · {mandate.nb_rooms} pièces{mandate.year_built ? ` · ${mandate.year_built}` : ""} · {mandate.mandate_type === "solo" ? "Vente solo" : "Via agence"}</div>
          </div>
          {mandate.status === "actif" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowAddOffer(true)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", backgroundColor: S.orange, color: "#fff", border: "none", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                <Plus size={13} /> Offre
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { label: "Prix demandé",    value: fmt(mandate.asking_price) },
            { label: "Estimation IA",   value: fmt(mandate.ia_estimate) },
            { label: "Écart",           value: mandate.asking_price && mandate.ia_estimate ? fmt(mandate.asking_price - mandate.ia_estimate) : "—" },
          ].map(k => (
            <div key={k.label} style={{ padding: "10px 14px", backgroundColor: S.surface2, borderRadius: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: S.text }}>{k.value}</div>
              <div style={{ fontSize: 11, color: S.text3, marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {mandate.ia_estimate_report && (
          <details style={{ marginTop: 14 }}>
            <summary style={{ fontSize: 12.5, color: S.orange, cursor: "pointer", fontWeight: 600 }}>Rapport IA complet</summary>
            <pre style={{ margin: "8px 0 0", fontSize: 11.5, color: S.text3, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{mandate.ia_estimate_report}</pre>
          </details>
        )}
      </div>

      {/* Offers */}
      <div style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${S.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: S.text }}>Offres reçues ({offers.length})</h3>
          {mandate.status === "offre" && (
            <button
              onClick={() => { const accepted = offers.find(o => o.status === "accepte"); if (accepted) soldMut.mutate(accepted.offer_price); }}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", backgroundColor: S.greenBg, color: S.green, border: `1px solid ${S.green}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
            >
              <CheckCircle size={13} /> Finaliser la vente
            </button>
          )}
        </div>
        {offers.length === 0 ? (
          <div style={{ padding: "30px 22px", textAlign: "center", color: S.text3, fontSize: 13 }}>Aucune offre enregistrée pour l&apos;instant</div>
        ) : (
          <div>
            {offers.map(o => {
              const oc = OFFER_CFG[o.status] ?? OFFER_CFG.recu;
              return (
                <div key={o.id} style={{ padding: "16px 22px", borderBottom: `1px solid ${S.border}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: S.text }}>{fmt(o.offer_price)}</span>
                        <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 600, backgroundColor: `${oc.color}20`, color: oc.color }}>{oc.label}</span>
                      </div>
                      {o.buyer_name && <div style={{ fontSize: 12.5, color: S.text3 }}>👤 {o.buyer_name}{o.buyer_email ? ` · ${o.buyer_email}` : ""}{o.buyer_phone ? ` · ${o.buyer_phone}` : ""}</div>}
                      {o.message && <div style={{ fontSize: 12, color: S.text3, marginTop: 4, fontStyle: "italic" }}>{o.message}</div>}
                      {o.counter_offer_price && <div style={{ fontSize: 12.5, color: S.amber, marginTop: 4 }}>Contre-offre : {fmt(o.counter_offer_price)}</div>}
                    </div>
                    {o.status === "recu" && (
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => actionMut.mutate({ offerId: o.id, action: "accept" })} style={{ padding: "6px 12px", backgroundColor: S.greenBg, color: S.green, border: `1px solid ${S.green}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Accepter</button>
                        <button onClick={() => actionMut.mutate({ offerId: o.id, action: "refuse" })} style={{ padding: "6px 12px", backgroundColor: S.redBg, color: S.red, border: `1px solid ${S.red}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Refuser</button>
                        <div style={{ display: "flex", gap: 4 }}>
                          <input
                            type="number"
                            value={counterPrice[o.id] ?? ""}
                            onChange={e => setCounterPrice(p => ({ ...p, [o.id]: e.target.value }))}
                            placeholder="Contre-offre CHF"
                            style={{ width: 130, padding: "6px 10px", border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 12, backgroundColor: S.surface2, color: S.text, outline: "none" }}
                          />
                          <button
                            disabled={!counterPrice[o.id]}
                            onClick={() => actionMut.mutate({ offerId: o.id, action: "counter", counter_price: parseFloat(counterPrice[o.id]) })}
                            style={{ padding: "6px 10px", backgroundColor: S.amberBg, color: S.amber, border: `1px solid ${S.amber}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >↩</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notary referral info */}
      <div style={{ marginTop: 16, padding: "12px 16px", backgroundColor: S.surface2, borderRadius: 12, fontSize: 12.5, color: S.text3 }}>
        <FileText size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
        Referral notaire CHF 200–400 enregistré automatiquement à la finalisation de la vente.
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VentePage() {
  const [selectedMandateId, setSelectedMandateId] = useState<string | null>(null);
  const [showEstimate, setShowEstimate] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["mandates"],
    queryFn: () => api.get<{ items: Mandate[] }>("/vente/mandates").then(r => r.data),
  });

  const mandates = data?.items ?? [];

  if (selectedMandateId) {
    return (
      <div style={{ padding: "28px 24px", maxWidth: 900, margin: "0 auto" }}>
        <MandateDetail mandateId={selectedMandateId} onBack={() => setSelectedMandateId(null)} />
      </div>
    );
  }

  const activeCount  = mandates.filter(m => m.status === "actif").length;
  const offerCount   = mandates.filter(m => m.status === "offre").length;
  const soldCount    = mandates.filter(m => m.status === "vendu").length;
  const totalVolume  = mandates.filter(m => m.sale_price_final).reduce((a, m) => a + (m.sale_price_final ?? 0), 0);

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: S.text, letterSpacing: "-0.02em" }}>Vente immobilière</h1>
          <p style={{ margin: 0, color: S.text3, fontSize: 13.5 }}>Estimation IA · Mandats · Offres · Référence notaire</p>
        </div>
        <button
          onClick={() => setShowEstimate(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", backgroundColor: S.orange, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
        >
          <Plus size={15} /> Nouveau mandat
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Mandats actifs",   value: activeCount,         color: S.orange },
          { label: "Offres en cours",  value: offerCount,          color: S.amber  },
          { label: "Biens vendus",     value: soldCount,           color: S.green  },
          { label: "Volume total",     value: fmt(totalVolume),    color: S.text   },
        ].map(k => (
          <div key={k.label} style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: S.text3, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Estimate panel */}
      {showEstimate && (
        <div style={{ marginBottom: 28 }}>
          <EstimatePanel onMandateCreated={() => { setShowEstimate(false); qc.invalidateQueries({ queryKey: ["mandates"] }); }} />
        </div>
      )}

      {/* Mandates list */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60, color: S.text3 }}>Chargement…</div>
      ) : mandates.length === 0 && !showEstimate ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏡</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: S.text }}>Aucun mandat de vente</h3>
          <p style={{ color: S.text3, fontSize: 13, margin: "0 0 20px" }}>Commencez par obtenir une estimation IA gratuite pour votre bien.</p>
          <button onClick={() => setShowEstimate(true)} style={{ padding: "10px 24px", backgroundColor: S.orange, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            Estimer mon bien
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mandates.map(m => {
            const sc = STATUS_CFG[m.status] ?? STATUS_CFG.actif;
            const delta = m.asking_price && m.ia_estimate ? ((m.asking_price - m.ia_estimate) / m.ia_estimate * 100) : null;
            return (
              <div
                key={m.id}
                onClick={() => setSelectedMandateId(m.id)}
                style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: "16px 20px", cursor: "pointer", boxShadow: S.shadow, transition: "box-shadow 0.15s" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Home size={14} color={S.text3} />
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: S.text }}>{m.address}, {m.city}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 600, backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                      {m.mandate_type === "agency" && (
                        <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 600, backgroundColor: S.surface2, color: S.text3 }}>
                          <Users size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />Via agence
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12.5, color: S.text3 }}>
                      {m.surface_m2} m² · {m.nb_rooms} pièces{m.year_built ? ` · ${m.year_built}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: S.text }}>{fmt(m.asking_price ?? m.ia_estimate)}</div>
                    {delta !== null && (
                      <div style={{ fontSize: 11.5, color: Math.abs(delta) > 10 ? S.amber : S.text3 }}>
                        {delta > 0 ? "+" : ""}{delta.toFixed(1)}% vs estimation IA
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
