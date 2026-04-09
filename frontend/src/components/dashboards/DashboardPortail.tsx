"use client";

import { Building2, FileText, Banknote, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const S = {
  surface: "var(--althy-surface)",
  border:  "var(--althy-border)",
  text:    "var(--althy-text)",
  text2:   "var(--althy-text-2)",
  text3:   "var(--althy-text-3)",
  orange:  "var(--althy-orange)",
  orangeBg:"var(--althy-orange-bg)",
  green:   "var(--althy-green)",
  shadow:  "var(--althy-shadow)",
} as const;

interface Props { firstName: string }
interface PortailAccess {
  properties_count: number;
  properties: { id: string; name: string; address: string }[];
  sections: string[];
}

export function DashboardPortail({ firstName }: Props) {
  const { data: access } = useQuery<PortailAccess>({
    queryKey: ["portail-access"],
    queryFn: () => api.get<PortailAccess>("/portail/me/access").then(r => r.data),
  });

  const sections = [
    { icon: <Building2 size={18} />, label: "Mes biens",   href: "/app/biens",    allowed: access?.sections.includes("biens") },
    { icon: <Banknote size={18} />,  label: "Mes loyers",  href: "/app/finances", allowed: access?.sections.includes("finances") },
    { icon: <FileText size={18} />,  label: "Documents",   href: "/app/documents",allowed: access?.sections.includes("documents") },
    { icon: <MessageSquare size={18} />, label: "Messages",href: "/app/crm",      allowed: false },
  ];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 300, color: S.text, margin: "0 0 6px" }}>
          Bonjour {firstName}
        </h1>
        <p style={{ color: S.text3, fontSize: 13.5, margin: 0 }}>
          Portail propriétaire · Accès fourni par votre agence
        </p>
      </div>

      {/* Properties count */}
      <div style={{
        background: S.surface, border: `1px solid ${S.border}`,
        borderRadius: 14, padding: "18px 20px", marginBottom: 20,
        display: "flex", alignItems: "center", gap: 16,
        boxShadow: S.shadow,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: S.orangeBg, color: S.orange,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Building2 size={22} />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: S.text }}>
            {access?.properties_count ?? "—"}
          </div>
          <div style={{ fontSize: 13, color: S.text3 }}>Bien{(access?.properties_count ?? 0) > 1 ? "s" : ""} partagé{(access?.properties_count ?? 0) > 1 ? "s" : ""} par votre agence</div>
        </div>
      </div>

      {/* Sections accessibles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 20 }}>
        {sections.map(s => (
          <div key={s.label} style={{
            background: S.surface, border: `1px solid ${S.border}`,
            borderRadius: 12, padding: "16px 18px",
            opacity: s.allowed === false ? 0.45 : 1,
          }}>
            {s.allowed !== false ? (
              <Link href={s.href} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: S.orange }}>{s.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: S.text }}>{s.label}</span>
              </Link>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: S.text3 }}>{s.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: S.text3 }}>{s.label}</span>
                <span style={{
                  marginLeft: "auto", fontSize: 10, padding: "2px 8px",
                  borderRadius: 20, background: S.orangeBg, color: S.orange,
                  fontWeight: 600,
                }}>Non autorisé</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info limites */}
      <div style={{
        padding: "12px 16px", borderRadius: 10,
        background: S.orangeBg, border: `1px solid rgba(181,90,48,0.2)`,
        fontSize: 12.5, color: S.text2,
      }}>
        Votre accès est limité aux sections autorisées par votre agence. Pour plus d&apos;accès, contactez-la directement.
      </div>
    </div>
  );
}
