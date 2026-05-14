"use client";

import Link from "next/link";
import { Plus, Briefcase, AlertCircle } from "lucide-react";
import { useMandats } from "@/lib/hooks/useSprint10";
import { C } from "@/lib/design-tokens";

const STATUS_COLORS: Record<string, string> = {
  draft: "#6E7682",
  pending_signatures: "#C9A961",
  active: "#0F2E4C",
  terminated: "#6E7682",
  expired: "#6E7682",
};

export default function MandatsListPage() {
  const { data, isLoading, isError } = useMandats({});

  return (
    <div style={{ padding: "24px 0" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 400, color: C.text, margin: 0 }}>
            Mandats de gestion
          </h1>
          <p style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>
            Agence ↔ propriétaire · données contractuelles pures (pas de tracking transactionnel)
          </p>
        </div>
        <Link
          href="/app/mandats/new"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: C.prussian, color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
        >
          <Plus className="h-4 w-4" />
          Nouveau mandat
        </Link>
      </header>

      {isLoading && <p style={{ color: C.text3 }}>Chargement…</p>}
      {isError && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#991B1B" }}><AlertCircle className="h-4 w-4" /> Erreur de chargement.</div>}

      {data && data.items.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 16px", color: C.text3 }}>
          <Briefcase className="h-10 w-10" style={{ margin: "0 auto", color: C.gold }} />
          <p style={{ marginTop: 12 }}>Aucun mandat actif. Créez-en un pour formaliser le partenariat agence-propriétaire.</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {data.items.map((m) => (
            <Link
              key={m.id}
              href={`/app/mandats/${m.id}`}
              style={{ display: "block", padding: "16px 20px", background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, textDecoration: "none", color: C.text }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, color: C.text3, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>{m.reference}</p>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: "4px 0 0" }}>
                    Du {m.start_date} {m.end_date ? `au ${m.end_date}` : "(durée indéterminée)"}
                  </h3>
                  <p style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>
                    Commissions : {Number(m.commission_pct_annee)}% année · {Number(m.commission_pct_saison)}% saison · {Number(m.commission_pct_semaine)}% semaine
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: STATUS_COLORS[m.status] ?? "#6E7682", color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {m.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
