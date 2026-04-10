"use client";

import { useState } from "react";
import { Plus, ExternalLink, Eye, Edit2, Pause, Play, Search, Filter } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
  amber:    "var(--althy-amber)",
  amberBg:  "var(--althy-amber-bg)",
  shadow:   "var(--althy-shadow)",
  shadowMd: "var(--althy-shadow-md)",
} as const;

const STATUS_CONFIG = {
  draft:  { label: "Brouillon",  color: S.text3,  bg: S.surface2 },
  active: { label: "Active",     color: S.green,  bg: S.greenBg  },
  paused: { label: "Pausée",     color: S.amber,  bg: S.amberBg  },
  closed: { label: "Fermée",     color: S.text3,  bg: S.surface2 },
};

// Commission Althy : 4% sur tous les flux financiers transitant par la plateforme
// Si paiement direct au portail : Althy facture ses 4% séparément au client
const PORTALS = [
  { key: "on_homegate",  name: "Homegate",  logo: "🏠", price: "Tarif Homegate",    note: "4% Althy si paiement via plateforme" },
  { key: "on_immoscout", name: "ImmoScout", logo: "🔍", price: "Tarif ImmoScout",   note: "4% Althy si paiement via plateforme" },
  { key: "on_booking",   name: "Booking",   logo: "📅", price: "Commission Booking", note: "4% Althy sur réservations reçues" },
  { key: "on_airbnb",    name: "Airbnb",    logo: "🌟", price: "Commission Airbnb",  note: "4% Althy sur réservations reçues" },
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
  on_homegate: boolean;
  on_immoscout: boolean;
  on_booking: boolean;
  on_airbnb: boolean;
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
        backgroundColor: S.surface, borderRadius: 20, padding: 28,
        width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: S.text }}>Nouvelle annonce</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: S.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Titre</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Appartement 3.5 pièces, Genève Eaux-Vives"
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${S.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: S.surface2, color: S.text, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: S.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Type</label>
              <select value={form.listing_type} onChange={e => setForm(f => ({ ...f, listing_type: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${S.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: S.surface2, color: S.text, outline: "none", appearance: "none" }}>
                <option value="rental">Location</option>
                <option value="sale">Vente</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: S.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {form.listing_type === "rental" ? "Loyer/mois (CHF)" : "Prix de vente (CHF)"}
              </label>
              <input type="number"
                value={form.listing_type === "rental" ? form.monthly_rent : form.sale_price}
                onChange={e => setForm(f => form.listing_type === "rental" ? { ...f, monthly_rent: e.target.value } : { ...f, sale_price: e.target.value })}
                placeholder={form.listing_type === "rental" ? "1 800" : "750 000"}
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${S.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: S.surface2, color: S.text, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: S.text3, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} placeholder="Description du bien (optionnel — l'IA peut la générer)"
              style={{ width: "100%", padding: "9px 12px", border: `1px solid ${S.border}`, borderRadius: 9, fontSize: 13.5, backgroundColor: S.surface2, color: S.text, outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", border: `1px solid ${S.border}`, borderRadius: 9, backgroundColor: "transparent", color: S.text2, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
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
            style={{ flex: 2, padding: "10px 0", border: "none", borderRadius: 9, backgroundColor: S.orange, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {mutation.isPending ? "Création…" : "Créer l'annonce"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ListingsPage() {
  const [showNew, setShowNew]   = useState(false);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<string>("all");
  const qc = useQueryClient();

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

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: S.text, letterSpacing: "-0.02em" }}>Annonces</h1>
          <p style={{ margin: 0, color: S.text3, fontSize: 13.5 }}>Gérez vos annonces et leur diffusion sur Homegate, ImmoScout, Booking, Airbnb.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", backgroundColor: S.orange, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
        >
          <Plus size={15} /> Nouvelle annonce
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Annonces totales", value: stats.total, color: S.text },
          { label: "Actives",          value: stats.active, color: S.green },
          { label: "Vues totales",     value: stats.views, color: S.orange },
          { label: "Demandes reçues",  value: stats.inquiries, color: "var(--althy-blue)" },
        ].map(k => (
          <div key={k.label} style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: "16px 18px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: S.text3, marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} color={S.text3} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une annonce…"
            style={{ width: "100%", padding: "8px 12px 8px 30px", border: `1px solid ${S.border}`, borderRadius: 9, fontSize: 13, backgroundColor: S.surface, color: S.text, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["all","Toutes"],["active","Actives"],["draft","Brouillons"],["paused","Pausées"]].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{ padding: "7px 14px", border: `1px solid ${filter === v ? S.orange : S.border}`, borderRadius: 20, fontSize: 12, fontWeight: filter === v ? 600 : 400, backgroundColor: filter === v ? S.orangeBg : "transparent", color: filter === v ? S.orange : S.text3, cursor: "pointer" }}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* Listings */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60, color: S.text3 }}>Chargement…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: S.text }}>Aucune annonce</h3>
          <p style={{ color: S.text3, fontSize: 13, margin: "0 0 20px" }}>Créez votre première annonce et diffusez-la sur Homegate, ImmoScout, Booking et Airbnb.</p>
          <button onClick={() => setShowNew(true)} style={{ padding: "10px 24px", backgroundColor: S.orange, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            Créer une annonce
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map(listing => {
            const sc = STATUS_CONFIG[listing.status] ?? STATUS_CONFIG.draft;
            return (
              <div key={listing.id} style={{ backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: S.shadow }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: S.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{listing.title}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 600, backgroundColor: sc.bg, color: sc.color, flexShrink: 0 }}>{sc.label}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10.5, backgroundColor: S.surface2, color: S.text3, flexShrink: 0 }}>
                      {listing.listing_type === "rental" ? "Location" : "Vente"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: S.text3 }}>
                    <span style={{ fontWeight: 600, color: S.orange }}>
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
                        backgroundColor: (listing as unknown as Record<string, boolean>)[p.key] ? S.greenBg : S.surface2,
                        color: (listing as unknown as Record<string, boolean>)[p.key] ? S.green : S.text3,
                        fontWeight: 500,
                      }}>
                        {p.logo} {p.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button style={{ padding: "6px 10px", border: `1px solid ${S.border}`, borderRadius: 8, backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    <Eye size={14} color={S.text3} />
                  </button>
                  <button style={{ padding: "6px 10px", border: `1px solid ${S.border}`, borderRadius: 8, backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    <Edit2 size={14} color={S.text3} />
                  </button>
                  <button
                    onClick={() => toggleStatus.mutate({ id: listing.id, status: listing.status === "active" ? "paused" : "active" })}
                    style={{ padding: "6px 10px", border: `1px solid ${S.border}`, borderRadius: 8, backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center" }}
                  >
                    {listing.status === "active" ? <Pause size={14} color={S.amber} /> : <Play size={14} color={S.green} />}
                  </button>
                  <button style={{ padding: "6px 12px", border: `1px solid ${S.orange}`, borderRadius: 8, backgroundColor: S.orangeBg, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: S.orange, fontWeight: 600 }}>
                    <ExternalLink size={13} /> Diffuser
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Portals info */}
      <div style={{ marginTop: 32, backgroundColor: S.surface, border: `1px solid ${S.border}`, borderRadius: 16, padding: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: S.text }}>Portails disponibles</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {PORTALS.map(p => (
            <div key={p.key} style={{ padding: "14px 16px", border: `1px solid ${S.border}`, borderRadius: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{p.logo}</span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: S.text }}>{p.name}</div>
                <div style={{ fontSize: 12, color: S.orange, fontWeight: 600 }}>{p.price}</div>
                <div style={{ fontSize: 10.5, color: S.text3 }}>{p.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
