"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { C } from "@/lib/design-tokens";


export default function AcceptPage() {
  return <AcceptContent />;
}

function AcceptContent() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const valid = password.length >= 8 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setError(null);
    setLoading(true);

    try {
      // Supabase redirects the invite link with tokens in the URL hash/params.
      // The @supabase/ssr client auto-picks up the session from the URL on load.
      // We just need to set the password via updateUser.
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        // Handle expired/invalid token
        if (updateError.message?.includes("expired") || updateError.message?.includes("invalid")) {
          setError("Ce lien d'invitation a expiré. Contactez votre agence pour recevoir un nouveau lien.");
        } else {
          setError(updateError.message || "Erreur lors de la mise à jour du mot de passe.");
        }
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/app"), 2000);
    } catch {
      setError("Erreur inattendue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──
  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <CheckCircle size={48} color={C.orange} style={{ marginBottom: 16 }} />
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 300, color: C.text, marginBottom: 8 }}>
            Mot de passe créé
          </h1>
          <p style={{ color: C.text2, fontSize: 14 }}>
            Redirection vers votre espace...
          </p>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 300, color: C.orange, letterSpacing: 6 }}>
              ALTHY
            </span>
          </Link>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radiusCard, padding: 32 }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 300, color: C.text, margin: "0 0 8px", textAlign: "center" }}>
            Créez votre mot de passe
          </h1>
          <p style={{ color: C.text3, fontSize: 13, textAlign: "center", margin: "0 0 24px" }}>
            Bienvenue sur Althy. Choisissez un mot de passe pour accéder à votre espace propriétaire.
          </p>

          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, background: "#FEE8E6", borderRadius: 8, marginBottom: 16 }}>
              <AlertCircle size={16} color="var(--althy-red)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 13, color: "var(--althy-red)" }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Password */}
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
              Mot de passe
            </label>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 caractères"
                required
                minLength={8}
                style={{
                  width: "100%", padding: "10px 40px 10px 12px", border: `1px solid ${C.border}`,
                  borderRadius: 8, fontSize: 14, color: C.text, background: C.bg,
                  outline: "none", boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {showPw ? <EyeOff size={16} color={C.text3} /> : <Eye size={16} color={C.text3} />}
              </button>
            </div>

            {/* Confirm */}
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
              Confirmer le mot de passe
            </label>
            <div style={{ position: "relative", marginBottom: 4 }}>
              <input
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Retapez le mot de passe"
                required
                minLength={8}
                style={{
                  width: "100%", padding: "10px 40px 10px 12px", border: `1px solid ${C.border}`,
                  borderRadius: 8, fontSize: 14, color: C.text, background: C.bg,
                  outline: "none", boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {showConfirm ? <EyeOff size={16} color={C.text3} /> : <Eye size={16} color={C.text3} />}
              </button>
            </div>

            {/* Mismatch hint */}
            {confirm.length > 0 && password !== confirm && (
              <p style={{ fontSize: 12, color: "var(--althy-red)", margin: "4px 0 0" }}>
                Les mots de passe ne correspondent pas
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!valid || loading}
              style={{
                width: "100%", marginTop: 24, padding: "12px 0",
                background: valid && !loading ? C.orange : "#ccc",
                color: "#fff", border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: valid && !loading ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Création en cours..." : "Créer mon compte"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: C.text3, marginTop: 16 }}>
          En continuant, vous acceptez les{" "}
          <Link href="/legal/cgu" style={{ color: C.orange, textDecoration: "none" }}>
            conditions d&apos;utilisation
          </Link>.
        </p>
      </div>
    </div>
  );
}
