"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Building2, Home, MapPin, Search, Heart } from "lucide-react";
import { useProperties } from "@/lib/hooks/useProperties";
import { api } from "@/lib/api";
import type { Property, PropertyStatus } from "@/lib/types";

// ── Design tokens ─────────────────────────────────────────────────────────────

const S = {
  orange:   "var(--althy-orange)",
  orangeBg: "var(--althy-orange-bg, rgba(232,96,44,0.08))",
  surface:  "var(--althy-surface)",
  border:   "var(--althy-border)",
  text:     "var(--althy-text)",
  text3:    "var(--althy-text-3)",
  greenBg:  "var(--althy-green-bg, #EBF4E8)",
  green:    "var(--althy-green, #2E5E22)",
  blueBg:   "var(--althy-blue-bg, #EFF6FF)",
  blue:     "var(--althy-blue, #1D4ED8)",
  amberBg:  "var(--althy-amber-bg, #FEF3C7)",
  amber:    "var(--althy-amber, #B45309)",
  redBg:    "var(--althy-red-bg, #FDECEA)",
  red:      "var(--althy-red, #C0392B)",
};

const TYPE_LABEL: Record<string, string> = {
  apartment:  "Appartement",
  villa:      "Villa",
  parking:    "Parking",
  garage:     "Garage",
  box:        "Box",
  cave:       "Cave",
  depot:      "Dépôt",
  office:     "Bureau",
  commercial: "Commercial",
  hotel:      "Hôtel",
};

const STATUS_STYLE: Record<PropertyStatus, { label: string; bg: string; fg: string }> = {
  available:   { label: "Libre",      bg: S.greenBg, fg: S.green  },
  rented:      { label: "Loué",       bg: S.blueBg,  fg: S.blue   },
  for_sale:    { label: "À vendre",   bg: S.amberBg, fg: S.amber  },
  sold:        { label: "Vendu",      bg: "var(--althy-border)", fg: S.text3 },
  maintenance: { label: "Rénovation", bg: S.redBg,   fg: S.red    },
};

// ── BienCard ──────────────────────────────────────────────────────────────────

function BienCard({
  bien,
  isFav,
  onToggleFavorite,
}: {
  bien: Property;
  isFav: boolean;
  onToggleFavorite: (e: React.MouseEvent, bien: Property) => void;
}) {
  const st = STATUS_STYLE[bien.status] ?? { label: bien.status, bg: "var(--althy-border)", fg: S.text3 };
  const cover = bien.images?.find(i => i.is_cover)?.url ?? bien.images?.[0]?.url;

  return (
    <Link href={`/app/biens/${bien.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        style={{
          background: S.surface, borderRadius: 14,
          border: "1px solid var(--althy-border)",
          boxShadow: "0 1px 4px rgba(26,22,18,0.04)",
          overflow: "hidden", cursor: "pointer",
          transition: "box-shadow 0.18s, transform 0.18s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(26,22,18,0.1)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(26,22,18,0.04)";
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        }}
      >
        {/* Photo */}
        <div style={{ height: 140, background: "var(--althy-bg)", position: "relative", overflow: "hidden" }}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={bien.address} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Home size={32} color="var(--althy-border)" />
            </div>
          )}

          {/* Status badge */}
          <span style={{
            position: "absolute", top: 10, right: 10,
            padding: "3px 10px", borderRadius: 20,
            background: st.bg, color: st.fg,
            fontSize: 10, fontWeight: 700,
          }}>
            {st.label}
          </span>

          {/* Favorite button */}
          <button
            onClick={e => onToggleFavorite(e, bien)}
            title={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
            style={{
              position: "absolute", top: 8, left: 10,
              background: "rgba(255,255,255,0.88)",
              border: "none", borderRadius: "50%",
              width: 30, height: 30, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(4px)",
              transition: "transform 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.15)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
          >
            <Heart
              size={14}
              fill={isFav ? "var(--althy-orange)" : "none"}
              color={isFav ? "var(--althy-orange)" : "var(--althy-text-3)"}
            />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "14px 16px" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: S.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {bien.address || "Adresse non renseignée"}
          </p>
          {bien.city && (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: S.text3, display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={10} /> {bien.city}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: S.text3 }}>{TYPE_LABEL[bien.type] ?? bien.type}</span>
            {bien.surface != null && <span style={{ fontSize: 11, color: S.text3 }}>· {bien.surface} m²</span>}
            {bien.rooms != null && <span style={{ fontSize: 11, color: S.text3 }}>· {bien.rooms} p.</span>}
          </div>
          {bien.monthly_rent != null && (
            <p style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 700, color: S.orange }}>
              CHF {bien.monthly_rent.toLocaleString("fr-CH")} / mois
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const FILTRES: { key: PropertyStatus | ""; label: string }[] = [
  { key: "",            label: "Tous"        },
  { key: "available",   label: "Libres"      },
  { key: "rented",      label: "Loués"       },
  { key: "for_sale",    label: "À vendre"    },
  { key: "maintenance", label: "Rénovation"  },
];

const TABS = [
  { key: "tous",     label: "Tous mes biens" },
  { key: "favoris",  label: "Favoris"        },
  { key: "archives", label: "Archivés"       },
];

function BiensPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab") || "tous";

  const [filtre, setFiltre] = useState<PropertyStatus | "">("");
  const [search, setSearch] = useState("");

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Property[]>([]);
  const [favLoading, setFavLoading] = useState(false);

  // Load favorites on mount
  useEffect(() => {
    setFavLoading(true);
    api.get<{ items?: Property[]; data?: Property[] } | Property[]>("/favorites")
      .then(r => {
        const raw = r.data;
        const items: Property[] = Array.isArray(raw)
          ? raw
          : (raw as { items?: Property[] }).items ?? (raw as { data?: Property[] }).data ?? [];
        setFavorites(items);
        setFavoriteIds(new Set(items.map(f => f.id)));
      })
      .catch(() => {})
      .finally(() => setFavLoading(false));
  }, []);

  const { data, isLoading } = useProperties(
    tab === "archives"
      ? { status: "sold" }
      : filtre
        ? { status: filtre }
        : {}
  );

  const biens: Property[] = data?.items ?? [];

  const filtered = biens.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.address.toLowerCase().includes(q) || b.city?.toLowerCase().includes(q);
  });

  const filteredFavorites = favorites.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.address.toLowerCase().includes(q) || b.city?.toLowerCase().includes(q);
  });

  function setTab(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.push(`/app/biens?${params.toString()}`);
  }

  async function toggleFavorite(e: React.MouseEvent, bien: Property) {
    e.preventDefault();
    e.stopPropagation();
    const isFav = favoriteIds.has(bien.id);
    if (isFav) {
      setFavoriteIds(prev => { const s = new Set(prev); s.delete(bien.id); return s; });
      setFavorites(prev => prev.filter(f => f.id !== bien.id));
      try {
        await api.delete(`/favorites/${bien.id}`);
      } catch {
        setFavoriteIds(prev => new Set([...prev, bien.id]));
        setFavorites(prev => [...prev, bien]);
      }
    } else {
      setFavoriteIds(prev => new Set([...prev, bien.id]));
      setFavorites(prev => [...prev, bien]);
      try {
        await api.post("/favorites", { property_id: bien.id });
      } catch {
        setFavoriteIds(prev => { const s = new Set(prev); s.delete(bien.id); return s; });
        setFavorites(prev => prev.filter(f => f.id !== bien.id));
      }
    }
  }

  const displayList = tab === "favoris" ? filteredFavorites : filtered;
  const displayLoading = tab === "favoris" ? favLoading : isLoading;
  const totalCount = tab === "favoris" ? favorites.length : biens.length;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Cormorant Garamond, serif", fontSize: 30, fontWeight: 300, color: S.text }}>
            Mes biens
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: S.text3 }}>
            {displayLoading
              ? "Chargement…"
              : `${totalCount} bien${totalCount !== 1 ? "s" : ""}${tab === "favoris" ? " en favori" : tab === "archives" ? " archivé" : " enregistré"}${totalCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/app/biens/nouveau"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, background: S.orange, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          <Plus size={14} /> Ajouter un bien
        </Link>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--althy-border)", paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 18px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? S.orange : S.text3,
              borderBottom: `2px solid ${tab === t.key ? S.orange : "transparent"}`,
              marginBottom: -1,
              transition: "color 0.15s",
            }}
          >
            {t.label}
            {t.key === "favoris" && favorites.length > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 10, fontWeight: 700,
                background: S.orangeBg, color: S.orange,
                padding: "1px 6px", borderRadius: 10,
              }}>
                {favorites.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Filters + Search (hidden on Favoris & Archives tabs) ── */}
      {tab === "tous" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FILTRES.map(f => (
              <button
                key={f.key}
                onClick={() => setFiltre(f.key)}
                style={{
                  padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                  border: `1px solid ${filtre === f.key ? S.orange : "var(--althy-border)"}`,
                  background: filtre === f.key ? S.orangeBg : S.surface,
                  color: filtre === f.key ? S.orange : S.text3,
                  fontSize: 12, fontWeight: 600,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: S.surface, border: "1px solid var(--althy-border)", borderRadius: 10, flex: 1, minWidth: 200 }}>
            <Search size={13} color="var(--althy-text-3)" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par adresse ou ville…"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: S.text, fontFamily: "inherit" }}
            />
          </div>
        </div>
      )}

      {/* Search bar on Favoris tab */}
      {tab === "favoris" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: S.surface, border: "1px solid var(--althy-border)", borderRadius: 10, marginBottom: 20 }}>
          <Search size={13} color="var(--althy-text-3)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher parmi vos favoris…"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: S.text, fontFamily: "inherit" }}
          />
        </div>
      )}

      {/* ── Grid ── */}
      {displayLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 260, borderRadius: 14, background: "var(--althy-border)", opacity: 0.35 }} />
          ))}
        </div>
      ) : displayList.length === 0 ? (
        <div style={{ background: S.surface, border: "1px solid var(--althy-border)", borderRadius: 14, padding: "56px 24px", textAlign: "center" }}>
          {tab === "favoris" ? (
            <>
              <Heart size={40} color="var(--althy-border)" style={{ margin: "0 auto 16px" }} />
              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: S.text }}>
                {search ? "Aucun résultat" : "Aucun favori enregistré"}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: S.text3 }}>
                {search ? "Essayez un autre terme." : "Cliquez sur le cœur d'un bien pour l'ajouter à vos favoris."}
              </p>
            </>
          ) : (
            <>
              <Building2 size={40} color="var(--althy-border)" style={{ margin: "0 auto 16px" }} />
              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: S.text }}>
                {search ? "Aucun résultat" : tab === "archives" ? "Aucun bien archivé" : "Aucun bien enregistré"}
              </h3>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: S.text3 }}>
                {search ? "Essayez un autre terme de recherche." : tab === "archives" ? "Les biens vendus apparaîtront ici." : "Ajoutez votre premier bien pour commencer."}
              </p>
              {!search && tab === "tous" && (
                <Link href="/app/biens/nouveau" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 10, background: S.orange, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                  <Plus size={14} /> Ajouter un bien
                </Link>
              )}
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {displayList.map(b => (
            <BienCard
              key={b.id}
              bien={b}
              isFav={favoriteIds.has(b.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function BiensPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ height: 40, borderRadius: 8, background: "var(--althy-border)", opacity: 0.35, marginBottom: 24, width: 200 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 260, borderRadius: 14, background: "var(--althy-border)", opacity: 0.35 }} />
          ))}
        </div>
      </div>
    }>
      <BiensPageInner />
    </Suspense>
  );
}
