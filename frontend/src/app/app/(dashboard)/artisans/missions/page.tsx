"use client";

/**
 * /app/artisans/missions — Fil des RFQ (appels d'offres) matchant l'artisan.
 *
 * Utilise /rfqs (dashboard côté company) pour lister les RFQ auxquelles
 * l'artisan a déjà répondu + /rfqs?rfq_status=published pour les nouvelles.
 */

import { useQuery } from "@tanstack/react-query";
import { Briefcase, MapPin, Wrench } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";

type RFQ = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  city: string | null;
  urgency: string;
  status: string;
  created_at: string;
};

export default function ArtisansMissionsPage() {
  const q = useQuery({
    queryKey: ["artisan-missions", "open"],
    queryFn: async (): Promise<{ items: RFQ[] }> =>
      (await api.get("/rfqs?rfq_status=published&size=50")).data,
    staleTime: 30_000,
  });

  const items = q.data?.items ?? [];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 300, color: C.text, margin: 0 }}>
          Missions disponibles
        </h1>
        <p style={{ color: C.textMuted, margin: "8px 0 0" }}>
          Appels d'offres dans votre canton et vos spécialités.
        </p>
      </div>

      {q.isLoading && <div style={{ textAlign: "center", padding: 40 }}>Chargement…</div>}

      {!q.isLoading && items.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12 }}>
          <Briefcase size={32} color={C.textMuted} style={{ marginBottom: 10 }} />
          <div style={{ color: C.text, fontWeight: 500 }}>Aucune mission ouverte pour l'instant</div>
          <div style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
            Complétez votre profil pour augmenter vos chances d'être matché.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {items.map(r => (
          <Link
            key={r.id}
            href={`/app/artisans/missions/${r.id}`}
            style={{
              display: "block", padding: 16, background: C.surface,
              border: `1px solid ${C.border}`, borderRadius: 12,
              textDecoration: "none", color: C.text, transition: "border 120ms",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Wrench size={14} color={C.prussian} />
                  <strong style={{ fontSize: 15 }}>{r.title}</strong>
                  {r.urgency === "emergency" && (
                    <span style={{
                      background: "#FEE2E2", color: "#B91C1C",
                      fontSize: 11, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                    }}>Urgence</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: C.textMuted, display: "flex", gap: 12 }}>
                  <span>{r.category}</span>
                  {r.city && <span><MapPin size={12} style={{ display: "inline" }} /> {r.city}</span>}
                </div>
                {r.description && (
                  <p style={{ fontSize: 13, color: C.text2, margin: "8px 0 0", lineHeight: 1.5 }}>
                    {r.description.slice(0, 160)}{r.description.length > 160 ? "…" : ""}
                  </p>
                )}
              </div>
              <div style={{ color: C.prussian, fontSize: 13, fontWeight: 600 }}>Faire un devis →</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
