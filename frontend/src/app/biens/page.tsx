"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  MapPin,
  Ruler,
  Search,
  SlidersHorizontal,
  Star,
  X,
  Map as MapIcon,
  List,
  UserCircle,
} from "lucide-react";
import { useAuthStore } from "@/lib/store/authStore";
import { C } from "@/lib/design-tokens";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const PAGE_SIZE = 20;

type TxType = "location" | "vente" | "colocation" | "";

interface Bien {
  id: string;
  titre: string;
  transaction_type: "location" | "vente" | "colocation";
  prix: number | null;
  charges: number | null;
  adresse_affichee: string;
  ville: string;
  surface: number | null;
  pieces: number | null;
  type_label: string;
  cover: string | null;
  tags_ia: string[];
  is_premium: boolean;
  lat: number | null;
  lng: number | null;
}

const TX_LABEL: Record<string, string> = {
  "": "Tous",
  location: "Location",
  vente: "Vente",
  colocation: "Colocation",
};

const TX_COLOR: Record<string, string> = {
  location: C.orange,
  colocation: "var(--althy-purple)",
  vente: "#0EA5E9",
};

function fmt(n: number) {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(n);
}

// ── BienCard ──────────────────────────────────────────────────────────────────

function BienCard({
  bien,
  isHovered,
  onHover,
  priority = false,
}: {
  bien: Bien;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/biens/${bien.id}`}
      onMouseEnter={() => onHover(bien.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: "block",
        background: "var(--althy-surface)",
        border: `1.5px solid ${isHovered ? C.orange : "var(--althy-border)"}`,
        borderRadius: "var(--radius-card)",
        overflow: "hidden",
        textDecoration: "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: isHovered
          ? "0 4px 20px rgba(15,46,76,0.12)"
          : "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Photo */}
      <div
        style={{
          position: "relative",
          height: 156,
          background: "linear-gradient(135deg, #FEF2EB 0%, rgba(15,46,76,0.1) 100%)",
          flexShrink: 0,
        }}
      >
        {bien.cover ? (
          <Image
            src={bien.cover}
            alt={bien.titre}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            style={{ objectFit: "cover" }}
            priority={priority}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <Building2 size={36} color={C.orange} style={{ opacity: 0.35 }} />
          </div>
        )}

        <span
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: TX_COLOR[bien.transaction_type] || C.orange,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 4,
          }}
        >
          {TX_LABEL[bien.transaction_type] || bien.transaction_type}
        </span>

        {bien.is_premium && (
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "var(--althy-warning)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 7px",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Star size={10} fill="#fff" /> Premium
          </span>
        )}
      </div>

      {/* Contenu */}
      <div style={{ padding: "12px 14px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 3,
          }}
        >
          <span style={{ fontSize: 11, color: "var(--althy-text-3)", fontWeight: 500 }}>
            {bien.type_label}
          </span>
          {bien.prix && (
            <span style={{ fontSize: 15, fontWeight: 700, color: C.orange, whiteSpace: "nowrap" }}>
              {fmt(bien.prix)}
              {(bien.transaction_type === "location" || bien.transaction_type === "colocation") && (
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--althy-text-3)" }}>
                  /mois
                </span>
              )}
            </span>
          )}
        </div>

        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--althy-text)",
            margin: "0 0 6px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {bien.titre}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "var(--althy-text-3)",
            fontSize: 12,
            marginBottom: 8,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <MapPin size={11} /> {bien.adresse_affichee}
          </span>
          {bien.surface && (
            <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Ruler size={11} /> {bien.surface}m²
            </span>
          )}
          {bien.pieces && <span>{bien.pieces}p.</span>}
        </div>

        {bien.tags_ia.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {bien.tags_ia.slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{
                  background: "rgba(15,46,76,0.08)",
                  color: C.orange,
                  fontSize: 10,
                  padding: "2px 7px",
                  borderRadius: 20,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        height: 250,
        background: "var(--althy-border)",
        borderRadius: "var(--radius-card)",
        opacity: 0.35,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function BiensPage() {
  // ── État filtres ─────────────────────────────────────────────────────────────
  const { user } = useAuthStore();
  const isLoggedIn = !!user;

  const [txType, setTxType] = useState<TxType>("");
  const [villeInput, setVilleInput] = useState("");
  const [ville, setVille] = useState("");
  const [canton, setCanton] = useState("");
  const [prixMin, setPrixMin] = useState("");
  const [prixMax, setPrixMax] = useState("");
  const [pieces, setPieces] = useState<number | null>(null);
  const [surfaceMin, setSurfaceMin] = useState("");

  // ── État liste + pagination ──────────────────────────────────────────────────
  const [biens, setBiens] = useState<Bien[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // ── Mobile ───────────────────────────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Map refs ─────────────────────────────────────────────────────────────────
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const mapboxglRef = useRef<any>(null);
  const markerObjsRef = useRef<Map<string, any>>(new Map());
  const markerElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  // ── Sentinel for infinite scroll ─────────────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = biens.length < total;

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchPage = useCallback(
    async (p: number, reset: boolean) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);

      const params = new URLSearchParams({ page: String(p), size: String(PAGE_SIZE) });
      if (txType) params.set("transaction_type", txType);
      if (ville) params.set("ville", ville);
      if (canton) params.set("canton", canton);
      if (prixMin) params.set("prix_min", prixMin);
      if (prixMax) params.set("prix_max", prixMax);
      if (pieces) params.set("pieces", String(pieces));
      if (surfaceMin) params.set("surface_min", surfaceMin);

      try {
        const res = await fetch(`${API}/marketplace/biens?${params}`);
        if (res.ok) {
          const data = await res.json();
          if (reset) setBiens(data.items ?? []);
          else setBiens((prev) => [...prev, ...(data.items ?? [])]);
          setTotal(data.total ?? 0);
        }
      } catch {
        if (reset) setBiens([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [txType, ville, canton, prixMin, prixMax, pieces, surfaceMin]
  );

  // Reset on filter change
  useEffect(() => {
    setPage(1);
    setBiens([]);
    setTotal(0);
    fetchPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txType, ville, canton, prixMin, prixMax, pieces, surfaceMin]);

  // Load more when page increments (not on reset)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (page > 1) fetchPage(page, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // IntersectionObserver — infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loadingMore || loading) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setPage((p) => p + 1);
      },
      { threshold: 0.1, rootMargin: "200px" }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, biens.length]);

  // ── Init map (lazy) ──────────────────────────────────────────────────────────

  useEffect(() => {
    // On mobile, only init map when map view is active
    if (isMobile && mobileView !== "map") return;
    if (!mapContainerRef.current || !MAPBOX_TOKEN || mapRef.current) return;

    import("mapbox-gl").then((m) => {
      const mapboxgl = m.default;
      mapboxglRef.current = mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: "mapbox://styles/mapbox/light-v11",
        center: [7.5, 46.8],
        zoom: 7.2,
        minZoom: 5.5,
        maxZoom: 18,
        // Tile caching (default browser cache + Mapbox's CDN)
        localIdeographFontFamily: "",
        trackResize: true,
      });

      mapRef.current = map;
      map.on("load", () => setMapReady(true));
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, [isMobile, mobileView]);

  // ── Markers ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapboxglRef.current || !mapRef.current) return;

    const mapboxgl = mapboxglRef.current;
    const map = mapRef.current;

    markerObjsRef.current.forEach((m) => m.remove());
    markerObjsRef.current.clear();
    markerElsRef.current.clear();

    const withGeo = biens.filter((b) => b.lat != null && b.lng != null);

    withGeo.forEach((bien) => {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 30px; height: 30px;
        border-radius: 50% 50% 50% 0;
        background: ${C.orange};
        border: 2px solid #fff;
        transform: rotate(-45deg);
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(15,46,76,0.35);
        transition: transform 0.15s ease, background 0.15s ease;
        position: relative; z-index: 1;
      `;
      el.addEventListener("click", () => { window.location.href = `/biens/${bien.id}`; });
      el.addEventListener("mouseenter", () => setHoveredId(bien.id));
      el.addEventListener("mouseleave", () => setHoveredId(null));
      // Touch
      el.addEventListener("touchend", () => { window.location.href = `/biens/${bien.id}`; });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([bien.lng!, bien.lat!])
        .addTo(map);

      markerObjsRef.current.set(bien.id, marker);
      markerElsRef.current.set(bien.id, el);
    });

    if (withGeo.length > 1) {
      const lngs = withGeo.map((b) => b.lng!);
      const lats = withGeo.map((b) => b.lat!);
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 60, maxZoom: 13, duration: 600 }
      );
    } else if (withGeo.length === 1) {
      map.flyTo({ center: [withGeo[0].lng!, withGeo[0].lat!], zoom: 13 });
    }
  }, [biens, mapReady]);

  // ── Hover sync ───────────────────────────────────────────────────────────────

  useEffect(() => {
    markerElsRef.current.forEach((el, id) => {
      if (id === hoveredId) {
        el.style.background = "var(--althy-orange-hover)";
        el.style.transform = "rotate(-45deg) scale(1.3)";
        el.style.zIndex = "10";
      } else {
        el.style.background = C.orange;
        el.style.transform = "rotate(-45deg) scale(1)";
        el.style.zIndex = "1";
      }
    });
  }, [hoveredId]);

  const resetFiltres = () => {
    setTxType("");
    setVille("");
    setVilleInput("");
    setCanton("");
    setPrixMin("");
    setPrixMax("");
    setPieces(null);
    setSurfaceMin("");
  };

  const hasFilters = !!(txType || ville || canton || prixMin || prixMax || pieces || surfaceMin);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--althy-bg)",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.6; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Scrollbar fine */
        .biens-list::-webkit-scrollbar { width: 4px; }
        .biens-list::-webkit-scrollbar-thumb { background: var(--althy-border); border-radius: 2px; }

        /* Mobile map toggle button */
        .map-toggle-btn {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 200;
          background: var(--althy-text);
          color: #fff;
          border: none;
          border-radius: 24px;
          padding: 10px 22px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          background: "var(--althy-surface)",
          borderBottom: "1px solid var(--althy-border)",
          padding: "0 16px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          zIndex: 100,
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <span
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              fontWeight: 300,
              color: "var(--althy-text)",
              letterSpacing: "0.05em",
            }}
          >
            ALT<span style={{ color: C.orange }}>H</span>Y
          </span>
        </Link>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link
            href="/biens/swipe"
            style={{
              fontSize: 12,
              padding: "5px 12px",
              borderRadius: 20,
              background: "rgba(15,46,76,0.08)",
              color: C.orange,
              textDecoration: "none",
              fontWeight: 600,
              display: isMobile ? "none" : undefined,
            }}
          >
            ♥ Swipe
          </Link>
          {isLoggedIn ? (
            <>
              <Link
                href="/app"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: "var(--radius-elem)",
                  background: "var(--althy-surface-2)",
                  color: "var(--althy-text)",
                  textDecoration: "none",
                  fontWeight: 500,
                  border: "1px solid var(--althy-border)",
                }}
              >
                <UserCircle size={14} /> Mon espace
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/register"
                style={{
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: "var(--radius-elem)",
                  border: `1px solid ${C.orange}`,
                  color: C.orange,
                  textDecoration: "none",
                  fontWeight: 500,
                  display: isMobile ? "none" : undefined,
                }}
              >
                Publier
              </Link>
              <Link
                href="/login"
                style={{
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: "var(--radius-elem)",
                  background: C.orange,
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Connexion
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--althy-surface)",
          borderBottom: "1px solid var(--althy-border)",
          padding: "8px 14px",
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: isMobile ? "wrap" : undefined,
          flexShrink: 0,
          overflowX: isMobile ? "auto" : undefined,
        }}
      >
        <SlidersHorizontal size={13} color="var(--althy-text-3)" />

        {(["", "location", "vente", "colocation"] as TxType[]).map((type) => (
          <button
            key={type}
            onClick={() => setTxType(type)}
            style={{
              fontSize: 12,
              padding: "4px 12px",
              borderRadius: 20,
              border: `1.5px solid ${txType === type ? C.orange : "var(--althy-border)"}`,
              background: txType === type ? "rgba(15,46,76,0.08)" : "transparent",
              color: txType === type ? C.orange : "var(--althy-text-2)",
              cursor: "pointer",
              fontWeight: txType === type ? 600 : 400,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {TX_LABEL[type]}
          </button>
        ))}

        {/* Pièces */}
        {!isMobile && (
          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setPieces(pieces === n ? null : n)}
                style={{
                  fontSize: 11,
                  padding: "3px 9px",
                  borderRadius: 20,
                  border: `1.5px solid ${pieces === n ? C.orange : "var(--althy-border)"}`,
                  background: pieces === n ? "rgba(15,46,76,0.08)" : "transparent",
                  color: pieces === n ? C.orange : "var(--althy-text-3)",
                  cursor: "pointer",
                  fontWeight: pieces === n ? 600 : 400,
                  whiteSpace: "nowrap",
                }}
              >
                {n}p+
              </button>
            ))}
          </div>
        )}

        <div style={{ position: "relative", flexShrink: 0 }}>
          <Search
            size={12}
            style={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--althy-text-3)",
              pointerEvents: "none",
            }}
          />
          <input
            value={villeInput}
            onChange={(e) => setVilleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setVille(villeInput.trim());
            }}
            onBlur={() => { if (villeInput !== ville) setVille(villeInput.trim()); }}
            placeholder="Ville…"
            style={{
              paddingLeft: 26,
              paddingRight: 8,
              height: 30,
              width: 130,
              border: "1.5px solid var(--althy-border)",
              borderRadius: "var(--radius-elem)",
              fontSize: 12,
              outline: "none",
              background: "var(--althy-bg)",
              color: "var(--althy-text)",
              boxSizing: "border-box",
            }}
          />
        </div>

        <input
          value={prixMin}
          onChange={(e) => setPrixMin(e.target.value)}
          onBlur={() => { setPage(1); setBiens([]); fetchPage(1, true); }}
          placeholder="Prix min (CHF)"
          type="number"
          style={{
            width: 110,
            height: 30,
            padding: "0 8px",
            border: "1.5px solid var(--althy-border)",
            borderRadius: "var(--radius-elem)",
            fontSize: 12,
            outline: "none",
            background: "var(--althy-bg)",
            color: "var(--althy-text)",
            flexShrink: 0,
            display: isMobile ? "none" : undefined,
          }}
        />

        <input
          value={prixMax}
          onChange={(e) => setPrixMax(e.target.value)}
          onBlur={() => fetchPage(1, true)}
          placeholder="Prix max (CHF)"
          type="number"
          style={{
            width: 110,
            height: 30,
            padding: "0 8px",
            border: "1.5px solid var(--althy-border)",
            borderRadius: "var(--radius-elem)",
            fontSize: 12,
            outline: "none",
            background: "var(--althy-bg)",
            color: "var(--althy-text)",
            flexShrink: 0,
            display: isMobile ? "none" : undefined,
          }}
        />

        <input
          value={surfaceMin}
          onChange={(e) => setSurfaceMin(e.target.value)}
          onBlur={() => fetchPage(1, true)}
          placeholder="Surface min (m²)"
          type="number"
          style={{
            width: 120,
            height: 30,
            padding: "0 8px",
            border: "1.5px solid var(--althy-border)",
            borderRadius: "var(--radius-elem)",
            fontSize: 12,
            outline: "none",
            background: "var(--althy-bg)",
            color: "var(--althy-text)",
            flexShrink: 0,
            display: isMobile ? "none" : undefined,
          }}
        />

        {hasFilters && (
          <button
            onClick={resetFiltres}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--althy-text-3)",
              fontSize: 11,
              padding: "4px 6px",
              flexShrink: 0,
            }}
          >
            <X size={11} /> Tout
          </button>
        )}

        {/* SEO links — villes */}
        {!isMobile && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {["Genève", "Lausanne", "Vaud"].map((v) => (
              <Link
                key={v}
                href={`/biens/${v.toLowerCase()}`}
                style={{
                  fontSize: 11,
                  color: "var(--althy-text-3)",
                  textDecoration: "none",
                  padding: "2px 0",
                  borderBottom: "1px dotted var(--althy-border)",
                }}
              >
                {v}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}

      {isMobile ? (
        /* ── MOBILE : toggle liste / carte ──────────────────────────────── */
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {/* Liste mobile */}
          <div
            style={{
              display: mobileView === "list" ? "flex" : "none",
              flexDirection: "column",
              height: "100%",
              overflowY: "auto",
            }}
            className="biens-list"
          >
            <div style={{ padding: "10px 12px 4px" }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--althy-text-3)" }}>
                {loading ? "Chargement…" : `${total} bien${total !== 1 ? "s" : ""} disponible${total !== 1 ? "s" : ""}`}
              </p>
            </div>

            <div
              style={{
                padding: "4px 10px 100px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
                : biens.length === 0
                ? (
                    <div style={{ padding: "48px 20px", textAlign: "center" }}>
                      <Building2 size={40} color="var(--althy-text-3)" style={{ opacity: 0.25, marginBottom: 12 }} />
                      <p style={{ color: "var(--althy-text-2)", fontSize: 14, marginBottom: 12 }}>
                        Aucun bien ne correspond.
                      </p>
                      <button
                        onClick={resetFiltres}
                        style={{ fontSize: 13, color: C.orange, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                      >
                        Voir tous les biens
                      </button>
                    </div>
                  )
                : biens.map((bien, i) => (
                    <BienCard
                      key={bien.id}
                      bien={bien}
                      isHovered={hoveredId === bien.id}
                      onHover={setHoveredId}
                      priority={i < 3}
                    />
                  ))}

              {/* Infinite scroll sentinel */}
              {!loading && hasMore && (
                <div ref={sentinelRef} style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {loadingMore && (
                    <div style={{ width: 24, height: 24, border: "2px solid var(--althy-border)", borderTopColor: C.orange, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Map mobile */}
          <div
            style={{
              display: mobileView === "map" ? "block" : "none",
              height: "100%",
              position: "relative",
            }}
          >
            <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
          </div>

          {/* Toggle button */}
          <button
            className="map-toggle-btn"
            onClick={() => setMobileView(mobileView === "list" ? "map" : "list")}
          >
            {mobileView === "list" ? (
              <><MapIcon size={14} /> Carte</>
            ) : (
              <><List size={14} /> Liste ({total})</>
            )}
          </button>
        </div>
      ) : (
        /* ── DESKTOP : split liste / carte ──────────────────────────────── */
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Liste */}
          <div
            className="biens-list"
            style={{
              width: 400,
              flexShrink: 0,
              overflowY: "auto",
              borderRight: "1px solid var(--althy-border)",
            }}
          >
            <div style={{ padding: "10px 14px 4px" }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--althy-text-3)" }}>
                {loading
                  ? "Chargement…"
                  : `${total} bien${total !== 1 ? "s" : ""} disponible${total !== 1 ? "s" : ""}`}
              </p>
            </div>

            <div
              style={{
                padding: "4px 12px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                : biens.length === 0
                ? (
                    <div style={{ padding: "48px 20px", textAlign: "center" }}>
                      <Building2 size={40} color="var(--althy-text-3)" style={{ opacity: 0.25, marginBottom: 12 }} />
                      <p style={{ color: "var(--althy-text-2)", fontSize: 14, marginBottom: 12 }}>
                        Aucun bien ne correspond à vos critères.
                      </p>
                      <button
                        onClick={resetFiltres}
                        style={{ fontSize: 13, color: C.orange, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                      >
                        Voir tous les biens
                      </button>
                    </div>
                  )
                : biens.map((bien, i) => (
                    <BienCard
                      key={bien.id}
                      bien={bien}
                      isHovered={hoveredId === bien.id}
                      onHover={setHoveredId}
                      priority={i < 2}
                    />
                  ))}

              {/* Infinite scroll sentinel */}
              {!loading && hasMore && (
                <div ref={sentinelRef} style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {loadingMore && (
                    <div style={{ width: 24, height: 24, border: "2px solid var(--althy-border)", borderTopColor: C.orange, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  )}
                </div>
              )}

              {!loading && !hasMore && biens.length > 0 && (
                <p style={{ textAlign: "center", fontSize: 12, color: "var(--althy-text-3)", padding: "12px 0" }}>
                  {total} bien{total !== 1 ? "s" : ""} affiché{total !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>

          {/* Carte desktop */}
          <div style={{ flex: 1, position: "relative" }}>
            <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
            {!MAPBOX_TOKEN && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f0f0f0",
                  color: "var(--althy-text-3)",
                  fontSize: 14,
                }}
              >
                Token Mapbox manquant
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
