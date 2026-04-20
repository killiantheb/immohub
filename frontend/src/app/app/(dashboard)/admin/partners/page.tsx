"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  Briefcase,
  DollarSign,
  Loader2,
  PlusCircle,
  Send,
  TrendingUp,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";

type Vertical = "insurance" | "caution" | "mortgage" | "moving" | "energy" | "telecom" | "other";
type PartnerStatus = "active" | "paused" | "terminated";
type DealType = "affiliation" | "exclusive_with_minimum" | "strategic" | "revenue_share";
type LeadStatus = "sent" | "qualified" | "signed" | "rejected" | "expired";

type Partner = {
  id: string;
  name: string;
  vertical: Vertical;
  country: string;
  region: string | null;
  website: string | null;
  api_base_url: string | null;
  has_api_key: boolean;
  status: PartnerStatus;
  contact_person: string | null;
  contact_email: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  exclusivity_region: string | null;
  created_at: string;
};

type PartnerLead = {
  id: string;
  partner_id: string;
  user_id: string | null;
  vertical: string;
  lead_data: Record<string, unknown>;
  status: LeadStatus;
  sent_at: string | null;
  qualified_at: string | null;
  signed_at: string | null;
  commission_amount: string | null;
  commission_paid_at: string | null;
  external_reference: string | null;
  consent_id: string | null;
  notes: string | null;
};

type PartnerStats = {
  partner_id: string;
  leads_this_month: number;
  qualified_this_month: number;
  signed_this_month: number;
  conversion_rate: number;
  pending_commission: string;
  volume_6m: { period: string; leads: number }[];
};

type Commission = {
  id: string;
  partner_id: string;
  period_start: string;
  period_end: string;
  total_leads: number;
  total_signed: number;
  minimum_guarantee_amount: string | null;
  variable_commission_amount: string | null;
  total_amount: string | null;
  invoice_sent_at: string | null;
  paid_at: string | null;
};

const VERTICAL_LABELS: Record<Vertical, string> = {
  insurance: "Assurance",
  caution: "Caution",
  mortgage: "Hypothèque",
  moving: "Déménagement",
  energy: "Énergie",
  telecom: "Telecom",
  other: "Autre",
};

const STATUS_LABELS: Record<PartnerStatus, string> = {
  active: "Actif",
  paused: "Pausé",
  terminated: "Terminé",
};

const LEAD_LABELS: Record<LeadStatus, string> = {
  sent: "Envoyé",
  qualified: "Qualifié",
  signed: "Signé",
  rejected: "Rejeté",
  expired: "Expiré",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtChf(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (Number.isNaN(n)) return "—";
  return `CHF ${n.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = "partners" | "leads" | "commissions";

export default function AdminPartnersPage() {
  const [tab, setTab] = useState<Tab>("partners");
  const [createOpen, setCreateOpen] = useState(false);

  const partnersQ = useQuery({
    queryKey: ["admin-partners"],
    queryFn: async (): Promise<Partner[]> => (await api.get("/partners")).data,
  });

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
      <Link
        href="/app/admin"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: C.text3, textDecoration: "none", marginBottom: 16 }}
      >
        <ArrowLeft size={14} /> Admin
      </Link>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 400, color: C.text, margin: 0 }}>
          Partenariats
        </h1>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: C.prussian, color: "#fff", border: "none",
            fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          <PlusCircle size={14} /> Nouveau partenaire
        </button>
      </div>
      <p style={{ color: C.textMuted, fontSize: 14, margin: "0 0 20px" }}>
        6 verticales : assurance · caution · hypothèque · déménagement · énergie · telecom.
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        <TabBtn active={tab === "partners"} onClick={() => setTab("partners")} icon={<Briefcase size={14} />} label="Partenaires" />
        <TabBtn active={tab === "leads"} onClick={() => setTab("leads")} icon={<Users size={14} />} label="Leads" />
        <TabBtn active={tab === "commissions"} onClick={() => setTab("commissions")} icon={<DollarSign size={14} />} label="Commissions" />
      </div>

      {tab === "partners" && (
        <PartnersTab partners={partnersQ.data ?? []} isLoading={partnersQ.isLoading} />
      )}
      {tab === "leads" && (
        <LeadsTab partners={partnersQ.data ?? []} />
      )}
      {tab === "commissions" && (
        <CommissionsTab partners={partnersQ.data ?? []} />
      )}

      {createOpen && <CreatePartnerModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

// ── Tab buttons ──────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "10px 16px",
        background: "transparent", border: "none",
        borderBottom: `2px solid ${active ? C.prussian : "transparent"}`,
        color: active ? C.prussian : C.text2,
        fontSize: 14, fontWeight: active ? 600 : 500,
        cursor: "pointer", marginBottom: -1,
      }}
    >
      {icon} {label}
    </button>
  );
}

// ── Partners tab ─────────────────────────────────────────────────────────────

function PartnersTab({ partners, isLoading }: { partners: Partner[]; isLoading: boolean }) {
  if (isLoading) {
    return <EmptyRow label="Chargement…" />;
  }
  if (partners.length === 0) {
    return <EmptyRow label="Aucun partenaire. Commencer par La Mobilière (assurance) ou SwissCaution." />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {partners.map(p => <PartnerCard key={p.id} partner={p} />)}
    </div>
  );
}

function PartnerCard({ partner }: { partner: Partner }) {
  const statsQ = useQuery({
    queryKey: ["admin-partner-stats", partner.id],
    queryFn: async (): Promise<PartnerStats> => (await api.get(`/partners/${partner.id}/stats`)).data,
  });
  const stats = statsQ.data;

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
      padding: 20,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 500, color: C.text }}>
              {partner.name}
            </span>
            <VerticalBadge vertical={partner.vertical} />
            <StatusPill status={partner.status} />
          </div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>
            {partner.region ?? "National"} · {partner.contact_email ?? "pas de contact renseigné"}
            {partner.has_api_key && <span style={{ marginLeft: 8, color: C.green }}>• API configurée</span>}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        <Kpi label="Leads ce mois" value={stats?.leads_this_month} icon={<Users size={12} />} />
        <Kpi label="Signés" value={stats?.signed_this_month} />
        <Kpi
          label="Conversion"
          value={stats ? `${Math.round(stats.conversion_rate * 100)}%` : undefined}
          icon={<TrendingUp size={12} />}
        />
        <Kpi label="Commission due" value={stats ? fmtChf(stats.pending_commission) : undefined} icon={<DollarSign size={12} />} accent={C.gold} />
      </div>

      {/* Mini graphique 6 mois */}
      {stats && stats.volume_6m.length > 0 && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60, padding: "0 4px", marginBottom: 6 }}>
          {stats.volume_6m.map(b => {
            const max = Math.max(1, ...stats.volume_6m.map(x => x.leads));
            const h = (b.leads / max) * 100;
            return (
              <div key={b.period} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div
                  title={`${b.period} — ${b.leads} leads`}
                  style={{
                    width: "100%", height: `${Math.max(2, h)}%`,
                    background: C.prussianBg, border: `1px solid ${C.prussianBorder}`,
                    borderRadius: 4,
                  }}
                />
                <span style={{ fontSize: 10, color: C.textMuted }}>{b.period.slice(5)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, icon, accent }: { label: string; value: string | number | undefined; icon?: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: C.surface2, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: C.textMuted, display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent ?? C.text, fontFamily: "var(--font-serif)" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function VerticalBadge({ vertical }: { vertical: Vertical }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em",
      padding: "2px 8px", borderRadius: 999,
      background: C.prussianBg, color: C.prussian,
    }}>
      {VERTICAL_LABELS[vertical]}
    </span>
  );
}

function StatusPill({ status }: { status: PartnerStatus }) {
  const palette: Record<PartnerStatus, { bg: string; fg: string }> = {
    active:     { bg: C.greenBg, fg: C.green },
    paused:     { bg: C.amberBg, fg: C.amber },
    terminated: { bg: C.redBg,   fg: C.red },
  };
  const p = palette[status];
  return (
    <span style={{
      fontSize: 11, fontWeight: 500,
      padding: "2px 8px", borderRadius: 999,
      background: p.bg, color: p.fg,
    }}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div style={{ background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 12, padding: 32, textAlign: "center", color: C.textMuted, fontSize: 14 }}>
      {label}
    </div>
  );
}

// ── Leads tab ────────────────────────────────────────────────────────────────

function LeadsTab({ partners }: { partners: Partner[] }) {
  const qc = useQueryClient();
  const [partnerId, setPartnerId] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const leadsQ = useQuery({
    queryKey: ["admin-partner-leads", partnerId, status],
    queryFn: async (): Promise<PartnerLead[]> =>
      (await api.get("/partners/leads", {
        params: {
          partner_id: partnerId || undefined,
          status: status || undefined,
          limit: 200,
        },
      })).data,
  });

  const updateMut = useMutation({
    mutationFn: async (args: { id: string; status: LeadStatus; commission_amount?: number }) =>
      (await api.patch(`/partners/leads/${args.id}`, {
        status: args.status,
        commission_amount: args.commission_amount,
      })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-partner-leads"] }),
  });

  const partnerById = useMemo(() => Object.fromEntries(partners.map(p => [p.id, p])), [partners]);

  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={partnerId} onChange={e => setPartnerId(e.target.value)} style={selectStyle}>
          <option value="">Tous les partenaires</option>
          {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
          <option value="">Tous les statuts</option>
          {Object.entries(LEAD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div style={{ marginLeft: "auto", color: C.textMuted, fontSize: 13, alignSelf: "center" }}>
          {leadsQ.data ? `${leadsQ.data.length} lead${leadsQ.data.length > 1 ? "s" : ""}` : null}
        </div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.surface2, color: C.text2 }}>
              <Th>Date</Th>
              <Th>Partenaire</Th>
              <Th>Verticale</Th>
              <Th>Statut</Th>
              <Th>Commission</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {leadsQ.isLoading && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: C.textMuted }}>
                <Loader2 size={14} className="animate-spin" /> Chargement…
              </td></tr>
            )}
            {!leadsQ.isLoading && (leadsQ.data?.length ?? 0) === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: C.textMuted }}>
                Aucun lead.
              </td></tr>
            )}
            {leadsQ.data?.map(lead => (
              <tr key={lead.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <Td>{fmtDate(lead.sent_at)}</Td>
                <Td><span style={{ color: C.text }}>{partnerById[lead.partner_id]?.name ?? lead.partner_id.slice(0, 8)}</span></Td>
                <Td>{VERTICAL_LABELS[lead.vertical as Vertical] ?? lead.vertical}</Td>
                <Td><LeadBadge status={lead.status} /></Td>
                <Td>{fmtChf(lead.commission_amount)}</Td>
                <Td>
                  <div style={{ display: "inline-flex", gap: 4 }}>
                    {lead.status === "sent" && (
                      <button onClick={() => updateMut.mutate({ id: lead.id, status: "qualified" })} style={actionBtn}>
                        Qualifier
                      </button>
                    )}
                    {(lead.status === "sent" || lead.status === "qualified") && (
                      <button onClick={() => updateMut.mutate({ id: lead.id, status: "signed" })} style={actionBtn}>
                        Signé
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LeadBadge({ status }: { status: LeadStatus }) {
  const palette: Record<LeadStatus, { bg: string; fg: string }> = {
    sent:      { bg: C.blueBg,   fg: C.blue },
    qualified: { bg: C.amberBg,  fg: C.amber },
    signed:    { bg: C.greenBg,  fg: C.green },
    rejected:  { bg: C.redBg,    fg: C.red },
    expired:   { bg: C.surface2, fg: C.textMuted },
  };
  const p = palette[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: p.bg, color: p.fg }}>
      {LEAD_LABELS[status]}
    </span>
  );
}

// ── Commissions tab ──────────────────────────────────────────────────────────

function CommissionsTab({ partners }: { partners: Partner[] }) {
  const qc = useQueryClient();
  const [partnerId, setPartnerId] = useState<string>(partners[0]?.id ?? "");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);

  const commsQ = useQuery({
    queryKey: ["admin-partner-commissions", partnerId],
    queryFn: async (): Promise<Commission[]> =>
      partnerId ? (await api.get(`/partners/${partnerId}/commissions`)).data : [],
    enabled: !!partnerId,
  });

  const computeMut = useMutation({
    mutationFn: async () => (await api.post(`/partners/${partnerId}/commissions`, { year, month })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-partner-commissions", partnerId] }),
  });

  const markInvoicedMut = useMutation({
    mutationFn: async (id: string) => (await api.post(`/partners/commissions/${id}/mark-invoiced`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-partner-commissions", partnerId] }),
  });

  const markPaidMut = useMutation({
    mutationFn: async (id: string) => (await api.post(`/partners/commissions/${id}/mark-paid`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-partner-commissions", partnerId] }),
  });

  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select value={partnerId} onChange={e => setPartnerId(e.target.value)} style={selectStyle}>
          <option value="" disabled>Sélectionner un partenaire</option>
          {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span style={{ color: C.textMuted, fontSize: 13 }}>Calculer :</span>
        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} min={2024} max={2100} style={{ ...selectStyle, width: 80 }} />
        <input type="number" value={month} onChange={e => setMonth(Number(e.target.value))} min={1} max={12} style={{ ...selectStyle, width: 60 }} />
        <button
          onClick={() => computeMut.mutate()}
          disabled={!partnerId || computeMut.isPending}
          style={{
            padding: "8px 14px", borderRadius: 8, border: "none",
            background: C.prussian, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}
        >
          {computeMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <BarChart3 size={13} />}
          Recalculer
        </button>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.surface2, color: C.text2 }}>
              <Th>Période</Th>
              <Th>Leads</Th>
              <Th>Signés</Th>
              <Th>Minimum garanti</Th>
              <Th>Variable</Th>
              <Th>Total</Th>
              <Th>Facturée</Th>
              <Th>Payée</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {!partnerId && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: C.textMuted }}>
                Sélectionner un partenaire.
              </td></tr>
            )}
            {partnerId && commsQ.isLoading && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: C.textMuted }}>
                <Loader2 size={14} className="animate-spin" /> Chargement…
              </td></tr>
            )}
            {commsQ.data?.map(c => (
              <tr key={c.id} style={{ borderTop: `1px solid ${C.border}` }}>
                <Td>{fmtDate(c.period_start)} → {fmtDate(c.period_end)}</Td>
                <Td>{c.total_leads}</Td>
                <Td>{c.total_signed}</Td>
                <Td>{fmtChf(c.minimum_guarantee_amount)}</Td>
                <Td>{fmtChf(c.variable_commission_amount)}</Td>
                <Td><strong style={{ color: C.text }}>{fmtChf(c.total_amount)}</strong></Td>
                <Td>{c.invoice_sent_at ? fmtDate(c.invoice_sent_at) : <span style={{ color: C.textMuted }}>—</span>}</Td>
                <Td>{c.paid_at ? <span style={{ color: C.green }}>{fmtDate(c.paid_at)}</span> : <span style={{ color: C.textMuted }}>—</span>}</Td>
                <Td>
                  <div style={{ display: "inline-flex", gap: 4 }}>
                    {!c.invoice_sent_at && (
                      <button onClick={() => markInvoicedMut.mutate(c.id)} style={actionBtn}>
                        <Send size={10} /> Facturer
                      </button>
                    )}
                    {c.invoice_sent_at && !c.paid_at && (
                      <button onClick={() => markPaidMut.mutate(c.id)} style={actionBtn}>
                        Payé
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
            {partnerId && !commsQ.isLoading && (commsQ.data?.length ?? 0) === 0 && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: C.textMuted }}>
                Aucune commission calculée. Utiliser « Recalculer » pour ce mois.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Create partner modal ─────────────────────────────────────────────────────

function CreatePartnerModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [vertical, setVertical] = useState<Vertical>("insurance");
  const [region, setRegion] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");

  const mut = useMutation({
    mutationFn: async () => (await api.post("/partners", {
      name: name.trim(),
      vertical,
      region: region.trim() || null,
      contact_email: contactEmail.trim() || null,
      api_key: apiKey.trim() || null,
      api_base_url: apiBaseUrl.trim() || null,
    })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
      onClose();
    },
  });

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.surface, borderRadius: 12, maxWidth: 520, width: "100%", padding: 24, maxHeight: "90vh", overflow: "auto" }}
      >
        <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 22, margin: "0 0 16px", color: C.text }}>
          Nouveau partenaire
        </h2>

        <Field label="Nom">
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="La Mobilière" />
        </Field>
        <Field label="Verticale">
          <select value={vertical} onChange={e => setVertical(e.target.value as Vertical)} style={inputStyle}>
            {Object.entries(VERTICAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Région (code canton ou vide = national)">
          <input value={region} onChange={e => setRegion(e.target.value)} style={inputStyle} placeholder="GE, VD, CH-FR…" />
        </Field>
        <Field label="Contact email">
          <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="URL API (optionnel)">
          <input value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)} style={inputStyle} placeholder="https://api.partner.ch/v1" />
        </Field>
        <Field label="Clé API (chiffrée au stockage)">
          <input value={apiKey} onChange={e => setApiKey(e.target.value)} style={inputStyle} type="password" autoComplete="new-password" />
        </Field>

        {mut.isError && <p style={{ color: C.red, fontSize: 13, marginTop: 8 }}>Création échouée.</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "8px 14px", borderRadius: 8, background: "transparent", border: `1px solid ${C.border}`, color: C.text2, fontSize: 14, cursor: "pointer" }}>
            Annuler
          </button>
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !name.trim()}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: C.prussian, color: "#fff", fontSize: 14, fontWeight: 600,
              cursor: mut.isPending ? "progress" : "pointer", opacity: mut.isPending ? 0.7 : 1,
            }}
          >
            {mut.isPending ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

// ── Inline helpers / styles ──────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8,
  border: `1px solid ${C.border}`, fontSize: 14,
  boxSizing: "border-box", background: C.surface, color: C.text,
};

const selectStyle: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`,
  fontSize: 14, background: C.surface, color: C.text,
};

const actionBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 3,
  padding: "3px 9px", borderRadius: 6, border: `1px solid ${C.border}`,
  background: "transparent", color: C.text, fontSize: 11, cursor: "pointer",
};

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "10px 14px", verticalAlign: "middle" }}>{children}</td>;
}
