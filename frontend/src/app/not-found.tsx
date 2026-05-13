import Link from "next/link";
import { C } from "@/lib/design-tokens";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        padding: 32,
        background: C.bg,
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: 48,
          color: C.prussian,
          marginBottom: 16,
          fontFamily: "var(--font-serif), Fraunces, Georgia, serif",
          fontWeight: 300,
          letterSpacing: "-0.02em",
        }}
      >
        404
      </h1>
      <p
        style={{
          fontSize: 16,
          color: C.text2,
          marginBottom: 32,
          maxWidth: 480,
        }}
      >
        Cette page n&apos;existe pas ou a été déplacée.
      </p>
      <Link
        href="/"
        style={{
          background: C.prussian,
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 8,
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
