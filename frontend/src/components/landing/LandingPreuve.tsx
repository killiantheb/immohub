import { C } from "@/lib/design-tokens";

const serif = "var(--font-serif)";

const CHIFFRES = [
  { n: "5",    label: "villes actives" },
  { n: "100%", label: "Suisse" },
];

export function LandingPreuve() {
  return (
    <section style={{
      background: C.surface2,
      borderTop: `1px solid ${C.border}`,
      borderBottom: `1px solid ${C.border}`,
      padding: "72px 24px",
    }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>

        {/* Chiffres clés */}
        <div style={{
          display: "flex", justifyContent: "center",
          gap: 48, flexWrap: "wrap" as const,
          textAlign: "center",
        }}>
          {CHIFFRES.map(item => (
            <div key={item.label}>
              <div style={{ fontFamily: serif, fontSize: "clamp(30px,4vw,44px)", fontWeight: 300, color: C.prussian, lineHeight: 1 }}>
                {item.n}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginTop: 5 }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
