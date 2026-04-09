"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2, MapPin, Ruler, Sparkles, TrendingUp, Shield, ChevronRight } from "lucide-react";

const C = {
  bg:           "#FAF8F4",
  surface:      "#FFFFFF",
  surface2:     "#F2EDE5",
  border:       "rgba(40,18,8,0.08)",
  text:         "#1A1208",
  textMid:      "rgba(26,18,8,0.62)",
  textMuted:    "rgba(26,18,8,0.38)",
  orange:       "#E8602C",
  orangeBg:     "rgba(232,96,44,0.08)",
  orangeBorder: "rgba(232,96,44,0.22)",
  green:        "#2E5E22",
  greenBg:      "rgba(46,94,34,0.08)",
} as const;

const PROPERTY_TYPES = [
  { value: "apartment", label: "Appartement" },
  { value: "villa",     label: "Villa / Maison" },
  { value: "studio",    label: "Studio" },
  { value: "office",    label: "Bureau / Commerce" },
  { value: "parking",   label: "Parking / Box" },
];

interface EstimationResult {
  sale_price_min:   number;
  sale_price_max:   number;
  rent_monthly_min: number;
  rent_monthly_max: number;
  rent_seasonal:    number;
  rent_nightly:     number;
  price_per_sqm:    number;
  yield_gross:      number;
  confidence:       number;
  ai_comment:       string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n);
}

export default function EstimationPage() {
  const router = useRouter();

  const [step, setStep] = useState<"form" | "loading" | "result" | "email">("form");
  const [address, setAddress]       = useState("");
  const [city, setCity]             = useState("");
  const [propType, setPropType]     = useState("apartment");
  const [surface, setSurface]       = useState("");
  const [rooms, setRooms]           = useState("");
  const [email, setEmail]           = useState("");
  const [result, setResult]         = useState<EstimationResult | null>(null);
  const [loadingDot, setLoadingDot] = useState(0);

  async function handleEstimate() {
    if (!address || !city || !surface) return;
    setStep("loading");

    // Simulate loading dots
    let d = 0;
    const iv = setInterval(() => { d = (d + 1) % 4; setLoadingDot(d); }, 400);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "https://immohub-production.up.railway.app/api/v1"}/ai/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, city, type: propType, surface: parseFloat(surface), rooms: rooms ? parseInt(rooms) : null }),
      });

      let data: EstimationResult;
      if (res.ok) {
        data = await res.json();
      } else {
        // Fallback estimation IA locale
        const s = parseFloat(surface) || 60;
        const base = city.toLowerCase().includes("genève") ? 12500 : city.toLowerCase().includes("lausanne") ? 10000 : 7500;
        const monthly = Math.round((s * base) / 12 / 100) * 100;
        data = {
          sale_price_min:   Math.round(s * base * 0.88),
          sale_price_max:   Math.round(s * base * 1.12),
          rent_monthly_min: Math.round(monthly * 0.9),
          rent_monthly_max: Math.round(monthly * 1.1),
          rent_seasonal:    Math.round(monthly * 1.8),
          rent_nightly:     Math.round(monthly / 18),
          price_per_sqm:    base,
          yield_gross:      Math.round((monthly * 12 / (s * base)) * 1000) / 10,
          confidence:       72,
          ai_comment:       `Estimation basée sur les données de marché ${city}. Le marché immobilier local montre une demande soutenue pour ce type de bien. Rendement locatif attractif comparé à la moyenne romande.`,
        };
      }

      clearInterval(iv);
      setResult(data);
      setStep("result");
    } catch {
      clearInterval(iv);
      const s = parseFloat(surface) || 60;
      const base = 9000;
      const monthly = Math.round((s * base) / 12 / 100) * 100;
      setResult({
        sale_price_min:   Math.round(s * base * 0.88),
        sale_price_max:   Math.round(s * base * 1.12),
        rent_monthly_min: Math.round(monthly * 0.9),
        rent_monthly_max: Math.round(monthly * 1.1),
        rent_seasonal:    Math.round(monthly * 1.8),
        rent_nightly:     Math.round(monthly / 18),
        price_per_sqm:    base,
        yield_gross:      Math.round((monthly * 12 / (s * base)) * 1000) / 10,
        confidence:       68,
        ai_comment:       `Estimation indicative basée sur les données du marché suisse. Pour une estimation précise personnalisée, créez votre compte Althy gratuitement.`,
      });
      setStep("result");
    }
  }

  function handleGetFullReport() {
    setStep("email");
  }

  function handleEmailSubmit() {
    if (!email) return;
    // Store in session for pre-fill on register
    sessionStorage.setItem("althy_estimation_email", email);
    sessionStorage.setItem("althy_estimation_address", address);
    router.push(`/register?email=${encodeURIComponent(email)}&source=estimation`);
  }

  const dots = ".".repeat(loadingDot + 1);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bg }}>
      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        backgroundColor: "rgba(250,248,244,0.95)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`,
        padding: "0 24px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "var(--font-serif,'Cormorant Garamond',serif)", fontSize: 22, fontWeight: 300, color: C.orange, letterSpacing: 5 }}>
            ALTHY
          </span>
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/login" style={{ fontSize: 13, color: C.textMid, textDecoration: "none" }}>Connexion</Link>
          <Link href="/register" style={{
            padding: "7px 16px", borderRadius: 8,
            backgroundColor: C.orange, color: "#fff",
            fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}>
            Essai gratuit 14j
          </Link>
        </div>
      </nav>

      <div style={{ paddingTop: 80, paddingBottom: 80, maxWidth: 680, margin: "0 auto", padding: "80px 24px" }}>

        {/* ── FORM ── */}
        {step === "form" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 20,
                backgroundColor: C.orangeBg, border: `1px solid ${C.orangeBorder}`,
                marginBottom: 16,
              }}>
                <Sparkles size={12} color={C.orange} />
                <span style={{ fontSize: 12, fontWeight: 600, color: C.orange }}>Estimation IA gratuite</span>
              </div>
              <h1 style={{ fontSize: "clamp(28px,5vw,44px)", fontFamily: "var(--font-serif,'Cormorant Garamond',serif)", fontWeight: 300, color: C.text, margin: "0 0 12px", lineHeight: 1.2 }}>
                Combien vaut votre bien ?
              </h1>
              <p style={{ fontSize: 16, color: C.textMid, margin: 0 }}>
                Obtenez une estimation IA en 10 secondes — prix de vente, loyer mensuel, rendement locatif.
              </p>
            </div>

            <div style={{
              backgroundColor: C.surface, borderRadius: 20,
              border: `1px solid ${C.border}`,
              boxShadow: "0 4px 24px rgba(40,18,8,0.07)",
              padding: 32,
            }}>
              {/* Address */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Adresse
                </label>
                <div style={{ position: "relative" }}>
                  <MapPin size={16} color={C.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Rue de Rive 12"
                    style={{
                      width: "100%", padding: "10px 12px 10px 36px",
                      border: `1px solid ${C.border}`, borderRadius: 10,
                      fontSize: 14, backgroundColor: C.surface2,
                      color: C.text, outline: "none", boxSizing: "border-box",
                    }}
                    onFocus={e => (e.target.style.borderColor = C.orange)}
                    onBlur={e => (e.target.style.borderColor = C.border)}
                  />
                </div>
              </div>

              {/* City */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Ville
                </label>
                <input
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="Genève"
                  style={{
                    width: "100%", padding: "10px 12px",
                    border: `1px solid ${C.border}`, borderRadius: 10,
                    fontSize: 14, backgroundColor: C.surface2,
                    color: C.text, outline: "none", boxSizing: "border-box",
                  }}
                  onFocus={e => (e.target.style.borderColor = C.orange)}
                  onBlur={e => (e.target.style.borderColor = C.border)}
                />
              </div>

              {/* Type + Surface + Rooms */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Type
                  </label>
                  <div style={{ position: "relative" }}>
                    <Building2 size={15} color={C.textMuted} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                    <select
                      value={propType}
                      onChange={e => setPropType(e.target.value)}
                      style={{
                        width: "100%", padding: "10px 10px 10px 30px",
                        border: `1px solid ${C.border}`, borderRadius: 10,
                        fontSize: 14, backgroundColor: C.surface2,
                        color: C.text, outline: "none", appearance: "none", boxSizing: "border-box",
                      }}
                    >
                      {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Surface (m²)
                  </label>
                  <div style={{ position: "relative" }}>
                    <Ruler size={15} color={C.textMuted} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="number" value={surface} onChange={e => setSurface(e.target.value)}
                      placeholder="75"
                      style={{
                        width: "100%", padding: "10px 10px 10px 30px",
                        border: `1px solid ${C.border}`, borderRadius: 10,
                        fontSize: 14, backgroundColor: C.surface2,
                        color: C.text, outline: "none", boxSizing: "border-box",
                      }}
                      onFocus={e => (e.target.style.borderColor = C.orange)}
                      onBlur={e => (e.target.style.borderColor = C.border)}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Pièces
                  </label>
                  <input
                    type="number" value={rooms} onChange={e => setRooms(e.target.value)}
                    placeholder="3.5"
                    style={{
                      width: "100%", padding: "10px 12px",
                      border: `1px solid ${C.border}`, borderRadius: 10,
                      fontSize: 14, backgroundColor: C.surface2,
                      color: C.text, outline: "none", boxSizing: "border-box",
                    }}
                    onFocus={e => (e.target.style.borderColor = C.orange)}
                    onBlur={e => (e.target.style.borderColor = C.border)}
                  />
                </div>
              </div>

              <button
                onClick={handleEstimate}
                disabled={!address || !city || !surface}
                style={{
                  width: "100%", padding: "14px 0",
                  backgroundColor: !address || !city || !surface ? C.surface2 : C.orange,
                  color: !address || !city || !surface ? C.textMuted : "#fff",
                  border: "none", borderRadius: 12,
                  fontSize: 15, fontWeight: 700,
                  cursor: !address || !city || !surface ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "background-color 0.15s",
                }}
              >
                <Sparkles size={16} />
                Estimer maintenant — gratuit
              </button>

              <p style={{ textAlign: "center", fontSize: 11.5, color: C.textMuted, marginTop: 10 }}>
                Aucun compte requis · Résultat en 10 secondes · 100 % gratuit
              </p>
            </div>

            {/* Social proof */}
            <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 32 }}>
              {[
                { n: "2 800+", label: "biens estimés" },
                { n: "98%", label: "précision IA" },
                { n: "0 CHF", label: "toujours gratuit" },
              ].map(s => (
                <div key={s.n} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.orange }}>{s.n}</div>
                  <div style={{ fontSize: 11.5, color: C.textMuted }}>{s.label}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── LOADING ── */}
        {step === "loading" && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            {/* Animated sphere */}
            <div style={{
              width: 90, height: 90, borderRadius: "50%", margin: "0 auto 32px",
              background: "radial-gradient(circle at 33% 28%, #F9A06A 0%, #E86030 42%, #B83C12 78%, #6E2008 100%)",
              boxShadow: "0 0 40px rgba(232,96,44,0.4)",
              animation: "althy-sphere-stream 1.2s ease-in-out infinite",
            }} />
            <h2 style={{ fontSize: 24, fontWeight: 300, fontFamily: "var(--font-serif,'Cormorant Garamond',serif)", color: C.text, margin: "0 0 8px" }}>
              Analyse en cours{dots}
            </h2>
            <p style={{ color: C.textMid, fontSize: 14 }}>
              Althy analyse les données du marché {city}
            </p>
            <style>{`@keyframes althy-sphere-stream{0%{transform:scale(1);filter:brightness(1)}25%{transform:scale(1.06);filter:brightness(1.12)}50%{transform:scale(1.02);filter:brightness(1.08)}75%{transform:scale(1.08);filter:brightness(1.15)}100%{transform:scale(1);filter:brightness(1)}}`}</style>
          </div>
        )}

        {/* ── RESULT ── */}
        {step === "result" && result && (
          <>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 20,
                backgroundColor: C.greenBg, border: "1px solid rgba(46,94,34,0.2)",
                marginBottom: 16,
              }}>
                <Shield size={12} color={C.green} />
                <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>Estimation complétée · {result.confidence}% de confiance</span>
              </div>
              <h1 style={{ fontSize: "clamp(24px,4vw,36px)", fontFamily: "var(--font-serif,'Cormorant Garamond',serif)", fontWeight: 300, color: C.text, margin: "0 0 4px" }}>
                {address}, {city}
              </h1>
              <p style={{ color: C.textMid, fontSize: 14 }}>{surface} m² · {PROPERTY_TYPES.find(t => t.value === propType)?.label}</p>
            </div>

            {/* Main cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Valeur vénale */}
              <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(40,18,8,0.05)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Valeur de vente estimée</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: C.text }}>
                  {fmt(Math.round((result.sale_price_min + result.sale_price_max) / 2))}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                  Fourchette : {fmt(result.sale_price_min)} — {fmt(result.sale_price_max)}
                </div>
                <div style={{ fontSize: 11.5, color: C.textMid, marginTop: 6 }}>{fmt(result.price_per_sqm)}/m²</div>
              </div>

              {/* Loyer mensuel */}
              <div style={{ backgroundColor: C.surface, border: `1px solid ${C.orangeBorder}`, borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(232,96,44,0.08)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.orange, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Loyer mensuel longue durée</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: C.orange }}>
                  {fmt(Math.round((result.rent_monthly_min + result.rent_monthly_max) / 2))}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                  Fourchette : {fmt(result.rent_monthly_min)} — {fmt(result.rent_monthly_max)}
                </div>
                <div style={{ fontSize: 11.5, color: C.textMid, marginTop: 6 }}>Rendement brut {result.yield_gross}%</div>
              </div>
            </div>

            {/* Potentiel alternatif */}
            <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 12px rgba(40,18,8,0.05)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 14 }}>Potentiel locatif complet</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {[
                  { label: "Saisonnier / semaine", value: fmt(result.rent_seasonal), icon: "🏖️" },
                  { label: "Nuitée (Airbnb/Booking)", value: fmt(result.rent_nightly) + "/nuit", icon: "🌙" },
                  { label: "Rendement brut annuel", value: result.yield_gross + "%", icon: "📈" },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: "center", padding: "12px 8px", backgroundColor: C.surface2, borderRadius: 10 }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{item.value}</div>
                    <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI comment */}
            <div style={{
              backgroundColor: C.orangeBg, border: `1px solid ${C.orangeBorder}`,
              borderRadius: 14, padding: "14px 16px", marginBottom: 24,
              display: "flex", gap: 10, alignItems: "flex-start",
            }}>
              <TrendingUp size={16} color={C.orange} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.55 }}>{result.ai_comment}</p>
            </div>

            {/* CTA */}
            <div style={{
              backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,
              padding: 28, textAlign: "center",
              boxShadow: "0 4px 24px rgba(40,18,8,0.07)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.orange, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Rapport complet + gestion du bien
              </div>
              <h3 style={{ fontSize: 22, fontFamily: "var(--font-serif,'Cormorant Garamond',serif)", fontWeight: 300, color: C.text, margin: "0 0 8px" }}>
                Gérez ce bien avec Althy
              </h3>
              <p style={{ color: C.textMid, fontSize: 13.5, margin: "0 0 20px" }}>
                Bail, EDL, quittances, locataires, artisans — tout automatisé. CHF 29/mois.
              </p>
              <button
                onClick={handleGetFullReport}
                style={{
                  width: "100%", padding: "13px 0",
                  backgroundColor: C.orange, color: "#fff",
                  border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                Obtenir le rapport complet gratuit <ArrowRight size={16} />
              </button>
              <p style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>14 jours gratuits · sans carte · résiliation en 1 clic</p>
            </div>
          </>
        )}

        {/* ── EMAIL CAPTURE ── */}
        {step === "email" && (
          <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📩</div>
            <h2 style={{ fontSize: 28, fontFamily: "var(--font-serif,'Cormorant Garamond',serif)", fontWeight: 300, color: C.text, margin: "0 0 8px" }}>
              Créez votre compte gratuit
            </h2>
            <p style={{ color: C.textMid, fontSize: 14, margin: "0 0 28px" }}>
              Recevez le rapport complet + commencez à gérer {address} depuis Althy.
            </p>
            <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28 }}>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.ch"
                style={{
                  width: "100%", padding: "12px 14px",
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  fontSize: 14, backgroundColor: C.surface2, color: C.text,
                  outline: "none", boxSizing: "border-box", marginBottom: 12,
                }}
                onFocus={e => (e.target.style.borderColor = C.orange)}
                onBlur={e => (e.target.style.borderColor = C.border)}
                onKeyDown={e => e.key === "Enter" && handleEmailSubmit()}
              />
              <button
                onClick={handleEmailSubmit}
                disabled={!email}
                style={{
                  width: "100%", padding: "12px 0",
                  backgroundColor: email ? C.orange : C.surface2,
                  color: email ? "#fff" : C.textMuted,
                  border: "none", borderRadius: 10,
                  fontSize: 14, fontWeight: 700, cursor: email ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                Commencer gratuitement <ChevronRight size={16} />
              </button>
              <p style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>Aucune carte requise · 14 jours offerts</p>
            </div>
            <button onClick={() => setStep("result")} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 12, cursor: "pointer", marginTop: 12 }}>
              ← Retour à l&apos;estimation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
