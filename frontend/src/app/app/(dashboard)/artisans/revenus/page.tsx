"use client";

/**
 * /app/artisans/revenus — Vue commission T2 + historique paiements Stripe Connect.
 */

import { useQuery } from "@tanstack/react-query";
import { Euro, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";

type Paiement = {
  id: string;
  montant: number;
  mois: string;
  statut: string;
  created_at: string;
};

export default function ArtisansRevenusPage() {
  const paiQ = useQuery({
    queryKey: ["artisan-paiements"],
    queryFn: async (): Promise<Paiement[]> => (await api.get("/paiements?size=100")).data,
    staleTime: 30_000,
  });

  const paiements = paiQ.data ?? [];
  const moisCourant = new Date().toISOString().slice(0, 7);
  const bruttotal = paiements
    .filter(p => p.statut === "recu")
    .reduce((s, p) => s + Number(p.montant), 0);
  const commission = bruttotal * 0.05;
  const net = bruttotal - commission;
  const bruttoMois = paiements
    .filter(p => p.mois === moisCourant && p.statut === "recu")
    .reduce((s, p) => s + Number(p.montant), 0);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 300, color: C.text, margin: 0 }}>
          Mes revenus
        </h1>
        <p style={{ color: C.textMuted, margin: "8px 0 0" }}>
          Commission Althy : 5% sur chaque facture · reversement 95% via Stripe Connect.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
        <Kpi icon={Wallet} label="Facturé ce mois" value={`CHF ${bruttoMois.toLocaleString()}`} />
        <Kpi icon={TrendingUp} label="Facturé total" value={`CHF ${bruttotal.toLocaleString()}`} />
        <Kpi icon={Euro} label="Net reçu (95%)" value={`CHF ${net.toLocaleString()}`} highlight />
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>
          Historique des paiements
        </div>
        {paiements.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>
            Aucun paiement reçu pour le moment.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.surface2 }}>
                <Th>Date</Th><Th>Mois</Th><Th>Brut</Th><Th>Commission</Th><Th>Net</Th><Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {paiements.slice(0, 20).map(p => {
                const brut = Number(p.montant);
                const com = brut * 0.05;
                return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                    <Td>{new Date(p.created_at).toLocaleDateString("fr-CH")}</Td>
                    <Td>{p.mois}</Td>
                    <Td>CHF {brut.toFixed(2)}</Td>
                    <Td style={{ color: C.textMuted }}>−{com.toFixed(2)}</Td>
                    <Td style={{ fontWeight: 600 }}>CHF {(brut - com).toFixed(2)}</Td>
                    <Td>{p.statut}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{
        marginTop: 16, fontSize: 12, color: C.textMuted,
        padding: 12, background: C.surface2, borderRadius: 8,
      }}>
        Les paiements apparaissent dès que le propriétaire règle la facture. Le virement Stripe (95%)
        arrive sur votre IBAN sous 2–3 jours ouvrés.
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, highlight }: { icon: LucideIcon; label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? C.prussianBg : C.surface,
      border: `1px solid ${highlight ? C.prussianBorder : C.border}`,
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.textMuted, fontSize: 13 }}>
        <Icon size={14} color={C.prussian} />
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: C.text, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 12, fontWeight: 600, color: C.textMuted }}>{children}</th>;
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "10px 14px", fontSize: 13, color: C.text, ...(style ?? {}) }}>{children}</td>;
}
