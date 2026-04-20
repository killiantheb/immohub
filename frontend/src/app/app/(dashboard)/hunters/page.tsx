"use client";

import { useState } from "react";
import { Plus, MapPin, Phone, Mail, TrendingUp, Clock, Globe, Eye, EyeOff } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";


const STATUS_CFG = {
  new:          { label: "Nouveau",          color: C.orange, bg: C.orangeBg },
  contacted:    { label: "Contacté",          color: C.amber,  bg: C.amberBg  },
  under_offer:  { label: "Offre en cours",    color: "var(--althy-blue)", bg: "var(--althy-blue-bg)" },
  closed:       { label: "Transaction faite", color: C.green,  bg: C.greenBg  },
  lost:         { label: "Perdu",             color: C.text3,  bg: C.surface2 },
};

interface Hunter {
  id: string;
  address: string;
  city: string;
  description: string | null;
  estimated_price: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: keyof typeof STATUS_CFG;
  referral_amount: number | null;
  referral_paid: boolean;
  off_market_visible: boolean;
  referral_type: string | null;
  created_at: string;
}

interface OffMarketLead {
  id: string;
  address: string;
  city: string;
  description: string | null;
  estimated_price: number | null;
  referral_amount: number | null;
  referral_type: string | null;
  status: string;
  created_at: string;
  contact_name: string | null;
  contact_phone: string | null;
}

function fmt(n: number | null) {
  if (!n) return "—";
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n);
}

function NewHunterModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ address: "", city: "", description: "", estimated_price: "", contact_name: "", contact_phone: "", contact_email: "", referral_amount: "" });

  const mutation = useMutation({
    mutationFn: (data: object) => api.post("/hunters", data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hunters"] }); onClose(); },
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ backgroundColor: C.surface, borderRadius: 20, padding: 28, width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: C.text }}>Soumettre un lead off-market</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: C.text3 }}>Gagnez CHF 50–500 si la transaction aboutit.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { key: "address",    label: "Adresse du bien",     placeholder: "Rue de Rive 12" },
            { key: "city",       label: "Ville",               placeholder: "Genève" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
              <input value={(f as Record<string,string>)[key]} onChange={e => setF(p => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: C.surface2, color: C.text, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Prix estimé (CHF)</label>
              <input type="number" value={f.estimated_price} onChange={e => setF(p => ({ ...p, estimated_price: e.target.value }))}
                placeholder="800 000"
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: C.surface2, color: C.text, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Referral fee demandé (CHF)</label>
              <input type="number" value={f.referral_amount} onChange={e => setF(p => ({ ...p, referral_amount: e.target.value }))}
                placeholder="250"
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: C.surface2, color: C.text, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</label>
            <textarea value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))}
              rows={3} placeholder="Appartement 4 pièces, propriétaire souhaite vendre discrètement, pas encore sur le marché…"
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: C.surface2, color: C.text, outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ padding: "14px 16px", backgroundColor: C.surface2, borderRadius: 10 }}>
            <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: C.text2 }}>Contact du vendeur (optionnel)</p>
            {[
              { key: "contact_name",  placeholder: "Jean Dupont",    icon: "👤" },
              { key: "contact_phone", placeholder: "+41 79 123 45 67", icon: "📞" },
              { key: "contact_email", placeholder: "vendeur@email.ch", icon: "✉️" },
            ].map(({ key, placeholder, icon }) => (
              <input key={key} value={(f as Record<string,string>)[key]} onChange={e => setF(p => ({ ...p, [key]: e.target.value }))}
                placeholder={`${icon}  ${placeholder}`}
                style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, backgroundColor: C.surface, color: C.text, outline: "none", marginBottom: 6, boxSizing: "border-box" }}
              />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", border: `1px solid ${C.border}`, borderRadius: 9, backgroundColor: "transparent", color: C.text2, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
          <button
            disabled={!f.address || !f.city || mutation.isPending}
            onClick={() => mutation.mutate({ address: f.address, city: f.city, description: f.description || null, estimated_price: f.estimated_price ? parseFloat(f.estimated_price) : null, contact_name: f.contact_name || null, contact_phone: f.contact_phone || null, contact_email: f.contact_email || null, referral_amount: f.referral_amount ? parseFloat(f.referral_amount) : null })}
            style={{ flex: 2, padding: "10px 0", border: "none", borderRadius: 9, backgroundColor: C.orange, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {mutation.isPending ? "Envoi…" : "Soumettre le lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HuntersPage() {
  const [showNew, setShowNew] = useState(false);
  const [tab, setTab] = useState<"mes-leads" | "off-market">("mes-leads");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["hunters"],
    queryFn: () => api.get<{ items: Hunter[] }>("/hunters").then(r => r.data),
  });

  const { data: offMarketData, isLoading: loadingOM } = useQuery({
    queryKey: ["hunters-off-market"],
    queryFn: () => api.get<{ items: OffMarketLead[]; total: number }>("/hunters/off-market").then(r => r.data),
    enabled: tab === "off-market",
  });

  const publishMut = useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      api.post(`/hunters/${id}/publish`, { visible, referral_type: "vente" }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hunters"] }),
  });

  const items = data?.items ?? [];
  const omItems = offMarketData?.items ?? [];
  const earned = items.filter(h => h.referral_paid).reduce((a, h) => a + (h.referral_amount ?? 0), 0);
  const pending = items.filter(h => !h.referral_paid && h.status === "closed").reduce((a, h) => a + (h.referral_amount ?? 0), 0);

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1000, margin: "0 auto" }}>
      {showNew && <NewHunterModal onClose={() => setShowNew(false)} />}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>Hunters — Leads off-market</h1>
          <p style={{ margin: 0, color: C.text3, fontSize: 13.5 }}>Soumettez des biens pas encore sur le marché. Gagnez CHF 50–500 si la transaction aboutit.</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", backgroundColor: C.orange, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
          <Plus size={15} /> Soumettre un lead
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Leads soumis",   value: items.length, color: C.text },
          { label: "En cours",       value: items.filter(h => ["new","contacted","under_offer"].includes(h.status)).length, color: C.orange },
          { label: "Gagné (payé)",   value: fmt(earned), color: C.green },
          { label: "En attente",     value: fmt(pending), color: C.amber },
        ].map(k => (
          <div key={k.label} style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        {([
          { id: "mes-leads",  label: "Mes leads",             icon: <TrendingUp size={13} /> },
          { id: "off-market", label: "Marché off-market",     icon: <Globe size={13} /> },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? C.orange : "transparent"}`, color: tab === t.id ? C.orange : C.text3, fontWeight: tab === t.id ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === "off-market" ? (
        /* ── Off-market marketplace ── */
        <div>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: C.text3 }}>Leads off-market publiés par les hunters — visibles aux agents premium. Contactez le hunter pour obtenir les coordonnées vendeur.</p>
          {loadingOM ? (
            <div style={{ textAlign: "center", padding: 40, color: C.text3 }}>Chargement…</div>
          ) : omItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px 20px", backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, color: C.text3, fontSize: 13 }}>
              Aucun lead off-market publié pour l&apos;instant
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {omItems.map(h => (
                <div key={h.id} style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px", boxShadow: C.shadow }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <MapPin size={13} color={C.text3} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{h.address}, {h.city}</span>
                        <span style={{ padding: "2px 7px", borderRadius: 20, fontSize: 10, fontWeight: 600, backgroundColor: h.referral_type === "location" ? C.surface2 : C.orangeBg, color: h.referral_type === "location" ? C.text3 : C.orange }}>
                          {h.referral_type === "location" ? "Location" : "Vente"}
                        </span>
                      </div>
                      {h.description && <p style={{ margin: "0 0 8px", fontSize: 12.5, color: C.text3, lineHeight: 1.5 }}>{h.description}</p>}
                      {h.estimated_price && <span style={{ fontSize: 12.5, color: C.text2 }}>Estimé : <strong>{fmt(h.estimated_price)}</strong></span>}
                      {h.contact_name && <div style={{ fontSize: 12, color: C.green, marginTop: 4 }}>👤 {h.contact_name}{h.contact_phone ? ` · ${h.contact_phone}` : ""}</div>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: C.orange }}>{fmt(h.referral_amount)}</div>
                      <div style={{ fontSize: 11, color: C.text3 }}>Referral fee</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
      /* ── Mes leads ── */
      <>
      {/* Info banner */}
      <div style={{ backgroundColor: C.orangeBg, border: "1px solid rgba(15,46,76,0.22)", borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", gap: 10 }}>
        <TrendingUp size={18} color={C.orange} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: C.text }}>Comment ça marche</p>
          <p style={{ margin: 0, fontSize: 12.5, color: C.text3 }}>Vous connaissez un bien pas encore sur le marché ? Soumettez l'adresse + contact. Si Althy conclut la transaction, vous touchez automatiquement CHF 50–500 via Stripe. Aucune licence requise.</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60, color: C.text3 }}>Chargement…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏹</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: C.text }}>Aucun lead soumis</h3>
          <p style={{ color: C.text3, fontSize: 13, margin: "0 0 20px" }}>Vous connaissez un propriétaire qui veut vendre discrètement ? Soumettez le lead et gagnez jusqu'à CHF 500.</p>
          <button onClick={() => setShowNew(true)} style={{ padding: "10px 24px", backgroundColor: C.orange, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            Soumettre mon premier lead
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(h => {
            const sc = STATUS_CFG[h.status] ?? STATUS_CFG.new;
            return (
              <div key={h.id} style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px", boxShadow: C.shadow }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <MapPin size={14} color={C.text3} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{h.address}, {h.city}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 600, backgroundColor: sc.bg, color: sc.color }}>{sc.label}</span>
                    </div>
                    {h.description && <p style={{ margin: "0 0 8px", fontSize: 12.5, color: C.text3, lineHeight: 1.5 }}>{h.description}</p>}
                    <div style={{ display: "flex", gap: 14, fontSize: 12.5 }}>
                      {h.estimated_price && <span style={{ color: C.text2 }}>Estimé : <strong style={{ color: C.text }}>{fmt(h.estimated_price)}</strong></span>}
                      {h.contact_name && <span style={{ color: C.text3, display: "flex", alignItems: "center", gap: 4 }}>👤 {h.contact_name}</span>}
                      {h.contact_phone && <span style={{ color: C.text3, display: "flex", alignItems: "center", gap: 4 }}><Phone size={11} /> {h.contact_phone}</span>}
                      <span style={{ color: C.text3, display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={11} /> {new Date(h.created_at).toLocaleDateString("fr-CH")}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: h.referral_paid ? C.green : C.orange }}>{fmt(h.referral_amount)}</div>
                    <div style={{ fontSize: 11, color: h.referral_paid ? C.green : C.text3 }}>{h.referral_paid ? "Payé ✓" : "Referral fee"}</div>
                    <button
                      onClick={e => { e.stopPropagation(); publishMut.mutate({ id: h.id, visible: !h.off_market_visible }); }}
                      style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", border: `1px solid ${h.off_market_visible ? C.green : C.border}`, borderRadius: 8, backgroundColor: h.off_market_visible ? C.greenBg : "transparent", color: h.off_market_visible ? C.green : C.text3, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                    >
                      {h.off_market_visible ? <Eye size={11} /> : <EyeOff size={11} />}
                      {h.off_market_visible ? "Publié" : "Publier"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}
    </div>
  );
}
