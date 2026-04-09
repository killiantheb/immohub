"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Building2, Clock, FileText, Home,
  ImagePlus, Loader2, MapPin, Pencil, Sparkles, Star, Trash2, Upload, X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  useDeleteImage, useDeleteProperty, useGenerateDescription,
  useProperty, useUpdateProperty, useUploadDocument, useUploadImage,
} from "@/lib/hooks/useProperties";
import {
  PROPERTY_STATUS_COLORS, PROPERTY_STATUS_LABELS, PROPERTY_TYPE_LABELS,
} from "@/lib/constants/properties";
import type { PropertyStatus, PropertyType } from "@/lib/types";
import { RatingWidget } from "@/components/RatingWidget";
import { DocumentQuickGenerator } from "@/components/DocumentQuickGenerator";
import { api } from "@/lib/api";

// ── Design tokens ─────────────────────────────────────────────────────────────
const O   = '#D4601A'
const O10 = 'rgba(212,96,26,0.10)'
const O20 = 'rgba(212,96,26,0.20)'
const T   = '#1C0F06'
const T5  = 'rgba(80,35,8,0.58)'
const T3  = 'rgba(80,35,8,0.32)'
const BG  = '#FAF5EB'

// ── Label maps ────────────────────────────────────────────────────────────────
const CONTRACT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  active:     { label: 'Actif',     color: '#3B6D11', bg: 'rgba(59,109,17,0.10)' },
  draft:      { label: 'Brouillon', color: '#854F0B', bg: 'rgba(133,79,11,0.10)' },
  terminated: { label: 'Résilié',   color: '#A32D2D', bg: 'rgba(163,45,45,0.10)' },
  expired:    { label: 'Expiré',    color: '#6B4590', bg: 'rgba(107,69,144,0.10)' },
}
const RFQ_STATUS: Record<string, { label: string; color: string }> = {
  draft:           { label: 'Brouillon',       color: T3 },
  published:       { label: 'Publié',          color: '#185FA5' },
  quotes_received: { label: 'Devis reçus',     color: '#854F0B' },
  accepted:        { label: 'Accepté',         color: '#3B6D11' },
  in_progress:     { label: 'En cours',        color: O },
  completed:       { label: 'Terminé',         color: '#3B6D11' },
  rated:           { label: 'Évalué',          color: '#3B6D11' },
  cancelled:       { label: 'Annulé',          color: '#A32D2D' },
}
const URGENCY_COLOR: Record<string, string> = {
  low: '#3B6D11', medium: '#854F0B', high: O, emergency: '#A32D2D',
}
const CATEGORY_LABEL: Record<string, string> = {
  plumbing: 'Plomberie', electricity: 'Électricité', cleaning: 'Nettoyage',
  painting: 'Peinture', locksmith: 'Serrurerie', roofing: 'Toiture',
  gardening: 'Jardinage', masonry: 'Maçonnerie', hvac: 'CVC',
  renovation: 'Rénovation', other: 'Autre',
}
const MISSION_TYPE: Record<string, string> = {
  visit: 'Visite', check_in: 'Check-in', check_out: 'Check-out',
  inspection: 'Inspection', photography: 'Photos', other: 'Autre',
}
const MISSION_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'En attente',  color: '#854F0B', bg: 'rgba(133,79,11,0.10)' },
  confirmed:   { label: 'Confirmée',   color: '#185FA5', bg: 'rgba(24,95,165,0.10)' },
  in_progress: { label: 'En cours',   color: O,         bg: O10 },
  completed:   { label: 'Terminée',   color: '#3B6D11', bg: 'rgba(59,109,17,0.10)' },
  cancelled:   { label: 'Annulée',    color: '#A32D2D', bg: 'rgba(163,45,45,0.10)' },
}
const DOC_TYPE_LABELS: Record<string, string> = {
  lease: "Bail", inventory: "État des lieux", insurance: "Assurance",
  notice: "Préavis", deed: "Acte", diagnosis: "Diagnostic", other: "Autre",
}
const ACTION_LABELS: Record<string, string> = {
  create: "Création", update: "Modification", delete: "Suppression",
  ai_description: "Description IA générée",
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtCHF(n: number | null | undefined) {
  if (!n) return '—'
  return `CHF ${Number(n).toLocaleString('fr-CH')}`
}
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, color, background: bg, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

// ── Editable field (unchanged) ────────────────────────────────────────────────
function EditableField({ label, value, onSave, type = "text" }: {
  label: string; value: string | number | null | undefined;
  onSave: (v: string) => void; type?: "text" | "number" | "textarea";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const save = () => { onSave(draft); setEditing(false); };
  if (editing) {
    return (
      <div className="space-y-1">
        <label className="text-xs text-gray-500">{label}</label>
        {type === "textarea" ? (
          <textarea className="input min-h-24 w-full resize-y text-sm" value={draft} onChange={e => setDraft(e.target.value)} autoFocus />
        ) : (
          <input type={type} className="input w-full text-sm" value={draft} onChange={e => setDraft(e.target.value)} autoFocus />
        )}
        <div className="flex gap-2">
          <button onClick={save} className="btn-primary py-1 text-xs">Enregistrer</button>
          <button onClick={() => setEditing(false)} className="btn-secondary py-1 text-xs">Annuler</button>
        </div>
      </div>
    );
  }
  return (
    <div className="group flex cursor-pointer items-start justify-between gap-2 rounded-md p-1 hover:bg-gray-50"
      onClick={() => { setDraft(String(value ?? "")); setEditing(true); }}>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-medium text-gray-900">{value ?? <span className="italic text-gray-400">—</span>}</p>
      </div>
      <Pencil className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-300 opacity-0 group-hover:opacity-100" />
    </div>
  );
}

// ── Images section ────────────────────────────────────────────────────────────
function ImagesSection({ propertyId }: { propertyId: string }) {
  const { data: property } = useProperty(propertyId);
  const uploadImage = useUploadImage(propertyId);
  const deleteImage = useDeleteImage(propertyId);
  const inputRef = useRef<HTMLInputElement>(null);
  const images = property?.images ?? [];
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Photos</h2>
        <button onClick={() => inputRef.current?.click()} className="btn-secondary flex items-center gap-1 text-sm">
          <ImagePlus className="h-4 w-4" /> Ajouter
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={e => { const file = e.target.files?.[0]; if (file) uploadImage.mutate({ file, isCover: images.length === 0 }); e.target.value = ""; }} />
      </div>
      {uploadImage.isPending && <div className="mb-3 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Upload en cours…</div>}
      {images.length === 0 ? (
        <div className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-10 hover:border-primary-300"
          onClick={() => inputRef.current?.click()}>
          <Upload className="mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">Cliquez pour ajouter des photos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map(img => (
            <div key={img.id} className="group relative aspect-video overflow-hidden rounded-lg bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
              {img.is_cover && <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-amber-400/90 px-1.5 py-0.5 text-xs font-medium text-white"><Star className="h-3 w-3" /> Couverture</span>}
              <button onClick={() => deleteImage.mutate(img.id)} className="absolute right-1 top-1 hidden rounded-full bg-white/80 p-1 text-red-500 hover:bg-white group-hover:block"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Documents section ─────────────────────────────────────────────────────────
function DocumentsSection({ propertyId }: { propertyId: string }) {
  const { data: property } = useProperty(propertyId);
  const uploadDoc = useUploadDocument(propertyId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("other");
  const docs = property?.documents ?? [];
  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center gap-2 justify-between">
        <h2 className="text-lg font-semibold">Documents</h2>
        <div className="flex gap-2">
          <select value={docType} onChange={e => setDocType(e.target.value)} className="input w-auto text-sm">
            {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={() => inputRef.current?.click()} className="btn-secondary flex items-center gap-1 text-sm">
            <Upload className="h-4 w-4" /> Ajouter
          </button>
        </div>
        <input ref={inputRef} type="file" accept=".pdf,image/jpeg,image/png" className="hidden"
          onChange={e => { const file = e.target.files?.[0]; if (file) uploadDoc.mutate({ file, docType }); e.target.value = ""; }} />
      </div>
      {uploadDoc.isPending && <div className="mb-3 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Upload en cours…</div>}
      {docs.length === 0 ? <p className="py-6 text-center text-sm text-gray-400">Aucun document</p> : (
        <ul className="divide-y">
          {docs.map(doc => (
            <li key={doc.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <div><p className="text-sm font-medium text-gray-800">{doc.name}</p><p className="text-xs text-gray-400">{DOC_TYPE_LABELS[doc.type] ?? doc.type}</p></div>
              </div>
              <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">Voir</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── History section ───────────────────────────────────────────────────────────
function HistorySection({ propertyId }: { propertyId: string }) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["properties", propertyId, "history"],
    queryFn: async () => { const { data } = await api.get(`/properties/${propertyId}/history`); return data as Array<{ id: string; action: string; created_at: string }>; },
    enabled: Boolean(propertyId),
  });
  if (isLoading) return <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>;
  return (
    <div className="card">
      <h2 className="mb-4 text-lg font-semibold">Historique</h2>
      {!history?.length ? <p className="py-4 text-center text-sm text-gray-400">Aucune activité</p> : (
        <ul className="space-y-3">
          {history.map(log => (
            <li key={log.id} className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
              <div>
                <p className="text-sm font-medium text-gray-800">{ACTION_LABELS[log.action] ?? log.action}</p>
                <p className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString("fr-FR")}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 360° hook ─────────────────────────────────────────────────────────────────
function usePropertyOverview(propertyId: string) {
  return useQuery({
    queryKey: ["crm", "property", propertyId, "overview"],
    queryFn: async () => {
      const { data } = await api.get(`/crm/property/${propertyId}/overview`);
      return data as {
        contracts: Array<{
          id: string; reference: string; status: string; type: string;
          start_date: string | null; end_date: string | null;
          monthly_rent: number | null; charges: number | null; deposit: number | null;
          total_paid: number;
          tenant: { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
        }>;
        rfqs: Array<{
          id: string; title: string; category: string; status: string; urgency: string;
          budget_min: number | null; budget_max: number | null;
          scheduled_date: string | null; published_at: string | null; completed_at: string | null;
          rating_given: number | null; quotes_count: number;
          quotes: Array<{
            id: string; company_id: string; company_name: string; company_type: string;
            company_rating: number | null; amount: number; status: string;
            delay_days: number | null; submitted_at: string | null;
          }>;
        }>;
        missions: Array<{
          id: string; type: string; status: string;
          scheduled_at: string | null; completed_at: string | null;
          price: number | null; rating_given: number | null;
          opener: { first_name: string | null; last_name: string | null; email: string | null } | null;
        }>;
        listing_stats: { views: number; leads_count: number; status: string | null; published_at: string | null };
        crm_contacts: Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; status: string; source: string | null; created_at: string }>;
        notes: Array<{ id: string; content: string; target_user_id: string | null; target_contact_id: string | null; created_at: string }>;
        total_revenue: number;
      };
    },
    enabled: Boolean(propertyId),
  });
}

// ── Locataires tab ────────────────────────────────────────────────────────────
function TenantsTab({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = usePropertyOverview(propertyId);

  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: O }} /></div>;

  const contracts = data?.contracts ?? [];
  const current = contracts.find(c => c.status === 'active');
  const past = contracts.filter(c => c.status !== 'active');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Revenus totaux */}
      {(data?.total_revenue ?? 0) > 0 && (
        <div style={{ background: 'rgba(59,109,17,0.06)', border: '0.5px solid rgba(59,109,17,0.2)', borderRadius: 14, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#3B6D11', letterSpacing: '0.5px' }}>Total loyers encaissés sur ce bien</span>
          <span style={{ fontSize: 22, fontWeight: 300, color: '#3B6D11', fontFamily: 'var(--font-serif)' }}>{fmtCHF(data!.total_revenue)}</span>
        </div>
      )}

      {/* Locataire actuel */}
      <div>
        <h3 style={{ fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3, marginBottom: 10 }}>Locataire actuel</h3>
        {current?.tenant ? (
          <div style={{ background: '#fff', border: `0.5px solid ${O20}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: O10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 500, color: O }}>
                {(current.tenant.first_name?.[0] ?? '') + (current.tenant.last_name?.[0] ?? '')}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, color: T }}>{current.tenant.first_name} {current.tenant.last_name}</div>
                <div style={{ fontSize: 12, color: T3 }}>{current.tenant.email}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <Badge {...CONTRACT_STATUS.active} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { label: 'Début bail', value: fmtDate(current.start_date) },
                { label: 'Fin bail', value: fmtDate(current.end_date) },
                { label: 'Loyer/mois', value: fmtCHF(current.monthly_rent) },
                { label: 'Total encaissé', value: fmtCHF(current.total_paid) },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: BG, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: T3, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, color: T, fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>
            {current.tenant.phone && (
              <div style={{ marginTop: 12, fontSize: 12, color: T5 }}>📞 {current.tenant.phone}</div>
            )}
          </div>
        ) : (
          <div style={{ background: '#fff', border: `0.5px solid ${O20}`, borderRadius: 14, padding: '24px', textAlign: 'center', color: T3, fontSize: 13 }}>
            Pas de locataire actif
          </div>
        )}
      </div>

      {/* Historique locataires */}
      {past.length > 0 && (
        <div>
          <h3 style={{ fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3, marginBottom: 10 }}>
            Historique ({past.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {past.map(c => (
              <div key={c.id} style={{ background: '#fff', border: `0.5px solid ${O20}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: T }}>
                      {c.tenant ? `${c.tenant.first_name ?? ''} ${c.tenant.last_name ?? ''}`.trim() : 'Inconnu'}
                    </span>
                    <Badge {...(CONTRACT_STATUS[c.status] ?? { label: c.status, color: T3, bg: BG })} />
                  </div>
                  <span style={{ fontSize: 11, color: T3 }}>
                    {fmtDate(c.start_date)} → {fmtDate(c.end_date)}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: O, fontWeight: 500 }}>{fmtCHF(c.monthly_rent)}/mois</div>
                  <div style={{ fontSize: 11, color: T3 }}>Encaissé : {fmtCHF(c.total_paid)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Travaux tab ───────────────────────────────────────────────────────────────
function TravauxTab({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = usePropertyOverview(propertyId);
  const [openRfq, setOpenRfq] = useState<string | null>(null);

  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: O }} /></div>;

  const rfqs = data?.rfqs ?? [];
  const missions = data?.missions ?? [];
  const activeRfqs = rfqs.filter(r => !['completed', 'rated', 'cancelled'].includes(r.status));
  const doneRfqs = rfqs.filter(r => ['completed', 'rated'].includes(r.status));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Appels d'offre actifs */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3 }}>
            Travaux en cours / à venir ({activeRfqs.length})
          </h3>
          <Link href="/app/rfqs/new" style={{ fontSize: 11, color: O, textDecoration: 'none', padding: '4px 12px', border: `0.5px solid ${O20}`, borderRadius: 20 }}>
            + Nouvel appel d'offre
          </Link>
        </div>

        {activeRfqs.length === 0 ? (
          <div style={{ background: '#fff', border: `0.5px solid ${O20}`, borderRadius: 14, padding: 24, textAlign: 'center', color: T3, fontSize: 13 }}>
            Aucun travail en cours
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeRfqs.map(rfq => {
              const st = RFQ_STATUS[rfq.status] ?? { label: rfq.status, color: T3 };
              const isOpen = openRfq === rfq.id;
              return (
                <div key={rfq.id} style={{ background: '#fff', border: `0.5px solid ${O20}`, borderRadius: 14, overflow: 'hidden' }}>
                  <button onClick={() => setOpenRfq(isOpen ? null : rfq.id)}
                    style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: T }}>{rfq.title}</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, color: st.color, background: `${st.color}15` }}>{st.label}</span>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 20, color: URGENCY_COLOR[rfq.urgency], background: `${URGENCY_COLOR[rfq.urgency]}15` }}>
                          {rfq.urgency === 'emergency' ? '🚨' : rfq.urgency === 'high' ? '⚠️' : ''} {rfq.urgency}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: T3 }}>
                        {CATEGORY_LABEL[rfq.category] ?? rfq.category}
                        {rfq.budget_max ? ` · Budget : ${fmtCHF(rfq.budget_max)}` : ''}
                        {rfq.quotes_count > 0 ? ` · ${rfq.quotes_count} devis` : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: T3 }}>{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && rfq.quotes.length > 0 && (
                    <div style={{ borderTop: `0.5px solid ${O20}`, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: T3, marginBottom: 8 }}>Devis</div>
                      {rfq.quotes.map(q => (
                        <div key={q.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `0.5px solid ${O20}` }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 500, color: T }}>{q.company_name}</span>
                            {q.company_rating && <span style={{ fontSize: 11, color: T3, marginLeft: 6 }}>★ {q.company_rating.toFixed(1)}</span>}
                            {q.delay_days && <span style={{ fontSize: 11, color: T3, marginLeft: 6 }}>{q.delay_days} j</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: O }}>{fmtCHF(q.amount)}</span>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, color: q.status === 'accepted' ? '#3B6D11' : T3, background: q.status === 'accepted' ? 'rgba(59,109,17,0.10)' : BG }}>
                              {q.status === 'accepted' ? 'Accepté' : q.status === 'completed' ? 'Terminé' : q.status === 'rejected' ? 'Refusé' : 'En attente'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Missions ouvreurs */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3 }}>
            Missions ouvreurs ({missions.length})
          </h3>
          <Link href="/app/openers/new" style={{ fontSize: 11, color: O, textDecoration: 'none', padding: '4px 12px', border: `0.5px solid ${O20}`, borderRadius: 20 }}>
            + Mission
          </Link>
        </div>
        {missions.length === 0 ? (
          <div style={{ background: '#fff', border: `0.5px solid ${O20}`, borderRadius: 14, padding: 24, textAlign: 'center', color: T3, fontSize: 13 }}>Aucune mission</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {missions.map(m => {
              const ms = MISSION_STATUS[m.status] ?? { label: m.status, color: T3, bg: BG };
              return (
                <div key={m.id} style={{ background: '#fff', border: `0.5px solid ${O20}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: T }}>{MISSION_TYPE[m.type] ?? m.type}</span>
                      <Badge label={ms.label} color={ms.color} bg={ms.bg} />
                    </div>
                    <div style={{ fontSize: 11, color: T3 }}>
                      {fmtDate(m.scheduled_at)}
                      {m.opener ? ` · ${m.opener.first_name ?? ''} ${m.opener.last_name ?? ''}`.trim() : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {m.price != null && <div style={{ fontSize: 13, color: O, fontWeight: 500 }}>{fmtCHF(m.price)}</div>}
                    {m.rating_given != null && <div style={{ fontSize: 11, color: T3 }}>★ {m.rating_given.toFixed(1)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historique travaux terminés */}
      {doneRfqs.length > 0 && (
        <div>
          <h3 style={{ fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3, marginBottom: 10 }}>
            Travaux terminés ({doneRfqs.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {doneRfqs.map(rfq => {
              const accepted = rfq.quotes.find(q => q.status === 'accepted' || q.status === 'completed');
              return (
                <div key={rfq.id} style={{ background: '#fff', border: `0.5px solid ${O20}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: T, marginBottom: 3 }}>{rfq.title}</div>
                    <div style={{ fontSize: 11, color: T3 }}>
                      {CATEGORY_LABEL[rfq.category]} · Terminé le {fmtDate(rfq.completed_at)}
                      {accepted ? ` · ${accepted.company_name}` : ''}
                    </div>
                  </div>
                  {accepted && <div style={{ fontSize: 13, color: O, fontWeight: 500 }}>{fmtCHF(accepted.amount)}</div>}
                  {rfq.rating_given != null && <div style={{ fontSize: 11, color: T3 }}>★ {rfq.rating_given.toFixed(1)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stats tab ─────────────────────────────────────────────────────────────────
function StatsTab({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = usePropertyOverview(propertyId);

  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: O }} /></div>;

  const ls = data?.listing_stats;
  const contacts = data?.crm_contacts ?? [];
  const notes = data?.notes ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Listing stats */}
      <div>
        <h3 style={{ fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3, marginBottom: 10 }}>Annonce & visibilité</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Vues', value: ls?.views ?? 0 },
            { label: 'Leads générés', value: ls?.leads_count ?? 0 },
            { label: 'Statut annonce', value: ls?.status ? { active: 'Active', draft: 'Brouillon', paused: 'Pausée', archived: 'Archivée' }[ls.status] ?? ls.status : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#fff', border: `0.5px solid ${O20}`, borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 300, color: O, fontFamily: 'var(--font-serif)' }}>{value}</div>
            </div>
          ))}
        </div>
        {ls?.published_at && (
          <p style={{ fontSize: 11, color: T3, marginTop: 8 }}>Publiée le {fmtDate(ls.published_at)}</p>
        )}
      </div>

      {/* Finances */}
      <div>
        <h3 style={{ fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3, marginBottom: 10 }}>Revenus locatifs</h3>
        <div style={{ background: '#fff', border: `0.5px solid ${O20}`, borderRadius: 14, padding: '20px' }}>
          <div style={{ fontSize: 11, color: T3, marginBottom: 6 }}>Total loyers encaissés (tous contrats)</div>
          <div style={{ fontSize: 32, fontWeight: 300, color: O, fontFamily: 'var(--font-serif)' }}>{fmtCHF(data?.total_revenue ?? 0)}</div>
          <div style={{ fontSize: 11, color: T3, marginTop: 6 }}>{data?.contracts.length ?? 0} contrat(s) au total</div>
        </div>
      </div>

      {/* CRM Contacts */}
      <div>
        <h3 style={{ fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3, marginBottom: 10 }}>
          Prospects CRM ({contacts.length})
        </h3>
        {contacts.length === 0 ? (
          <div style={{ background: '#fff', border: `0.5px solid ${O20}`, borderRadius: 14, padding: 20, textAlign: 'center', color: T3, fontSize: 13 }}>
            Aucun prospect pour ce bien.{' '}
            <Link href="/app/crm" style={{ color: O, textDecoration: 'none' }}>Gérer dans le CRM →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {contacts.map(c => (
              <div key={c.id} style={{ background: '#fff', border: `0.5px solid ${O20}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: O10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, color: O }}>
                  {(c.first_name?.[0] ?? '') + (c.last_name?.[0] ?? '')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T }}>{c.first_name} {c.last_name}</div>
                  <div style={{ fontSize: 11, color: T3 }}>{c.email ?? c.phone ?? '—'}</div>
                </div>
                <div style={{ fontSize: 10, color: T3 }}>{fmtDate(c.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {notes.length > 0 && (
        <div>
          <h3 style={{ fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3, marginBottom: 10 }}>
            Notes ({notes.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notes.map(n => (
              <div key={n.id} style={{ background: '#fff', border: `0.5px solid ${O20}`, borderRadius: 12, padding: '12px 16px' }}>
                <p style={{ fontSize: 13, color: T, lineHeight: 1.5, marginBottom: 4 }}>{n.content}</p>
                <p style={{ fontSize: 10, color: T3 }}>{fmtDate(n.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Tab = "details" | "images" | "documents" | "tenants" | "travaux" | "stats" | "history";

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: property, isLoading } = useProperty(id);
  const update = useUpdateProperty(id);
  const deleteProperty = useDeleteProperty();
  const generateDesc = useGenerateDescription(id);
  const [tab, setTab] = useState<Tab>("details");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [favoriteAdded, setFavoriteAdded] = useState(false);
  const [rentedModal, setRentedModal] = useState(false);
  const [selectedCrmId, setSelectedCrmId] = useState<string | null>(null);
  const [extName, setExtName] = useState('');
  const [extEmail, setExtEmail] = useState('');
  const { data: overview } = usePropertyOverview(id);
  const { data: allCrmContacts } = useQuery({
    queryKey: ['crm', 'contacts', 'all'],
    queryFn: async () => {
      const { data } = await api.get('/crm/contacts');
      return data as Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; status: string }>;
    },
    enabled: rentedModal,
    staleTime: 60_000,
  });

  async function addToFavorites() {
    try { await api.post('/favorites', { property_id: id }); setFavoriteAdded(true); }
    catch { setFavoriteAdded(true); }
  }

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
    </div>
  );

  if (!property) return (
    <div className="flex flex-col items-center py-20 text-center">
      <Home className="mb-3 h-10 w-10 text-gray-300" />
      <p className="text-gray-600">Bien introuvable</p>
      <button onClick={() => router.back()} className="btn-secondary mt-4">Retour</button>
    </div>
  );

  const save = (field: string) => (val: string) => update.mutate({ [field]: val || null });
  const saveNum = (field: string) => (val: string) => update.mutate({ [field]: val ? Number(val) : null });
  const cover = property.images?.find(i => i.is_cover) ?? property.images?.[0];

  const TABS: { id: Tab; label: string }[] = [
    { id: "details",   label: "Détails" },
    { id: "tenants",   label: "Locataires" },
    { id: "travaux",   label: "Travaux" },
    { id: "stats",     label: "Stats & CRM" },
    { id: "images",    label: `Photos${property.images?.length ? ` (${property.images.length})` : ""}` },
    { id: "documents", label: `Documents${property.documents?.length ? ` (${property.documents.length})` : ""}` },
    { id: "history",   label: "Historique" },
  ];

  return (
    <div>
      {/* Back */}
      <Link href="/app/properties" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: T3, textDecoration: 'none', marginBottom: 20, letterSpacing: '0.5px' }}>
        <ArrowLeft style={{ width: 14, height: 14 }} /> Biens immobiliers
      </Link>

      {/* Hero */}
      <div style={{ marginBottom: 24, borderRadius: 20, overflow: 'hidden', border: `0.5px solid ${O20}`, boxShadow: '0 8px 32px rgba(28,15,6,0.10)' }}>
        {/* Cover image */}
        <div style={{ position: 'relative', height: cover ? 280 : 140, background: BG }}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 style={{ width: 56, height: 56, color: O20 }} />
            </div>
          )}
          {cover && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 35%, rgba(28,15,6,0.72))' }} />}
          {/* Status badge */}
          <span style={{ position: 'absolute', top: 16, right: 16, fontSize: 10, letterSpacing: '1.5px', padding: '4px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.92)', color: T, fontWeight: 500, textTransform: 'uppercase' }}>
            {PROPERTY_STATUS_LABELS[property.status as PropertyStatus] ?? property.status}
          </span>
          {/* Title overlay (on image) */}
          {cover && (
            <div style={{ position: 'absolute', bottom: 20, left: 24, right: 24 }}>
              <h1 style={{ fontFamily: 'var(--font-serif),serif', fontSize: 26, fontWeight: 400, color: '#fff', lineHeight: 1.2, margin: 0 }}>
                {PROPERTY_TYPE_LABELS[property.type as PropertyType] ?? property.type}
                {property.surface ? ` · ${property.surface} m²` : ''}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin style={{ width: 11, height: 11, flexShrink: 0 }} />
                {property.address}, {property.zip_code} {property.city}
              </p>
            </div>
          )}
        </div>

        {/* Info bar */}
        <div style={{ background: '#fff', padding: '16px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, justifyContent: 'space-between' }}>
          <div>
            {!cover && (
              <>
                <h1 style={{ fontFamily: 'var(--font-serif),serif', fontSize: 22, fontWeight: 400, color: T, marginBottom: 2 }}>
                  {PROPERTY_TYPE_LABELS[property.type as PropertyType] ?? property.type}
                  {property.surface ? ` · ${property.surface} m²` : ''}
                </h1>
                <p style={{ color: T3, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <MapPin style={{ width: 11, height: 11 }} />{property.address}, {property.zip_code} {property.city}
                </p>
              </>
            )}
            {property.monthly_rent ? (
              <p style={{ fontFamily: 'var(--font-serif),serif', fontSize: 22, fontWeight: 300, color: O, margin: 0 }}>
                CHF {Number(property.monthly_rent).toLocaleString('fr-CH')} <span style={{ fontSize: 12, fontFamily: 'inherit', fontWeight: 400 }}>/ mois</span>
              </p>
            ) : property.price_sale ? (
              <p style={{ fontFamily: 'var(--font-serif),serif', fontSize: 22, fontWeight: 300, color: O, margin: 0 }}>
                CHF {Number(property.price_sale).toLocaleString('fr-CH')}
              </p>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <DocumentQuickGenerator label="Fiche PDF" icon="🏠" templateType="fiche_bien" propertyId={id} variant="primary" />
            <DocumentQuickGenerator label="Demande pièces" icon="📋" propertyId={id} smartPieces variant="outline" />
            <button onClick={addToFavorites}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: `0.5px solid ${favoriteAdded ? O : O20}`, background: favoriteAdded ? O10 : 'transparent', color: favoriteAdded ? O : T3, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
              <Star style={{ width: 13, height: 13, fill: favoriteAdded ? O : 'none', stroke: favoriteAdded ? O : 'currentColor' }} />
              {favoriteAdded ? 'Favori' : 'Favoris'}
            </button>
            {confirmDelete ? (
              <>
                <button onClick={async () => { await deleteProperty.mutateAsync(id); router.push('/app/properties'); }}
                  disabled={deleteProperty.isPending}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '0.5px solid rgba(163,45,45,0.35)', background: 'rgba(163,45,45,0.07)', color: '#A32D2D', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                  {deleteProperty.isPending ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : <Trash2 style={{ width: 13, height: 13 }} />} Confirmer
                </button>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: '7px 14px', borderRadius: 10, border: `0.5px solid ${O20}`, background: 'transparent', color: T3, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Annuler</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '0.5px solid rgba(163,45,45,0.2)', background: 'transparent', color: '#A32D2D', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                <Trash2 style={{ width: 13, height: 13 }} /> Supprimer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 2, overflowX: 'auto', borderBottom: `0.5px solid ${O20}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '9px 16px', fontSize: 12, fontFamily: 'inherit', background: 'transparent', border: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: -1,
              color: tab === t.id ? O : T5,
              borderBottom: tab === t.id ? `2px solid ${O}` : '2px solid transparent',
              fontWeight: tab === t.id ? 500 : 400,
              letterSpacing: tab === t.id ? '0.3px' : 0,
              transition: 'all 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "details" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Informations générales */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: `0.5px solid ${O20}`, boxShadow: '0 2px 12px rgba(28,15,6,0.05)' }}>
              <p style={{ fontSize: 10, letterSpacing: '1.8px', textTransform: 'uppercase', color: T5, marginBottom: 16 }}>Informations générales</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <EditableField label="Surface (m²)" value={property.surface} onSave={saveNum("surface")} type="number" />
                <EditableField label="Pièces" value={property.rooms} onSave={saveNum("rooms")} type="number" />
                <EditableField label="Étage" value={property.floor} onSave={saveNum("floor")} type="number" />
                <EditableField label="Adresse" value={property.address} onSave={save("address")} />
                <EditableField label="Ville" value={property.city} onSave={save("city")} />
                <EditableField label="Code postal" value={property.zip_code} onSave={save("zip_code")} />
              </div>
            </div>
            {/* Finances */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: `0.5px solid ${O20}`, boxShadow: '0 2px 12px rgba(28,15,6,0.05)' }}>
              <p style={{ fontSize: 10, letterSpacing: '1.8px', textTransform: 'uppercase', color: T5, marginBottom: 16 }}>Finances</p>
              <div className="grid grid-cols-2 gap-3">
                <EditableField label="Loyer mensuel (CHF)" value={property.monthly_rent} onSave={saveNum("monthly_rent")} type="number" />
                <EditableField label="Charges (CHF/mois)" value={property.charges} onSave={saveNum("charges")} type="number" />
                <EditableField label="Dépôt de garantie (CHF)" value={property.deposit} onSave={saveNum("deposit")} type="number" />
                <EditableField label="Prix de vente (CHF)" value={property.price_sale} onSave={saveNum("price_sale")} type="number" />
              </div>
            </div>
            {/* Description */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: `0.5px solid ${O20}`, boxShadow: '0 2px 12px rgba(28,15,6,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <p style={{ fontSize: 10, letterSpacing: '1.8px', textTransform: 'uppercase', color: T3 }}>Description</p>
                <button onClick={() => generateDesc.mutate()} disabled={generateDesc.isPending}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: `0.5px solid ${O20}`, background: 'transparent', color: T3, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                  {generateDesc.isPending ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <Sparkles style={{ width: 12, height: 12, color: '#D4A017' }} />}
                  Générer avec l'IA
                </button>
              </div>
              <EditableField label="Description" value={property.description} onSave={save("description")} type="textarea" />
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Options */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: `0.5px solid ${O20}`, boxShadow: '0 2px 12px rgba(28,15,6,0.05)' }}>
              <p style={{ fontSize: 10, letterSpacing: '1.8px', textTransform: 'uppercase', color: T5, marginBottom: 16 }}>Options</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { key: "is_furnished", label: "Meublé", value: property.is_furnished },
                  { key: "has_parking", label: "Parking", value: property.has_parking },
                  { key: "pets_allowed", label: "Animaux acceptés", value: property.pets_allowed },
                  { key: "has_balcony", label: "Balcon", value: (property as any).has_balcony },
                  { key: "has_terrace", label: "Terrasse", value: (property as any).has_terrace },
                  { key: "has_garden", label: "Jardin", value: (property as any).has_garden },
                ].map(({ key, label, value }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: T5 }}>{label}</span>
                    <button onClick={() => update.mutate({ [key]: !value })}
                      style={{ fontSize: 10, padding: '3px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: value ? 'rgba(59,109,17,0.10)' : O10, color: value ? '#3B6D11' : T3 }}>
                      {value ? 'Oui' : 'Non'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* Statut */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: `0.5px solid ${O20}`, boxShadow: '0 2px 12px rgba(28,15,6,0.05)' }}>
              <p style={{ fontSize: 10, letterSpacing: '1.8px', textTransform: 'uppercase', color: T5, marginBottom: 14 }}>Statut du bien</p>
              <select
                value={property.status}
                onChange={e => {
                  const s = e.target.value as PropertyStatus;
                  if (s === 'rented') { setRentedModal(true); }
                  else { update.mutate({ status: s }); }
                }}
                style={{ width: '100%', padding: '9px 13px', border: `0.5px solid ${O20}`, borderRadius: 10, fontSize: 13, color: T, background: BG, outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
              >
                {(["available", "rented", "for_sale", "sold", "maintenance"] as PropertyStatus[]).map(s => (
                  <option key={s} value={s}>{PROPERTY_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            {/* Meta */}
            <div style={{ background: '#fff', borderRadius: 16, padding: '16px 24px', border: `0.5px solid ${O20}` }}>
              <p style={{ fontSize: 11, color: T3, marginBottom: 4 }}>Créé le {new Date(property.created_at).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p style={{ fontSize: 11, color: T3 }}>Modifié le {new Date(property.updated_at).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        </div>
      )}

      {tab === "tenants"   && <TenantsTab propertyId={id} />}
      {tab === "travaux"   && <TravauxTab propertyId={id} />}
      {tab === "stats"     && <StatsTab propertyId={id} />}
      {tab === "images"    && <ImagesSection propertyId={id} />}
      {tab === "documents" && <DocumentsSection propertyId={id} />}
      {tab === "history"   && <HistorySection propertyId={id} />}

      <div style={{ marginTop: '2rem' }}>
        <RatingWidget entityType="property" entityId={id} title="Avis sur ce bien" />
      </div>

      {/* ── Rented modal ──────────────────────────────────────────────────────── */}
      {rentedModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(28,15,6,0.50)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) { setRentedModal(false); setExtName(''); setExtEmail(''); setSelectedCrmId(null); } }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '90%', maxWidth: 480, boxShadow: '0 24px 64px rgba(28,15,6,0.20)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: 'var(--font-serif),serif', fontSize: 22, fontWeight: 400, color: T, marginBottom: 6 }}>
              Qui est le locataire ?
            </h2>
            <p style={{ fontSize: 13, color: T3, marginBottom: 24, lineHeight: 1.5 }}>
              Choisissez un contact CRM existant ou saisissez un locataire externe.
            </p>

            {/* CRM contacts */}
            {(allCrmContacts?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 10, letterSpacing: '1.8px', textTransform: 'uppercase', color: T5, marginBottom: 10 }}>Contacts CRM</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {allCrmContacts!.map(c => (
                    <button key={c.id}
                      onClick={() => setSelectedCrmId(c.id === selectedCrmId ? null : c.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                        borderRadius: 12, border: `0.5px solid ${selectedCrmId === c.id ? O : O20}`,
                        background: selectedCrmId === c.id ? O10 : 'transparent',
                        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s',
                      }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: O10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, color: O, flexShrink: 0 }}>
                        {(c.first_name?.[0] ?? '') + (c.last_name?.[0] ?? '')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: T }}>{c.first_name} {c.last_name}</div>
                        <div style={{ fontSize: 11, color: T3 }}>{c.email ?? c.phone ?? '—'}</div>
                      </div>
                      {selectedCrmId === c.id && <span style={{ color: O, fontSize: 16, flexShrink: 0 }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ flex: 1, height: '0.5px', background: O20 }} />
              <span style={{ fontSize: 11, color: T3, whiteSpace: 'nowrap' }}>ou locataire externe</span>
              <div style={{ flex: 1, height: '0.5px', background: O20 }} />
            </div>

            {/* External tenant fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              <input
                placeholder="Nom complet"
                value={extName}
                onChange={e => { setExtName(e.target.value); if (e.target.value) setSelectedCrmId(null); }}
                style={{ padding: '9px 13px', border: `0.5px solid ${O20}`, borderRadius: 10, fontSize: 13, color: T, outline: 'none', fontFamily: 'inherit', background: BG }}
              />
              <input
                placeholder="Email (optionnel)"
                value={extEmail}
                onChange={e => setExtEmail(e.target.value)}
                style={{ padding: '9px 13px', border: `0.5px solid ${O20}`, borderRadius: 10, fontSize: 13, color: T, outline: 'none', fontFamily: 'inherit', background: BG }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  update.mutate({ status: 'rented' });
                  setRentedModal(false);
                  setExtName('');
                  setExtEmail('');
                  setSelectedCrmId(null);
                }}
                style={{ flex: 1, padding: '11px 18px', borderRadius: 12, border: 'none', background: O, color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
              >
                Confirmer — Marquer loué
              </button>
              <button
                onClick={() => { setRentedModal(false); setExtName(''); setExtEmail(''); setSelectedCrmId(null); }}
                style={{ padding: '11px 16px', borderRadius: 12, border: `0.5px solid ${O20}`, background: 'transparent', color: T3, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
