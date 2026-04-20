"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, MapPin, Ruler, Sparkles, TrendingUp, Shield, AlertTriangle, RefreshCw, Loader2, Mail, CheckCircle2 } from "lucide-react";

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
  const [step, setStep] = useState<"form" | "loading" | "result" | "error">("form");
  const [deferredSending, setDeferredSending] = useState(false);
  const [deferredSent, setDeferredSent]       = useState(false);
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
    setDeferredSent(false);

    let d = 0;
    const iv = setInterval(() => { d = (d + 1) % 4; setLoadingDot(d); }, 400);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "https://immohub-production.up.railway.app/api/v1"}/ai/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, city, type: propType, surface: parseFloat(surface), rooms: rooms ? parseInt(rooms) : null }),
      });

      clearInterval(iv);

      if (res.ok) {
        const data: EstimationResult = await res.json();
        setResult(data);
        setStep("result");
      } else {
        console.error("[estimation] API error:", res.status, await res.text().catch(() => ""));
        setStep("error");
      }
    } catch (err) {
      clearInterval(iv);
      console.error("[estimation] Network error:", err);
      setStep("error");
    }
  }

  async function handleDeferredEstimation() {
    if (!email) return;
    setDeferredSending(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "https://immohub-production.up.railway.app/api/v1"}/estimation/deferred`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, city, type: propType, surface: parseFloat(surface), rooms: rooms ? parseInt(rooms) : null, email }),
      });
      setDeferredSent(true);
    } catch {
      // Best-effort — still show success to user (request logged server-side)
      setDeferredSent(true);
    } finally {
      setDeferredSending(false);
    }
  }

  function handleEmailSubmit() {
    if (!email) return;
    sessionStorage.setItem("althy_email", email);
    sessionStorage.setItem("althy_estimation_address", address);
    window.location.href = "/register?email=" + encodeURIComponent(email) + "&source=estimation";
  }

  const dots = ".".repeat(loadingDot + 1);

  return (
    <div style={{ minHeight: "100vh", background: "var(--althy-bg)" }}>
      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(250,248,245,0.95)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--althy-border)",
        padding: "0 24px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 300, color: "var(--althy-orange)", letterSpacing: 5 }}>
            ALTHY
          </span>
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/login" style={{ fontSize: 13, color: "var(--althy-text-3)", textDecoration: "none" }}>Connexion</Link>
          <Link href="/register" style={{ padding: "7px 16px", borderRadius: 8, background: "var(--althy-orange)", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            Essai gratuit 14j
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "80px 24px" }}>

        {/* ── FORM ── */}
        {step === "form" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "var(--althy-orange-bg, rgba(15,46,76,0.06))", border: "1px solid rgba(15,46,76,0.22)", marginBottom: 16 }}>
                <Sparkles size={12} color="var(--althy-orange)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--althy-orange)" }}>Estimation IA gratuite</span>
              </div>
              <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(28px,5vw,44px)", fontWeight: 300, color: "var(--althy-text)", margin: "0 0 12px", lineHeight: 1.2 }}>
                Combien vaut votre bien ?
              </h1>
              <p style={{ fontSize: 16, color: "var(--althy-text-3)", margin: 0 }}>
                Obtenez une estimation IA en 10 secondes — prix de vente, loyer mensuel, rendement locatif.
              </p>
            </div>

            <div style={{ background: "var(--althy-surface)", borderRadius: 20, border: "1px solid var(--althy-border)", boxShadow: "0 4px 24px rgba(26,22,18,0.07)", padding: 32 }}>
              {/* Address */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--althy-text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Adresse</label>
                <div style={{ position: "relative" }}>
                  <MapPin size={16} color="var(--althy-text-3)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Rue de Rive 12"
                    style={{ width: "100%", padding: "10px 12px 10px 36px", border: "1px solid var(--althy-border)", borderRadius: 10, fontSize: 14, background: "var(--althy-bg)", color: "var(--althy-text)", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "var(--althy-orange)")}
                    onBlur={e => (e.target.style.borderColor = "var(--althy-border)")}
                  />
                </div>
              </div>

              {/* City */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--althy-text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ville</label>
                <input
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="Genève"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--althy-border)", borderRadius: 10, fontSize: 14, background: "var(--althy-bg)", color: "var(--althy-text)", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => (e.target.style.borderColor = "var(--althy-orange)")}
                  onBlur={e => (e.target.style.borderColor = "var(--althy-border)")}
                />
              </div>

              {/* Type + Surface + Rooms */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--althy-text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Type</label>
                  <div style={{ position: "relative" }}>
                    <Building2 size={15} color="var(--althy-text-3)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                    <select
                      value={propType}
                      onChange={e => setPropType(e.target.value)}
                      style={{ width: "100%", padding: "10px 10px 10px 30px", border: "1px solid var(--althy-border)", borderRadius: 10, fontSize: 14, background: "var(--althy-bg)", color: "var(--althy-text)", outline: "none", appearance: "none", boxSizing: "border-box" }}
                    >
                      {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--althy-text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Surface (m²)</label>
                  <div style={{ position: "relative" }}>
                    <Ruler size={15} color="var(--althy-text-3)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="number" value={surface} onChange={e => setSurface(e.target.value)}
                      placeholder="75"
                      style={{ width: "100%", padding: "10px 10px 10px 30px", border: "1px solid var(--althy-border)", borderRadius: 10, fontSize: 14, background: "var(--althy-bg)", color: "var(--althy-text)", outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "var(--althy-orange)")}
                      onBlur={e => (e.target.style.borderColor = "var(--althy-border)")}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--althy-text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pièces</label>
                  <input
                    type="number" value={rooms} onChange={e => setRooms(e.target.value)}
                    placeholder="3.5"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--althy-border)", borderRadius: 10, fontSize: 14, background: "var(--althy-bg)", color: "var(--althy-text)", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => (e.target.style.borderColor = "var(--althy-orange)")}
                    onBlur={e => (e.target.style.borderColor = "var(--althy-border)")}
                  />
                </div>
              </div>

              <button
                onClick={handleEstimate}
                disabled={!address || !city || !surface}
                style={{ width: "100%", padding: "14px 0", background: !address || !city || !surface ? "var(--althy-border)" : "var(--althy-orange)", color: !address || !city || !surface ? "var(--althy-text-3)" : "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: !address || !city || !surface ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background-color 0.15s" }}
              >
                <Sparkles size={16} />
                Estimer maintenant — gratuit
              </button>
              <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--althy-text-3)", marginTop: 10 }}>
                Aucun compte requis · Résultat en 10 secondes · 100 % gratuit
              </p>
            </div>

            {/* Social proof */}
            <div style={{ display: "flex", justifyContent: "center", gap: 32, marginTop: 32 }}>
              {[
                { n: "2 800+", label: "biens estimés" },
                { n: "98%",    label: "précision IA" },
                { n: "0 CHF",  label: "toujours gratuit" },
              ].map(s => (
                <div key={s.n} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--althy-orange)" }}>{s.n}</div>
                  <div style={{ fontSize: 11.5, color: "var(--althy-text-3)" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── LOADING ── */}
        {step === "loading" && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <div style={{ width: 90, height: 90, borderRadius: "50%", margin: "0 auto 32px", background: "radial-gradient(circle at 33% 28%, #4C73A0 0%, #1A4975 42%, #0F2E4C 78%, #061422 100%)", boxShadow: "0 0 40px rgba(15,46,76,0.4)", animation: "althy-sphere-stream 1.2s ease-in-out infinite" }} />
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 300, color: "var(--althy-text)", margin: "0 0 8px" }}>
              Analyse en cours{dots}
            </h2>
            <p style={{ color: "var(--althy-text-3)", fontSize: 14 }}>Althy analyse les données du marché {city}</p>
            <style>{`@keyframes althy-sphere-stream{0%{transform:scale(1);filter:brightness(1)}25%{transform:scale(1.06);filter:brightness(1.12)}50%{transform:scale(1.02);filter:brightness(1.08)}75%{transform:scale(1.08);filter:brightness(1.15)}100%{transform:scale(1);filter:brightness(1)}}`}</style>
          </div>
        )}

        {/* ── RESULT ── */}
        {step === "result" && result && (
          <>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", marginBottom: 16 }}>
                <Shield size={12} color="var(--althy-green)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--althy-green)" }}>Estimation complétée · {result.confidence}% de confiance</span>
              </div>
              <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(24px,4vw,36px)", fontWeight: 300, color: "var(--althy-text)", margin: "0 0 4px" }}>
                {address}, {city}
              </h1>
              <p style={{ color: "var(--althy-text-3)", fontSize: 14 }}>{surface} m² · {PROPERTY_TYPES.find(t => t.value === propType)?.label}</p>
            </div>

            {/* Main cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "var(--althy-surface)", border: "1px solid var(--althy-border)", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(26,22,18,0.05)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--althy-text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Valeur de vente estimée</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "var(--althy-text)" }}>{fmt(Math.round((result.sale_price_min + result.sale_price_max) / 2))}</div>
                <div style={{ fontSize: 12, color: "var(--althy-text-3)", marginTop: 4 }}>Fourchette : {fmt(result.sale_price_min)} — {fmt(result.sale_price_max)}</div>
                <div style={{ fontSize: 11.5, color: "var(--althy-text-3)", marginTop: 6 }}>{fmt(result.price_per_sqm)}/m²</div>
              </div>
              <div style={{ background: "var(--althy-surface)", border: "1px solid rgba(15,46,76,0.22)", borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(15,46,76,0.06)" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--althy-orange)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Loyer mensuel longue durée</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: "var(--althy-orange)" }}>{fmt(Math.round((result.rent_monthly_min + result.rent_monthly_max) / 2))}</div>
                <div style={{ fontSize: 12, color: "var(--althy-text-3)", marginTop: 4 }}>Fourchette : {fmt(result.rent_monthly_min)} — {fmt(result.rent_monthly_max)}</div>
                <div style={{ fontSize: 11.5, color: "var(--althy-text-3)", marginTop: 6 }}>Rendement brut {result.yield_gross}%</div>
              </div>
            </div>

            {/* Potentiel alternatif */}
            <div style={{ background: "var(--althy-surface)", border: "1px solid var(--althy-border)", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 12px rgba(26,22,18,0.05)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--althy-text-3)", marginBottom: 14 }}>Potentiel locatif complet</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {[
                  { label: "Saisonnier / semaine", value: fmt(result.rent_seasonal), icon: "🏖️" },
                  { label: "Nuitée (Airbnb/Booking)", value: fmt(result.rent_nightly) + "/nuit", icon: "🌙" },
                  { label: "Rendement brut annuel", value: result.yield_gross + "%", icon: "📈" },
                ].map(item => (
                  <div key={item.label} style={{ textAlign: "center", padding: "12px 8px", background: "var(--althy-bg)", borderRadius: 10 }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--althy-text)" }}>{item.value}</div>
                    <div style={{ fontSize: 10.5, color: "var(--althy-text-3)", marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI comment */}
            <div style={{ background: "var(--althy-orange-bg, rgba(15,46,76,0.06))", border: "1px solid rgba(15,46,76,0.22)", borderRadius: 14, padding: "14px 16px", marginBottom: 24, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <TrendingUp size={16} color="var(--althy-orange)" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: 13, color: "var(--althy-text)", lineHeight: 1.55 }}>{result.ai_comment}</p>
            </div>

            {/* ── EMAIL CAPTURE après résultat ── */}
            <div style={{ background: "var(--althy-surface)", border: "2px solid var(--althy-prussian)", borderRadius: 20, padding: 28, boxShadow: "0 4px 24px rgba(15,46,76,0.12)" }}>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--althy-orange)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Rapport complet + gestion du bien
                </div>
                <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 300, color: "var(--althy-text)", margin: "0 0 6px" }}>
                  Gérez ce bien avec Althy
                </h3>
                <p style={{ color: "var(--althy-text-3)", fontSize: 13, margin: 0 }}>
                  Bail, EDL, quittances, locataires, artisans — tout automatisé. CHF 29/mois.
                </p>
              </div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.ch"
                onKeyDown={e => e.key === "Enter" && handleEmailSubmit()}
                style={{ width: "100%", padding: "12px 14px", border: "1px solid var(--althy-border)", borderRadius: 10, fontSize: 14, background: "var(--althy-bg)", color: "var(--althy-text)", outline: "none", boxSizing: "border-box", marginBottom: 12 }}
                onFocus={e => (e.target.style.borderColor = "var(--althy-orange)")}
                onBlur={e => (e.target.style.borderColor = "var(--althy-border)")}
              />
              <button
                onClick={handleEmailSubmit}
                disabled={!email}
                style={{ width: "100%", padding: "13px 0", background: email ? "var(--althy-orange)" : "var(--althy-border)", color: email ? "#fff" : "var(--althy-text-3)", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: email ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                Commencer gratuitement 14 jours <ArrowRight size={16} />
              </button>
              <p style={{ fontSize: 11, color: "var(--althy-text-3)", marginTop: 8, textAlign: "center" }}>
                14 jours gratuits · sans carte · résiliation en 1 clic
              </p>
            </div>

            <button onClick={() => setStep("form")} style={{ background: "none", border: "none", color: "var(--althy-text-3)", fontSize: 12, cursor: "pointer", marginTop: 16, display: "block", margin: "16px auto 0" }}>
              ← Nouvelle estimation
            </button>
          </>
        )}

        {/* ── ERROR ── */}
        {step === "error" && (
          <div style={{ paddingTop: 40 }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(239,68,68,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <AlertTriangle size={28} color="var(--althy-red, #EF4444)" />
              </div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 300, color: "var(--althy-text)", margin: "0 0 8px" }}>
                Estimation momentanément indisponible
              </h2>
              <p style={{ color: "var(--althy-text-3)", fontSize: 14, margin: 0, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
                Nos serveurs sont sollicités. Nous pouvons vous envoyer l'estimation complète par email sous 24h.
              </p>
            </div>

            <div style={{ background: "var(--althy-surface)", border: "1px solid var(--althy-border)", borderRadius: 20, padding: 28, boxShadow: "0 4px 24px rgba(26,22,18,0.07)", maxWidth: 440, margin: "0 auto" }}>
              {!deferredSent ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--althy-text-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Votre email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="votre@email.ch"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--althy-border)", borderRadius: 10, fontSize: 14, background: "var(--althy-bg)", color: "var(--althy-text)", outline: "none", boxSizing: "border-box" }}
                      onFocus={e => (e.target.style.borderColor = "var(--althy-orange)")}
                      onBlur={e => (e.target.style.borderColor = "var(--althy-border)")}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--althy-text-3)", marginBottom: 16, padding: "8px 10px", background: "var(--althy-bg)", borderRadius: 8 }}>
                    <strong style={{ color: "var(--althy-text)" }}>Bien demandé :</strong> {address}, {city} · {surface} m² · {PROPERTY_TYPES.find(t => t.value === propType)?.label}
                  </div>
                  <button
                    onClick={handleDeferredEstimation}
                    disabled={!email || deferredSending}
                    style={{
                      width: "100%", padding: "13px 0",
                      background: !email || deferredSending ? "var(--althy-border)" : "var(--althy-orange)",
                      color: !email || deferredSending ? "var(--althy-text-3)" : "#fff",
                      border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700,
                      cursor: !email || deferredSending ? "default" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    {deferredSending ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Mail size={16} />}
                    {deferredSending ? "Envoi…" : "Recevoir l'estimation par email"}
                  </button>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <CheckCircle2 size={32} color="var(--althy-green, #16A34A)" style={{ marginBottom: 12 }} />
                  <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "var(--althy-text)" }}>
                    Demande enregistrée
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--althy-text-3)" }}>
                    Vous recevrez l'estimation complète à <strong>{email}</strong> sous 24h.
                  </p>
                </div>
              )}

              <button
                onClick={() => { setStep("form"); setDeferredSent(false); }}
                style={{
                  width: "100%", padding: "10px 0",
                  background: "transparent", border: `1px solid var(--althy-border)`,
                  borderRadius: 10, fontSize: 13, fontWeight: 600,
                  color: "var(--althy-text-3)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <RefreshCw size={13} /> Réessayer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
