"use client";

import { C } from "@/lib/design-tokens";

/**
 * Support humain — point fort vs bot IA.
 * Deux canaux : WhatsApp (prioritaire) + email.
 * Pas de chatbot : "vous parlez à quelqu'un, pas à un robot".
 */

const WHATSAPP_NUMBER = "+41791234567";
const WHATSAPP_MESSAGE = "Bonjour Althy, je suis abonné Autonomie et j'ai une question :";
const EMAIL = "autonomie@althy.ch";

export function SupportPanel() {
  const waLink = `https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${encodeURIComponent(
    WHATSAPP_MESSAGE,
  )}`;

  return (
    <div
      style={{
        background: C.prussianBg,
        border: `1px solid ${C.prussianBorder}`,
        borderRadius: 16,
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 24 }}>💬</span>
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 20,
            fontWeight: 300,
            color: C.prussian,
            margin: 0,
          }}
        >
          Un humain, pas un chatbot
        </h3>
      </div>
      <p
        style={{
          color: C.text2,
          fontSize: 14,
          lineHeight: 1.5,
          margin: "0 0 18px",
        }}
      >
        Votre conseiller Althy vous répond en moins de 4 heures ouvrées — par
        WhatsApp ou email, selon votre préférence.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 16px",
            borderRadius: 10,
            background: "#25D366",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          <span>📱</span>
          WhatsApp
        </a>
        <a
          href={`mailto:${EMAIL}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 16px",
            borderRadius: 10,
            background: C.prussian,
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          <span>✉️</span>
          Email
        </a>
      </div>

      <p
        style={{
          color: C.text3,
          fontSize: 12,
          margin: "14px 0 0",
          textAlign: "center",
        }}
      >
        Lundi – vendredi, 8h–18h. Assistance juridique sur rendez-vous.
      </p>
    </div>
  );
}
