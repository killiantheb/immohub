"use client";

import { useState } from "react";
import { Plus, ExternalLink, Pause, Play, Search, Filter, Loader2, CheckCircle2, XCircle, AlertTriangle, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";

const STATUS_CONFIG = {
  draft:  { label: "Brouillon",  color: C.text3,  bg: C.surface2 },
  active: { label: "Active",     color: C.green,  bg: C.greenBg  },
  paused: { label: "Pausée",     color: C.amber,  bg: C.amberBg  },
  closed: { label: "Fermée",     color: C.text3,  bg: C.surface2 },
};

// Commission Althy : 4% sur tous les flux financiers transitant par la plateforme
// Si paiement direct au portail : Althy facture ses 4% séparément au client
const PORTALS = [
  { key: "on_flatfox",   channel: "flatfox",       name: "Flatfox",       logo: "🦊", available: true,  note: "Diffusion gratuite" },
  { key: "on_homegate",  channel: "homegate",       name: "Homegate",      logo: "🏠", available: true,  note: "Via SMG — tarif Homegate" },
  { key: "on_immoscout", channel: "immoscout24",    name: "ImmoScout24",   logo: "🔍", available: true,  note: "Via SMG — tarif ImmoScout" },
  { key: "on_immobilier",channel: "immobilier_ch",  name: "immobilier.ch", logo: "🏡", available: false, note: "Bientôt disponible" },
];

interface Listing {
  id: string;
  title: string;
  listing_type: "rental" | "sale";
  status: "draft" | "active" | "paused" | "closed";
  monthly_rent: number | null;
  sale_price: number | null;
  views_count: number;
  inquiries_count: number;
  on_flatfox: boolean;
  on_homegate: boolean;
  on_immoscout: boolean;
  on_immobilier: boolean;
  published_at: string | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n);
}

function NewListingModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "", listing_type: "rental", description: "",
    monthly_rent: "", sale_price: "", property_id: "",
  });
  const mutation = useMutation({
    mutationFn: (data: object) => api.post("/listings", data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["listings"] }); onClose(); },
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60, backgroundColor: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        backgroundColor: C.surface, borderRadius: 20, padding: 28,
        width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: C.text }}>Nouvelle annonce</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Titre</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Appartement 3.5 pièces, Genève Eaux-Vives"
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: C.surface2, color: C.text, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Type</label>
              <select value={form.listing_type} onChange={e => setForm(f => ({ ...f, listing_type: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: C.surface2, color: C.text, outline: "none", appearance: "none" }}>
                <option value="rental">Location</option>
                <option value="sale">Vente</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {form.listing_type === "rental" ? "Loyer/mois (CHF)" : "Prix de vente (CHF)"}
              </label>
              <input type="number"
                value={form.listing_type === "rental" ? form.monthly_rent : form.sale_price}
                onChange={e => setForm(f => form.listing_type === "rental" ? { ...f, monthly_rent: e.target.value } : { ...f, sale_price: e.target.value })}
                placeholder={form.listing_type === "rental" ? "1 800" : "750 000"}
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: C.surface2, color: C.text, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} placeholder="Description du bien (optionnel — l'IA peut la générer)"
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: C.surface2, color: C.text, outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", border: `1px solid ${C.border}`, borderRadius: 9, backgroundColor: "transparent", color: C.text2, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Annuler
          </button>
          <button
            disabled={!form.title || mutation.isPending}
            onClick={() => mutation.mutate({
              title: form.title, listing_type: form.listing_type,
              description: form.description || null,
              monthly_rent: form.monthly_rent ? parseFloat(form.monthly_rent) : null,
              sale_price: form.sale_price ? parseFloat(form.sale_price) : null,
            })}
            style={{ flex: 2, padding: "10px 0", border: "none", borderRadius: 9, backgroundColor: C.orange, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {mutation.isPending ? "Création…" : "Créer l'annonce"}
          </button>
        </div>
      </div>
    </div>
  );
}

type PublishResult = { channel: string; status: "pending" | "ok" | "error"; message?: string };

function DiffuserModal({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(PORTALS.filter(p => p.available).map(p => [p.channel, (listing as unknown as Record<string, boolean>)[p.key] ?? false]))
  );
  const [results, setResults] = useState<PublishResult[]>([]);
  const [publishing, setPublishing] = useState(false);

  const anyChecked = Object.values(checked).some(Boolean);

  async function handlePublish() {
    const channels = Object.entries(checked).filter(([, v]) => v).map(([k]) => k);
    if (!channels.length) return;
    setPublishing(true);
    const res: PublishResult[] = channels.map(c => ({ channel: c, status: "pending" }));
    setResults([...res]);

    for (let i = 0; i < channels.length; i++) {
      try {
        await api.post(`/listings/${listing.id}/publish`, { channel: channels[i] });
        res[i] = { channel: channels[i], status: "ok" };
      } catch {
        res[i] = { channel: channels[i], status: "error", message: "Erreur de diffusion" };
      }
      setResults([...res]);
    }
    setPublishing(false);
    qc.invalidateQueries({ queryKey: ["listings"] });
  }

  const portalName = (ch: string) => PORTALS.find(p => p.channel === ch)?.name ?? ch;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60, backgroundColor: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        backgroundColor: C.surface, borderRadius: 20, padding: 28,
        width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: C.text }}>
          Diffuser vers
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: C.text3 }}>
          {listing.title}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {PORTALS.map(p => {
            const isDisabled = !p.available;
            const result = results.find(r => r.channel === p.channel);
            return (
              <label key={p.channel} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: 12,
                backgroundColor: isDisabled ? C.surface2 : C.surface,
                opacity: isDisabled ? 0.55 : 1,
                cursor: isDisabled ? "default" : "pointer",
              }}>
                <input
                  type="checkbox"
                  checked={checked[p.channel] ?? false}
                  disabled={isDisabled || publishing}
                  onChange={e => setChecked(prev => ({ ...prev, [p.channel]: e.target.checked }))}
                  style={{ accentColor: "var(--althy-orange)", width: 16, height: 16 }}
                />
                <span style={{ fontSize: 20 }}>{p.logo}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>
                    {p.name}
                    {isDisabled && <span style={{ marginLeft: 8, fontSize: 10.5, color: C.amber, fontWeight: 500 }}>Bientôt disponible</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.text3 }}>{p.note}</div>
                </div>
                {result && (
                  <span style={{ flexShrink: 0 }}>
                    {result.status === "pending" && <Loader2 size={16} color={C.orange} style={{ animation: "spin 1s linear infinite" }} />}
                    {result.status === "ok" && <CheckCircle2 size={16} color={C.green} />}
                    {result.status === "error" && <XCircle size={16} color="var(--althy-red)" />}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {/* CTA intégration si aucune plateforme connectée */}
        <button
          onClick={() => router.push("/app/admin/integration")}
          style={{
            display: "flex", alignItems: "center", gap: 6, width: "100%",
            padding: "10px 14px", marginBottom: 16,
            border: `1px dashed ${C.border}`, borderRadius: 10,
            backgroundColor: "transparent", color: C.text3, fontSize: 12.5,
            cursor: "pointer", justifyContent: "center",
          }}
        >
          <Settings size={13} /> Configurer les intégrations portails
        </button>

        {/* Results summary */}
        {results.length > 0 && !publishing && (
          <div style={{ marginBottom: 16, padding: "10px 12px", borderRadius: 10, backgroundColor: C.surface2 }}>
            {results.map(r => (
              <div key={r.channel} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 12.5 }}>
                {r.status === "ok" ? <CheckCircle2 size={13} color={C.green} /> : <XCircle size={13} color="var(--althy-red)" />}
                <span style={{ color: r.status === "ok" ? C.green : "var(--althy-red)" }}>
                  {portalName(r.channel)} — {r.status === "ok" ? "Publiée" : r.message}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", border: `1px solid ${C.border}`, borderRadius: 9,
            backgroundColor: "transparent", color: C.text2, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            Fermer
          </button>
          <button
            disabled={!anyChecked || publishing}
            onClick={handlePublish}
            style={{
              flex: 2, padding: "10px 0", border: "none", borderRadius: 9,
              backgroundColor: !anyChecked || publishing ? C.surface2 : C.orange,
              color: !anyChecked || publishing ? C.text3 : "#fff",
              fontSize: 13, fontWeight: 700, cursor: !anyChecked || publishing ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {publishing ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Diffusion…</> : "Diffuser"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ListingsPage() {
  const [showNew, setShowNew]   = useState(false);
  const [diffuserListing, setDiffuserListing] = useState<Listing | null>(null);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<string>("all");
  const qc = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["listings"],
    queryFn: () => api.get<{ items: Listing[] }>("/listings").then(r => r.data),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/listings/${id}`, { status }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["listings"] }),
  });

  const items = (data?.items ?? []).filter(l =>
    (filter === "all" || l.status === filter) &&
    l.title.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total:    data?.items?.length ?? 0,
    active:   data?.items?.filter(l => l.status === "active").length ?? 0,
    views:    data?.items?.reduce((a, l) => a + l.views_count, 0) ?? 0,
    inquiries:data?.items?.reduce((a, l) => a + l.inquiries_count, 0) ?? 0,
  };

  return (
    <div style={{ padding: "28px 24px", maxWidth: 1100, margin: "0 auto" }}>
      {showNew && <NewListingModal onClose={() => setShowNew(false)} />}
      {diffuserListing && <DiffuserModal listing={diffuserListing} onClose={() => setDiffuserListing(null)} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>Annonces</h1>
          <p style={{ margin: 0, color: C.text3, fontSize: 13.5 }}>Gérez vos annonces et leur diffusion sur Flatfox, Homegate, ImmoScout24, immobilier.ch.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", backgroundColor: C.orange, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
        >
          <Plus size={15} /> Nouvelle annonce
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Annonces totales", value: stats.total, color: C.text },
          { label: "Actives",          value: stats.active, color: C.green },
          { label: "Vues totales",     value: stats.views, color: C.orange },
          { label: "Demandes reçues",  value: stats.inquiries, color: "var(--althy-blue)" },
        ].map(k => (
          <div key={k.label} style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} color={C.text3} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une annonce…"
            style={{ width: "100%", padding: "8px 12px 8px 30px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, backgroundColor: C.surface, color: C.text, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["all","Toutes"],["active","Actives"],["draft","Brouillons"],["paused","Pausées"]].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{ padding: "7px 14px", border: `1px solid ${filter === v ? C.orange : C.border}`, borderRadius: 20, fontSize: 12, fontWeight: filter === v ? 600 : 400, backgroundColor: filter === v ? C.orangeBg : "transparent", color: filter === v ? C.orange : C.text3, cursor: "pointer" }}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* Listings */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60, color: C.text3 }}>Chargement…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: C.text }}>Aucune annonce</h3>
          <p style={{ color: C.text3, fontSize: 13, margin: "0 0 20px" }}>Créez votre première annonce et diffusez-la sur Flatfox, Homegate, ImmoScout24 et immobilier.ch.</p>
          <button onClick={() => setShowNew(true)} style={{ padding: "10px 24px", backgroundColor: C.orange, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            Créer une annonce
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map(listing => {
            const sc = STATUS_CONFIG[listing.status] ?? STATUS_CONFIG.draft;
            return (
              <div key={listing.id} style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: C.shadow }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{listing.title}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 600, backgroundColor: sc.bg, color: sc.color, flexShrink: 0 }}>{sc.label}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10.5, backgroundColor: C.surface2, color: C.text3, flexShrink: 0 }}>
                      {listing.listing_type === "rental" ? "Location" : "Vente"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: C.text3 }}>
                    <span style={{ fontWeight: 600, color: C.orange }}>
                      {listing.listing_type === "rental" && listing.monthly_rent ? fmt(listing.monthly_rent) + "/mois" : listing.sale_price ? fmt(listing.sale_price) : "—"}
                    </span>
                    <span>{listing.views_count} vues</span>
                    <span>{listing.inquiries_count} demandes</span>
                  </div>
                  {/* Portal badges */}
                  <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                    {PORTALS.map(p => (
                      <span key={p.key} style={{
                        padding: "2px 8px", borderRadius: 6, fontSize: 10.5,
                        backgroundColor: (listing as unknown as Record<string, boolean>)[p.key] ? C.greenBg : C.surface2,
                        color: (listing as unknown as Record<string, boolean>)[p.key] ? C.green : C.text3,
                        fontWeight: 500,
                      }}>
                        {p.logo} {p.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => toggleStatus.mutate({ id: listing.id, status: listing.status === "active" ? "paused" : "active" })}
                    title={listing.status === "active" ? "Mettre en pause" : "Activer"}
                    style={{ padding: "6px 10px", border: `1px solid ${C.border}`, borderRadius: 8, backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    {listing.status === "active" ? <Pause size={14} color={C.amber} /> : <Play size={14} color={C.green} />}
                  </button>
                  <button
                    onClick={() => setDiffuserListing(listing)}
                    style={{ padding: "6px 12px", border: `1px solid ${C.orange}`, borderRadius: 8, backgroundColor: C.orangeBg, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.orange, fontWeight: 600 }}
                  >
                    <ExternalLink size={13} /> Diffuser
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Portals info */}
      <div style={{ marginTop: 32, backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.text }}>Portails disponibles</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {PORTALS.map(p => (
            <div key={p.key} style={{ padding: "14px 16px", border: `1px solid ${C.border}`, borderRadius: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{p.logo}</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: C.text3 }}>{p.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
