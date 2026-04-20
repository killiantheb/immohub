"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { FileText, Bell, FolderOpen } from "lucide-react";
import { C } from "@/lib/design-tokens";
import { trackEvent } from "@/lib/analytics";

const serif = "var(--font-serif)";
const sans  = "var(--font-sans)";

const COLUMNS = [
  {
    Icon: FileText,
    title: "Quittances et QR-factures automatiques",
    desc: "Chaque mois, Althy génère les quittances et QR-factures de vos locataires. Prêt à signer, prêt à envoyer.",
    quote: "En 30 secondes, j'ai généré la quittance de février pour les Martin.",
  },
  {
    Icon: Bell,
    title: "Relances intelligentes",
    desc: "Retard de loyer ? Althy rédige le rappel, choisit le bon ton, envoie par email ou WhatsApp. Vous validez d'un clic.",
    quote: "Pas besoin de me faire violence pour relancer. Althy le fait à ma place.",
  },
  {
    Icon: FolderOpen,
    title: "Tout le dossier, en un endroit",
    desc: "Bail, état des lieux, assurance, diagnostics, factures : tout centralisé, tout accessible, tout cherchable.",
    quote: "J'ai retrouvé le bail de 2019 en 3 secondes quand mon comptable me l'a demandé.",
  },
];

export function ProprioSolo() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackEvent("viewed_proprio_section");
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      style={{
        background: C.surface,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: "96px 24px 80px",
      }}
    >
      <style>{`
        .lp-proprio-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0; }
        @media (max-width:768px) { .lp-proprio-grid { grid-template-columns:1fr; } }
      `}</style>

      <div style={{ maxWidth: 1060, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
            color: C.prussian, textTransform: "uppercase", margin: "0 0 12px",
          }}>
            Conçu pour vous
          </p>
          <h2 style={{
            fontFamily: serif, fontSize: "clamp(26px,3.5vw,40px)",
            fontWeight: 300, color: C.text, margin: "0 0 10px",
          }}>
            Propriétaire seul, gestion complète.
          </h2>
          <p style={{ fontSize: 15, color: C.textMuted, margin: 0, maxWidth: 520, marginInline: "auto" }}>
            Tout ce dont un propriétaire a besoin pour gérer ses biens — sans agence, sans stress.
          </p>
        </div>

        {/* 3 columns */}
        <div className="lp-proprio-grid">
          {COLUMNS.map((col, i) => (
            <div
              key={col.title}
              style={{
                padding: "0 32px",
                borderLeft: i > 0 ? `1px solid ${C.prussianBg}` : "none",
              }}
            >
              {/* Icon */}
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: C.prussianBg, display: "flex",
                alignItems: "center", justifyContent: "center",
                marginBottom: 18,
              }}>
                <col.Icon size={22} color={C.prussian} strokeWidth={1.8} />
              </div>

              {/* Title */}
              <h3 style={{
                fontFamily: serif, fontSize: 19, fontWeight: 400,
                color: C.text, margin: "0 0 10px", lineHeight: 1.3,
              }}>
                {col.title}
              </h3>

              {/* Description */}
              <p style={{
                fontSize: 14, color: C.textMuted, lineHeight: 1.6,
                margin: "0 0 16px",
              }}>
                {col.desc}
              </p>

              {/* Quote */}
              <p style={{
                fontSize: 13, fontStyle: "italic", color: C.text,
                lineHeight: 1.55, margin: 0,
                padding: "12px 0 0",
                borderTop: `1px solid ${C.border}`,
              }}>
                &laquo;&nbsp;{col.quote}&nbsp;&raquo;
              </p>
            </div>
          ))}
        </div>

        {/* CTA bandeau */}
        <div style={{
          textAlign: "center", marginTop: 56,
          padding: "28px 24px",
          background: C.prussianBg,
          borderRadius: 14,
        }}>
          <p style={{
            fontSize: 15, fontWeight: 500, color: C.text,
            margin: "0 0 14px", fontFamily: sans,
          }}>
            Gratuit pendant 30 jours — sans carte bancaire
          </p>
          <Link href="/register?role=proprio_solo" style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 10,
            background: C.prussian, color: "#fff", fontSize: 14, fontWeight: 600,
            textDecoration: "none", fontFamily: sans,
          }}>
            Essayer Althy →
          </Link>
        </div>
      </div>
    </section>
  );
}
