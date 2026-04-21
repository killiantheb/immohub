"use client";

import Link from "next/link";
import { Sparkles, Mail } from "lucide-react";
import { C } from "@/lib/design-tokens";

interface ComingSoonProps {
  title?: string;
  phase?: string;
  description?: string;
}

export function ComingSoon({
  title = "Cette fonctionnalité est en préparation",
  phase = "une prochaine phase",
  description,
}: ComingSoonProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: 32,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          textAlign: "center",
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: "48px 32px",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 20px",
            borderRadius: "50%",
            background: "var(--althy-prussian-bg, rgba(15,46,76,0.06))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={26} color="var(--althy-prussian)" strokeWidth={1.5} />
        </div>

        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 24,
            fontWeight: 400,
            margin: "0 0 12px",
            color: C.text,
          }}
        >
          {title}
        </h1>

        <p
          style={{
            color: C.text2,
            fontSize: 14,
            lineHeight: 1.6,
            margin: "0 0 24px",
          }}
        >
          {description ?? `Cette fonctionnalité sera disponible en ${phase}. Nous vous préviendrons dès qu'elle sera prête.`}
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/app/sphere"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 18px",
              borderRadius: 10,
              background: "var(--althy-prussian)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            <Sparkles size={14} strokeWidth={2} />
            Aller à Althy IA
          </Link>
          <Link
            href="/contact"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 18px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              color: C.text2,
              fontWeight: 500,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            <Mail size={14} strokeWidth={1.5} />
            Nous contacter
          </Link>
        </div>
      </div>
    </div>
  );
}
