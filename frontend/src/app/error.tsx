"use client";

import { useEffect } from "react";
import { C } from "@/lib/design-tokens";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 32,
        background: C.bg,
        textAlign: "center",
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text }}>
        Une erreur est survenue
      </h2>
      <p style={{ fontSize: 14, color: C.text3, maxWidth: 480 }}>{error.message}</p>
      <button
        onClick={reset}
        style={{
          background: C.prussian,
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 8,
          border: "none",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Réessayer
      </button>
    </div>
  );
}
