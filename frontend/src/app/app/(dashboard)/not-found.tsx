import Link from "next/link";
import { C } from "@/lib/design-tokens";

export default function DashboardNotFound() {
  return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <h1
        style={{
          color: C.prussian,
          fontSize: 28,
          marginBottom: 12,
          fontFamily: "var(--font-serif), Fraunces, Georgia, serif",
          fontWeight: 300,
          letterSpacing: "-0.01em",
        }}
      >
        Page introuvable
      </h1>
      <p style={{ color: C.text2, marginBottom: 24, fontSize: 14 }}>
        Cette section n&apos;existe pas dans votre espace.
      </p>
      <Link
        href="/app"
        style={{
          color: C.prussian,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "underline",
          textUnderlineOffset: 3,
        }}
      >
        Retour au tableau de bord
      </Link>
    </div>
  );
}
