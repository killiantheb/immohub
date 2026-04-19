"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";


interface ScanElement {
  source_site: string;
  source_id:   string;
  source_url:  string;
  titre:       string;
  description: string;
  photos:      string[];
  donnees:     Record<string, unknown>;
}

interface ScanResponse {
  status:   "pending" | "pending_review" | "done";
  nb:       number;
  elements: ScanElement[];
}

export default function OnboardingScanPage() {
  const [status,    setStatus]    = useState<"loading" | "pending" | "ready" | "done">("loading");
  const [elements,  setElements]  = useState<ScanElement[]>([]);
  const [confirmes, setConfirmes] = useState<Set<string>>(new Set());
  const [rejetes,   setRejetes]   = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const { data } = await api.get<ScanResponse>("/onboarding/scan");
        if (cancelled) return;

        if (data.status === "pending") {
          setTimeout(poll, 3000);
        } else if (data.status === "pending_review") {
          setElements(data.elements || []);
          setStatus("ready");
        } else if (data.status === "done") {
          setStatus("done");
        }
      } catch {
        if (!cancelled) setTimeout(poll, 5000);
      }
    };

    poll();
    return () => { cancelled = true; };
  }, []);

  const toggle = (id: string, action: "confirmer" | "rejeter") => {
    setConfirmes(prev => {
      const next = new Set(prev);
      if (action === "confirmer") {
        next.has(id) ? next.delete(id) : next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
    setRejetes(prev => {
      const next = new Set(prev);
      if (action === "rejeter") {
        next.has(id) ? next.delete(id) : next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      await api.post("/onboarding/confirmer", {
        confirmes: Array.from(confirmes),
        rejetes:   Array.from(rejetes),
      });
      setStatus("done");
    } finally {
      setImporting(false);
    }
  };

  const toutConfirmer = () => {
    setConfirmes(new Set(elements.map(e => e.source_id)));
    setRejetes(new Set());
  };

  /* ── Loading / scanning ──────────────────────────────────────────────────── */
  if (status === "loading" || status === "pending") return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 44, height: 44, borderRadius: "50%", border: `3px solid var(--althy-border)`, borderTopColor: C.orange, animation: "spin 0.9s linear infinite" }} />
      <p style={{ color: C.text3, fontSize: 15, margin: 0 }}>Althy recherche vos annonces sur internet…</p>
      <p style={{ color: C.text3, fontSize: 13, opacity: 0.7, margin: 0 }}>Homegate · ImmoScout24 · Immobilier.ch · votre site</p>
    </div>
  );

  /* ── Done ────────────────────────────────────────────────────────────────── */
  if (status === "done") return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ fontSize: 52, lineHeight: 1 }}>✓</div>
      <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 300, color: C.text, margin: 0 }}>
        {confirmes.size} élément{confirmes.size > 1 ? "s" : ""} importé{confirmes.size > 1 ? "s" : ""}
      </h2>
      <a href="/app/biens" style={{ padding: "12px 28px", background: C.orange, color: "#fff", borderRadius: 12, textDecoration: "none", fontWeight: 600 }}>
        Voir mes biens →
      </a>
    </div>
  );

  /* ── Review list ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px", fontFamily: "var(--font-sans)" }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.orange, fontWeight: 700, marginBottom: 8 }}>
          Althy a trouvé {elements.length} élément{elements.length > 1 ? "s" : ""}
        </p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 34, fontWeight: 300, lineHeight: 1.1, marginBottom: 10 }}>
          Ces résultats vous<br />appartiennent-ils ?
        </h1>
        <p style={{ color: C.text3, fontSize: 14, margin: 0 }}>
          Confirmez ce qui est à vous — Althy l&apos;importe automatiquement avec toutes les informations trouvées.
        </p>
      </div>

      {/* Actions rapides */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button
          onClick={toutConfirmer}
          style={{ padding: "7px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.text3, cursor: "pointer", fontSize: 13 }}
        >
          Tout confirmer
        </button>
        <span style={{ marginLeft: "auto", color: C.text3, fontSize: 13 }}>
          {confirmes.size} sélectionné{confirmes.size > 1 ? "s" : ""}
        </span>
      </div>

      {/* Liste */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {elements.map((el, i) => {
          const isC = confirmes.has(el.source_id);
          const isR = rejetes.has(el.source_id);
          const d   = (el.donnees || {}) as Record<string, string | number | undefined>;

          return (
            <div key={el.source_id ?? i} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "14px 18px",
              background: isC ? C.greenBg : isR ? "var(--althy-orange-bg)" : C.surface,
              border: `1px solid ${isC ? C.green : isR ? C.orange : C.border}`,
              borderRadius: 14, transition: "all 0.18s",
            }}>

              {/* Photo */}
              {el.photos?.[0]
                ? <img src={el.photos[0]} alt="" style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                : <div style={{ width: 72, height: 54, background: "var(--althy-surface)", border: `1px solid ${C.border}`, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: C.text3 }}>🏠</div>
              }

              {/* Infos */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {el.titre}
                </div>
                <div style={{ fontSize: 12, color: C.text3 }}>
                  {[d.ville, d.pieces && `${d.pieces}p`, d.surface && `${d.surface}m²`].filter(Boolean).join(" · ")}
                </div>
                {d.prix_texte && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.orange, marginTop: 2 }}>{String(d.prix_texte)}</div>
                )}
                <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                  Source : {el.source_site}
                </div>
              </div>

              {/* Boutons */}
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => toggle(el.source_id, "confirmer")}
                  title="C'est le mien"
                  style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: isC ? C.green : "transparent",
                    border: `1.5px solid ${isC ? C.green : C.border}`,
                    color: isC ? "#fff" : C.text3,
                    fontSize: 16, cursor: "pointer", transition: "all 0.15s",
                  }}
                >✓</button>
                <button
                  onClick={() => toggle(el.source_id, "rejeter")}
                  title="Pas à moi"
                  style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: isR ? C.orange : "transparent",
                    border: `1.5px solid ${isR ? C.orange : C.border}`,
                    color: isR ? "#fff" : C.text3,
                    fontSize: 16, cursor: "pointer", transition: "all 0.15s",
                  }}
                >✗</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bouton import */}
      <div style={{ marginTop: 28, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleImport}
          disabled={confirmes.size === 0 || importing}
          style={{
            padding: "12px 32px", borderRadius: 12, border: "none",
            background: confirmes.size > 0 ? C.orange : C.border,
            color: confirmes.size > 0 ? "#fff" : C.text3,
            fontSize: 15, fontWeight: 600,
            cursor: confirmes.size > 0 && !importing ? "pointer" : "default",
            transition: "all 0.15s",
          }}
        >
          {importing ? "Import en cours…" : `Importer ${confirmes.size} élément${confirmes.size > 1 ? "s" : ""} →`}
        </button>
      </div>
    </div>
  );
}
