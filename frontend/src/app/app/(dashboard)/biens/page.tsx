"use client";

import Link from "next/link";
import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Building2, Home, MapPin, Search, Heart, Map as MapIcon } from "lucide-react";
import { useBiensList } from "@/lib/hooks/useBiens";
import { api } from "@/lib/api";
import type { BienImage, BienListItem, BienStatut } from "@/lib/types";
import { AlthyMap, type AlthyMapMarker } from "@/components/map/AlthyMap";
import { C } from "@/lib/design-tokens";

// ── Coordonnées par ville (fallback) ──────────────────────────────────────────

const CITY_COORDS: Record<string, [number, number]> = {
  "genève":    [6.143, 46.204], "geneve":    [6.143, 46.204],
  "lausanne":  [6.632, 46.519],
  "fribourg":  [7.161, 46.806],
  "neuchâtel": [6.931, 46.992], "neuchatel": [6.931, 46.992],
  "sion":      [7.359, 46.233],
  "nyon":      [6.239, 46.383], "montreux":  [6.911, 46.433],
  "vevey":     [6.844, 46.461], "yverdon":   [6.641, 46.778],
  "morges":    [6.499, 46.512], "renens":    [6.589, 46.537],
  "carouge":   [6.140, 46.185], "meyrin":    [6.079, 46.233],
};

function cityCoords(city: string | null | undefined): [number, number] | null {
  if (!city) return null;
  const key = city.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const direct = CITY_COORDS[city.toLowerCase()];
  if (direct) return direct;
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    const kn = k.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (kn === key) return v;
  }
  return null;
}

// ── Type local favoris (shape aplatie FavoriteRead backend, non exportée) ─────
// Aligné sur backend/app/routers/favorites.py :: FavoriteRead. Distinct de
// BienListItem — les favoris sont dénormalisés (pas d'images, champs préfixés
// bien_*) et on préserve l'id du favori pour le DELETE /favorites/{favorite_id}.

type FavoriteItem = {
  id: string;                   // id du FAVORI (≠ bien_id)
  bien_id: string;
  notes: string | null;
  created_at: string;
  bien_adresse: string | null;
  bien_ville: string | null;
  bien_type: string | null;
  loyer: number | null;
  rooms: number | null;
  surface: number | null;
  bien_statut: string | null;
};

// ── Shape affichable BienCard — sous-ensemble partagé biens liste + favoris ───

type DisplayBien = {
  id: string;
  adresse: string;
  ville: string | null;
  type: string;
  statut: string;
  loyer: number | null;
  surface: number | null;
  rooms: number | null;
  images: BienImage[];
  favorite_id?: string;         // rempli uniquement sur l'onglet Favoris
};

function adaptBien(b: BienListItem): DisplayBien {
  return {
    id:       b.id,
    adresse:  b.adresse,
    ville:    b.ville,
    type:     b.type,
    statut:   b.statut,
    loyer:    b.loyer,
    surface:  b.surface,
    rooms:    b.rooms,
    images:   b.images,
  };
}

function adaptFavorite(f: FavoriteItem): DisplayBien {
  return {
    id:          f.bien_id,
    adresse:     f.bien_adresse ?? "",
    ville:       f.bien_ville,
    type:        f.bien_type ?? "autre",
    statut:      f.bien_statut ?? "vacant",
    loyer:       f.loyer,
    surface:     f.surface,
    rooms:       f.rooms,
    images:      [],              // endpoint /favorites ne renvoie pas les photos
    favorite_id: f.id,
  };
}

// ── Labels type (10 clés FR alignées bien_type_enum) ──────────────────────────

const TYPE_LABEL: Record<string, string> = {
  appartement: "Appartement",
  villa:       "Villa",
  studio:      "Studio",
  maison:      "Maison",
  commerce:    "Commerce",
  bureau:      "Bureau",
  parking:     "Parking",
  garage:      "Garage",
  cave:        "Cave",
  autre:       "Autre",
};

const STATUS_STYLE: Record<BienStatut, { label: string; bg: string; fg: string }> = {
  vacant:     { label: "Libre",      bg: C.greenBg, fg: C.green  },
  loue:       { label: "Loué",       bg: C.blueBg,  fg: C.blue   },
  en_travaux: { label: "Rénovation", bg: C.redBg,   fg: C.red    },
};

// ── BienCard ──────────────────────────────────────────────────────────────────

function BienCard({
  bien,
  isFav,
  onToggleFavorite,
}: {
  bien: DisplayBien;
  isFav: boolean;
  onToggleFavorite: (e: React.MouseEvent, bien: DisplayBien) => void;
}) {
  const st = STATUS_STYLE[bien.statut as BienStatut] ?? { label: bien.statut, bg: "var(--border-subtle)", fg: C.text3 };
  const cover = bien.images.find(i => i.is_cover)?.url ?? bien.images[0]?.url;

  return (
    <Link href={`/app/biens/${bien.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        style={{
          background: C.surface, borderRadius: 14,
          border: "1px solid var(--border-subtle)",
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
        <div style={{ height: 140, background: "var(--cream)", position: "relative", overflow: "hidden" }}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={bien.adresse} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Home size={32} color="var(--border-subtle)" />
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
              fill={isFav ? "var(--terracotta-primary)" : "none"}
              color={isFav ? "var(--terracotta-primary)" : "var(--text-tertiary)"}
            />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "14px 16px" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {bien.adresse || "Adresse non renseignée"}
          </p>
          {bien.ville && (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: C.text3, display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={10} /> {bien.ville}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: C.text3 }}>{TYPE_LABEL[bien.type] ?? bien.type}</span>
            {bien.surface != null && <span style={{ fontSize: 11, color: C.text3 }}>· {bien.surface} m²</span>}
            {bien.rooms != null && <span style={{ fontSize: 11, color: C.text3 }}>· {bien.rooms} p.</span>}
          </div>
          {bien.loyer != null && (
            <p style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 700, color: C.orange }}>
              CHF {bien.loyer.toLocaleString("fr-CH")} / mois
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const FILTRES: { key: BienStatut | ""; label: string }[] = [
  { key: "",           label: "Tous"        },
  { key: "vacant",     label: "Libres"      },
  { key: "loue",       label: "Loués"       },
  { key: "en_travaux", label: "Rénovation"  },
];

const TABS = [
  { key: "tous",    label: "Tous mes biens" },
  { key: "favoris", label: "Favoris"        },
];

function BiensPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get("tab") || "tous";

  const [filtre,     setFiltre]     = useState<BienStatut | "">("");
  const [search,     setSearch]     = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMap,    setShowMap]    = useState(true);

  // Favoris — bien_id → favorite_id pour permettre DELETE /favorites/{favorite_id}
  const [favoriteBienIds, setFavoriteBienIds] = useState<Set<string>>(new Set());
  const [favMap,          setFavMap]          = useState<Map<string, string>>(new Map());
  const [favorites,       setFavorites]       = useState<FavoriteItem[]>([]);
  const [favLoading,      setFavLoading]      = useState(false);

  useEffect(() => {
    setFavLoading(true);
    api.get<FavoriteItem[] | { items?: FavoriteItem[]; data?: FavoriteItem[] }>("/favorites")
      .then(r => {
        const raw = r.data;
        const items: FavoriteItem[] = Array.isArray(raw)
          ? raw
          : (raw as { items?: FavoriteItem[] }).items ?? (raw as { data?: FavoriteItem[] }).data ?? [];
        setFavorites(items);
        setFavoriteBienIds(new Set(items.map(f => f.bien_id)));
        setFavMap(new Map(items.map(f => [f.bien_id, f.id])));
      })
      .catch(err => console.error("GET /favorites failed", err))
      .finally(() => setFavLoading(false));
  }, []);

  const { data, isLoading } = useBiensList(filtre ? { statut: filtre } : {});

  const biens: BienListItem[] = data?.items ?? [];

  const filtered: DisplayBien[] = biens
    .filter(b => {
      if (!search) return true;
      const q = search.toLowerCase();
      return b.adresse.toLowerCase().includes(q) || b.ville.toLowerCase().includes(q);
    })
    .map(adaptBien);

  const filteredFavorites: DisplayBien[] = favorites
    .filter(f => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (f.bien_adresse ?? "").toLowerCase().includes(q)
        || (f.bien_ville ?? "").toLowerCase().includes(q);
    })
    .map(adaptFavorite);

  function setTab(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    router.push(`/app/biens?${params.toString()}`);
  }

  async function toggleFavorite(e: React.MouseEvent, bien: DisplayBien) {
    e.preventDefault();
    e.stopPropagation();
    const isFav = favoriteBienIds.has(bien.id);

    if (isFav) {
      const favoriteId = favMap.get(bien.id);
      const removed = favorites.find(f => f.bien_id === bien.id);
      // Optimistic remove
      setFavoriteBienIds(prev => { const s = new Set(prev); s.delete(bien.id); return s; });
      setFavMap(prev => { const m = new Map(prev); m.delete(bien.id); return m; });
      setFavorites(prev => prev.filter(f => f.bien_id !== bien.id));
      try {
        if (!favoriteId) throw new Error(`favorite_id absent pour bien ${bien.id}`);
        await api.delete(`/favorites/${favoriteId}`);
      } catch (err) {
        console.error("DELETE /favorites failed", err);
        setFavoriteBienIds(prev => new Set([...prev, bien.id]));
        if (favoriteId) setFavMap(prev => new Map(prev).set(bien.id, favoriteId));
        if (removed) setFavorites(prev => [...prev, removed]);
      }
    } else {
      // Optimistic add (favorite_id inconnu tant que le POST n'a pas répondu)
      setFavoriteBienIds(prev => new Set([...prev, bien.id]));
      try {
        const { data: created } = await api.post<FavoriteItem>("/favorites", { bien_id: bien.id });
        setFavMap(prev => new Map(prev).set(bien.id, created.id));
        setFavorites(prev => [...prev, created]);
      } catch (err) {
        console.error("POST /favorites failed", err);
        setFavoriteBienIds(prev => { const s = new Set(prev); s.delete(bien.id); return s; });
      }
    }
  }

  const displayList     = tab === "favoris" ? filteredFavorites : filtered;
  const displayLoading  = tab === "favoris" ? favLoading        : isLoading;
  const totalCount      = tab === "favoris" ? favorites.length  : biens.length;

  // Markers carte
  const mapMarkers = useMemo<AlthyMapMarker[]>(() => {
    return displayList
      .filter(b => cityCoords(b.ville) !== null)
      .map(b => {
        const [lng, lat] = cityCoords(b.ville)!;
        const label = b.loyer
          ? `CHF ${b.loyer.toLocaleString("fr-CH")} / mois`
          : b.adresse;
        return { id: b.id, lng, lat, label, sublabel: b.ville ?? undefined };
      });
  }, [displayList]);

  return (
    <div style={{ maxWidth: "100%", margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 300, color: C.text }}>
            Mes biens
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.text3 }}>
            {displayLoading
              ? "Chargement…"
              : `${totalCount} bien${totalCount !== 1 ? "s" : ""}${tab === "favoris" ? " en favori" : " enregistré"}${totalCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowMap(v => !v)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 10,
              background: showMap ? C.orangeBg : C.surface,
              color: showMap ? C.orange : C.text3,
              border: `1px solid ${showMap ? C.orange : C.border}`,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <MapIcon size={14} /> Carte
          </button>
          <Link
            href="/app/biens/nouveau"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, background: C.orange, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
          >
            <Plus size={14} /> Ajouter un bien
          </Link>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 0 }}>
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
              color: tab === t.key ? C.orange : C.text3,
              borderBottom: `2px solid ${tab === t.key ? C.orange : "transparent"}`,
              marginBottom: -1,
              transition: "color 0.15s",
            }}
          >
            {t.label}
            {t.key === "favoris" && favorites.length > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 10, fontWeight: 700,
                background: C.orangeBg, color: C.orange,
                padding: "1px 6px", borderRadius: 10,
              }}>
                {favorites.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Filters + Search (hidden on Favoris tab) ── */}
      {tab === "tous" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FILTRES.map(f => (
              <button
                key={f.key}
                onClick={() => setFiltre(f.key)}
                style={{
                  padding: "6px 14px", borderRadius: 20, cursor: "pointer",
                  border: `1px solid ${filtre === f.key ? C.orange : "var(--border-subtle)"}`,
                  background: filtre === f.key ? C.orangeBg : C.surface,
                  color: filtre === f.key ? C.orange : C.text3,
                  fontSize: 12, fontWeight: 600,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: C.surface, border: "1px solid var(--border-subtle)", borderRadius: 10, flex: 1, minWidth: 200 }}>
            <Search size={13} color="var(--text-tertiary)" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par adresse ou ville…"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: C.text, fontFamily: "inherit" }}
            />
          </div>
        </div>
      )}

      {/* Search bar on Favoris tab */}
      {tab === "favoris" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: C.surface, border: "1px solid var(--border-subtle)", borderRadius: 10, marginBottom: 20 }}>
          <Search size={13} color="var(--text-tertiary)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher parmi vos favoris…"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: C.text, fontFamily: "inherit" }}
          />
        </div>
      )}

      {/* ── Layout split liste + carte ── */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* Liste */}
        <div style={{ flex: showMap ? "0 0 420px" : "1 1 100%", minWidth: 0, maxHeight: showMap ? "calc(100vh - 220px)" : "none", overflowY: showMap ? "auto" : "visible" }}>
          {displayLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 260, borderRadius: 14, background: "var(--border-subtle)", opacity: 0.35 }} />
              ))}
            </div>
          ) : displayList.length === 0 ? (
            <div style={{ background: C.surface, border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "56px 24px", textAlign: "center" }}>
              {tab === "favoris" ? (
                <>
                  <Heart size={40} color="var(--border-subtle)" style={{ margin: "0 auto 16px" }} />
                  <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: C.text }}>
                    {search ? "Aucun résultat" : "Aucun favori enregistré"}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: C.text3 }}>
                    {search ? "Essayez un autre terme." : "Cliquez sur le cœur d'un bien pour l'ajouter à vos favoris."}
                  </p>
                </>
              ) : (
                <>
                  <Building2 size={40} color="var(--border-subtle)" style={{ margin: "0 auto 16px" }} />
                  <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: C.text }}>
                    {search ? "Aucun résultat" : "Aucun bien enregistré"}
                  </h3>
                  <p style={{ margin: "0 0 20px", fontSize: 13, color: C.text3 }}>
                    {search ? "Essayez un autre terme de recherche." : "Ajoutez votre premier bien pour commencer."}
                  </p>
                  {!search && (
                    <Link href="/app/biens/nouveau" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 10, background: C.orange, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                      <Plus size={14} /> Ajouter un bien
                    </Link>
                  )}
                </>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {displayList.map(b => (
                <BienCard
                  key={b.id}
                  bien={b}
                  isFav={favoriteBienIds.has(b.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          )}
        </div>

        {/* Carte sticky */}
        {showMap && (
          <div style={{
            flex: "1 1 0",
            position: "sticky",
            top: 20,
            height: "calc(100vh - 220px)",
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid var(--border-subtle)",
            boxShadow: "0 2px 16px rgba(26,22,18,0.07)",
          }}>
            <AlthyMap
              markers={mapMarkers}
              selectedId={selectedId}
              onMarkerClick={id => setSelectedId(id)}
              height="100%"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function BiensPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ height: 40, borderRadius: 8, background: "var(--border-subtle)", opacity: 0.35, marginBottom: 24, width: 200 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 260, borderRadius: 14, background: "var(--border-subtle)", opacity: 0.35 }} />
          ))}
        </div>
      </div>
    }>
      <BiensPageInner />
    </Suspense>
  );
}
