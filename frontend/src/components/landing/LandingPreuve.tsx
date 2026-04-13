const ORANGE = "#E8602C";
const DARK   = "#1A1612";
const MUTED  = "#6B5E52";
const serif  = "var(--font-serif, 'Fraunces', Georgia, serif)";

const CHIFFRES = [
  { n: "130", label: "biens gérés" },
  { n: "5",   label: "villes actives" },
  { n: "100%", label: "Suisse" },
];

export function LandingPreuve() {
  return (
    <section style={{
      background: "rgba(26,22,18,0.02)",
      borderTop: "1px solid rgba(26,22,18,0.06)",
      borderBottom: "1px solid rgba(26,22,18,0.06)",
      padding: "72px 24px",
    }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>

        {/* Témoignage */}
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{ fontSize: 22, color: ORANGE, letterSpacing: "0.06em", marginBottom: 20 }}>
            ★★★★★
          </div>
          <blockquote style={{
            fontFamily: serif,
            fontSize: "clamp(18px,2.5vw,24px)",
            fontWeight: 300, fontStyle: "italic",
            color: DARK, lineHeight: 1.55,
            margin: "0 0 24px",
          }}>
            « Althy gère tous mes rappels de loyer et génère mes quittances en quelques secondes.
            Je ne pourrais plus m&apos;en passer — c&apos;est comme avoir un gestionnaire disponible 24h/24. »
          </blockquote>
          <p style={{ fontSize: 13, color: MUTED, margin: 0, fontWeight: 500 }}>
            Patrick M. — Propriétaire à Lausanne · 130 biens gérés
          </p>
        </div>

        {/* Chiffres clés */}
        <div style={{
          display: "flex", justifyContent: "center",
          gap: 48, flexWrap: "wrap" as const,
          padding: "28px 0 0",
          borderTop: "1px solid rgba(26,22,18,0.08)",
          textAlign: "center",
        }}>
          {CHIFFRES.map(item => (
            <div key={item.label}>
              <div style={{ fontFamily: serif, fontSize: "clamp(30px,4vw,44px)", fontWeight: 300, color: ORANGE, lineHeight: 1 }}>
                {item.n}
              </div>
              <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, marginTop: 5 }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
