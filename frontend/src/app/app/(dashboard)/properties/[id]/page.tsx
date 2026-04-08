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

  async function addToFavorites() {
    try { await api.post('/favorites/', { property_id: id }); setFavoriteAdded(true); }
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
      <Link href="/app/properties" className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Biens immobiliers
      </Link>

      {/* Hero */}
      <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt="" className="h-56 w-full object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center bg-gray-50">
            <Building2 className="h-16 w-16 text-gray-200" />
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">
                {PROPERTY_TYPE_LABELS[property.type as PropertyType] ?? property.type}
                {property.surface ? ` · ${property.surface} m²` : ""}
              </h1>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PROPERTY_STATUS_COLORS[property.status as PropertyStatus]}`}>
                {PROPERTY_STATUS_LABELS[property.status as PropertyStatus] ?? property.status}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-gray-500">
              <MapPin className="h-4 w-4 shrink-0" />
              {property.address}, {property.zip_code} {property.city}
            </p>
            {property.monthly_rent && (
              <p className="mt-1 text-sm font-medium" style={{ color: O }}>
                CHF {Number(property.monthly_rent).toLocaleString('fr-CH')} / mois
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <DocumentQuickGenerator label="Fiche PDF" icon="🏠" templateType="fiche_bien" propertyId={id} variant="primary" />
            <DocumentQuickGenerator label="Demande pièces" icon="📋" propertyId={id} smartPieces variant="outline" />
            <button onClick={addToFavorites} title={favoriteAdded ? "Ajouté aux favoris" : "Ajouter aux favoris"}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
              <Star className={`h-4 w-4 ${favoriteAdded ? "fill-orange-400 text-orange-400" : ""}`} />
              {favoriteAdded ? "Favori" : "Favoris"}
            </button>
            {confirmDelete ? (
              <>
                <button onClick={async () => { await deleteProperty.mutateAsync(id); router.push("/app/properties"); }}
                  className="btn-danger flex items-center gap-1" disabled={deleteProperty.isPending}>
                  {deleteProperty.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Confirmer
                </button>
                <button onClick={() => setConfirmDelete(false)} className="btn-secondary">Annuler</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="btn-secondary flex items-center gap-1 text-red-600 hover:border-red-300">
                <Trash2 className="h-4 w-4" /> Supprimer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${tab === t.id ? "border-b-2 border-primary-600 text-primary-600" : "text-gray-500 hover:text-gray-800"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "details" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="card">
              <h2 className="mb-4 text-base font-semibold text-gray-900">Informations générales</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <EditableField label="Surface (m²)" value={property.surface} onSave={saveNum("surface")} type="number" />
                <EditableField label="Pièces" value={property.rooms} onSave={saveNum("rooms")} type="number" />
                <EditableField label="Étage" value={property.floor} onSave={saveNum("floor")} type="number" />
                <EditableField label="Adresse" value={property.address} onSave={save("address")} />
                <EditableField label="Ville" value={property.city} onSave={save("city")} />
                <EditableField label="Code postal" value={property.zip_code} onSave={save("zip_code")} />
              </div>
            </div>
            <div className="card">
              <h2 className="mb-4 text-base font-semibold text-gray-900">Finances</h2>
              <div className="grid grid-cols-2 gap-3">
                <EditableField label="Loyer mensuel (CHF)" value={property.monthly_rent} onSave={saveNum("monthly_rent")} type="number" />
                <EditableField label="Charges (CHF/mois)" value={property.charges} onSave={saveNum("charges")} type="number" />
                <EditableField label="Dépôt de garantie (CHF)" value={property.deposit} onSave={saveNum("deposit")} type="number" />
                <EditableField label="Prix de vente (CHF)" value={property.price_sale} onSave={saveNum("price_sale")} type="number" />
              </div>
            </div>
            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Description</h2>
                <button onClick={() => generateDesc.mutate()} disabled={generateDesc.isPending}
                  className="btn-secondary flex items-center gap-1.5 text-xs">
                  {generateDesc.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
                  Générer avec l'IA
                </button>
              </div>
              <EditableField label="Description" value={property.description} onSave={save("description")} type="textarea" />
            </div>
          </div>
          <div className="space-y-6">
            <div className="card">
              <h2 className="mb-4 text-base font-semibold text-gray-900">Options</h2>
              <ul className="space-y-2 text-sm">
                {[
                  { key: "is_furnished", label: "Meublé", value: property.is_furnished },
                  { key: "has_parking", label: "Parking", value: property.has_parking },
                  { key: "pets_allowed", label: "Animaux acceptés", value: property.pets_allowed },
                ].map(({ key, label, value }) => (
                  <li key={key} className="flex items-center justify-between">
                    <span className="text-gray-600">{label}</span>
                    <button onClick={() => update.mutate({ [key]: !value })}
                      className={`rounded-full px-3 py-0.5 text-xs font-medium ${value ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {value ? "Oui" : "Non"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h2 className="mb-3 text-base font-semibold text-gray-900">Statut</h2>
              <select value={property.status} onChange={e => update.mutate({ status: e.target.value as PropertyStatus })} className="input w-full">
                {(["available", "rented", "for_sale", "sold", "maintenance"] as PropertyStatus[]).map(s => (
                  <option key={s} value={s}>{PROPERTY_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="card text-xs text-gray-400 space-y-1">
              <p>Créé le {new Date(property.created_at).toLocaleDateString("fr-FR")}</p>
              <p>Modifié le {new Date(property.updated_at).toLocaleDateString("fr-FR")}</p>
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
    </div>
  );
}
