"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { AlthyLogo } from "@/components/AlthyLogo";
import { useAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase";

// ── Constants ─────────────────────────────────────────────────────────────────

const CGU_VERSION = "2026-04";

const ROLE_OPTIONS = [
  { role: "proprio_solo", icon: "🏠", label: "Je suis propriétaire",         sub: "Gérez vos biens, baux et loyers" },
  { role: "locataire",    icon: "🔑", label: "Je cherche un logement",        sub: "Candidatez, signez, suivez" },
  { role: "artisan",      icon: "🔧", label: "Je suis artisan / professionnel", sub: "Missions, devis, facturation" },
] as const;

// ── Schema étape 1 ────────────────────────────────────────────────────────────

const schema = z
  .object({
    email:            z.string().email("Email invalide"),
    password:         z.string()
                        .min(8, "8 caractères minimum")
                        .regex(/[A-Z]/, "Au moins une majuscule")
                        .regex(/[0-9]/, "Au moins un chiffre"),
    confirm_password: z.string(),
    cgu_accepted:     z.literal(true, {
      errorMap: () => ({ message: "Vous devez accepter les CGU pour continuer" }),
    }),
  })
  .refine(d => d.password === d.confirm_password, {
    message: "Les mots de passe ne correspondent pas",
    path:    ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

// ── Password strength ─────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: "8 caractères", ok: password.length >= 8 },
    { label: "Majuscule",    ok: /[A-Z]/.test(password) },
    { label: "Chiffre",      ok: /[0-9]/.test(password) },
  ];
  return (
    <div className="mt-2 flex gap-3">
      {checks.map(({ label, ok }) => (
        <span key={label} className={`flex items-center gap-1 text-xs ${ok ? "text-green-600" : "text-gray-400"}`}>
          <CheckCircle2 className={`h-3 w-3 ${ok ? "text-green-500" : "text-gray-300"}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

function RegisterForm() {
  const router      = useRouter();
  const params      = useSearchParams();
  const { signUp }  = useAuth();

  const [step,        setStep]       = useState<"creds" | "role">("creds");
  const [creds,       setCreds]      = useState({ email: "", password: "" });
  const [roleLoading, setRoleLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPw]    = useState(false);
  const [showConfirm,  setShowCfm]   = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver:      zodResolver(schema),
    defaultValues: { email: params.get("email") ?? "" },
  });

  const password = watch("password", "");

  // ── Étape 1 : valider email + password, avancer vers choix du rôle ───────────

  const onCredsSubmit = (data: FormValues) => {
    setCreds({ email: data.email, password: data.password });
    setServerError(null);
    setStep("role");
  };

  // ── Étape 2 : créer le compte avec le rôle choisi ────────────────────────────

  const pickRole = async (role: string) => {
    setRoleLoading(true);
    setServerError(null);
    try {
      await signUp(creds.email, creds.password, {
        first_name:      "",
        last_name:       "",
        role,
        cgu_accepted_at: new Date().toISOString(),
        cgu_version:     CGU_VERSION,
      });
      router.push("/app/sphere");
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Erreur lors de l'inscription";
      setServerError(
        msg.includes("already registered") || msg.includes("already been registered")
          ? "Un compte existe déjà avec cet email"
          : msg,
      );
      setStep("creds");
    } finally {
      setRoleLoading(false);
    }
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────────

  const handleGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen" style={{ position: "relative" }}>
      {/* Retour */}
      <div style={{ position: "absolute", top: 20, left: 24, zIndex: 10 }}>
        <Link href="/" style={{ fontSize: 13, color: "var(--althy-text-3, #8A7A6A)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
          ← Retour à althy.ch
        </Link>
      </div>

      {/* Panneau gauche — branding desktop */}
      <div className="hidden lg:flex lg:w-5/12 flex-col items-center justify-center bg-primary-600 p-12 text-white">
        <Link href="/" className="mb-6 flex items-center gap-4" style={{ textDecoration: "none", color: "inherit" }}>
          <AlthyLogo size={52} />
          <span className="text-4xl font-bold tracking-tight">ALTHY</span>
        </Link>
        <p className="max-w-xs text-center text-primary-100">
          Gérez vos biens, contrats et locataires en Suisse — simplement, en français.
        </p>
        <div className="mt-10 space-y-3 text-sm text-primary-200 max-w-xs">
          {["Inscription gratuite, sans carte bancaire", "Sphère IA disponible 24h/24", "Données hébergées en Suisse"].map(v => (
            <div key={v} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary-300 shrink-0" />
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex w-full items-center justify-center bg-beige-100 px-6 py-12 lg:w-7/12">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <Link href="/" className="mb-8 flex items-center justify-center gap-2 lg:hidden" style={{ textDecoration: "none", color: "inherit" }}>
            <AlthyLogo size={32} />
            <span className="text-2xl font-bold text-gray-900">ALTHY</span>
          </Link>

          {/* ═══ ÉTAPE 1 — Email + mot de passe ═══ */}
          {step === "creds" && (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Créer un compte</h1>
                <p className="mt-1 text-sm text-gray-500">Gratuit · Sans carte bancaire · 2 minutes</p>
              </div>

              {/* Google OAuth */}
              <button
                type="button"
                onClick={handleGoogle}
                className="mb-4 flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuer avec Google
              </button>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-beige-100 px-3 text-gray-400">ou par email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit(onCredsSubmit)} className="space-y-4" noValidate>
                {/* Email */}
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Adresse email
                  </label>
                  <input
                    id="email" type="email" autoComplete="email"
                    {...register("email")}
                    className={`input ${errors.email ? "border-red-400" : ""}`}
                    placeholder="vous@exemple.com"
                  />
                  {errors.email && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />{errors.email.message}
                    </p>
                  )}
                </div>

                {/* Mot de passe */}
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      id="password" type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      {...register("password")}
                      className={`input pr-10 ${errors.password ? "border-red-400" : ""}`}
                      placeholder="••••••••"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                  {errors.password && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />{errors.password.message}
                    </p>
                  )}
                </div>

                {/* Confirmer */}
                <div>
                  <label htmlFor="confirm_password" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <input
                      id="confirm_password" type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      {...register("confirm_password")}
                      className={`input pr-10 ${errors.confirm_password ? "border-red-400" : ""}`}
                      placeholder="••••••••"
                    />
                    <button type="button" tabIndex={-1} onClick={() => setShowCfm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirm_password && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="h-3 w-3" />{errors.confirm_password.message}
                    </p>
                  )}
                </div>

                {/* CGU */}
                <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 bg-white p-3">
                  <input type="checkbox" {...register("cgu_accepted")}
                    className="mt-0.5 h-4 w-4 accent-primary-600 shrink-0" />
                  <span className="text-xs text-gray-600 leading-relaxed">
                    J&apos;accepte les{" "}
                    <Link href="/legal/cgu" target="_blank" className="text-primary-600 hover:underline font-medium">CGU</Link>
                    {" "}et la{" "}
                    <Link href="/legal/confidentialite" target="_blank" className="text-primary-600 hover:underline font-medium">politique de confidentialité</Link>
                    .
                  </span>
                </label>
                {errors.cgu_accepted && (
                  <p className="flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle className="h-3 w-3 shrink-0" />{errors.cgu_accepted.message}
                  </p>
                )}

                {/* Erreur serveur */}
                {serverError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{serverError}</span>
                  </div>
                )}

                <button type="submit" disabled={isSubmitting}
                  className="btn-primary flex w-full items-center justify-center gap-2 py-2.5 disabled:opacity-60">
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Vérification…</>
                  ) : "Créer mon compte →"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                Déjà un compte ?{" "}
                <Link href="/login" className="font-medium text-primary-600 hover:underline">Se connecter</Link>
              </p>
            </>
          )}

          {/* ═══ ÉTAPE 2 — Choix du rôle ═══ */}
          {step === "role" && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Que gérez-vous ?</h2>
                <p className="mt-1 text-sm text-gray-500">Althy personnalise votre espace selon votre profil.</p>
              </div>

              {serverError && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{serverError}</span>
                </div>
              )}

              <div className="space-y-3">
                {ROLE_OPTIONS.map(({ role, icon, label, sub }) => (
                  <button
                    key={role}
                    onClick={() => pickRole(role)}
                    disabled={roleLoading}
                    className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 text-left transition-all hover:border-primary-400 hover:bg-primary-50 disabled:opacity-60"
                  >
                    <span style={{ fontSize: 28, lineHeight: 1 }}>{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500">{sub}</p>
                    </div>
                    {roleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400 shrink-0" />
                    ) : (
                      <span className="text-gray-300 shrink-0">→</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Agence — lien discret */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => pickRole("agence")}
                  disabled={roleLoading}
                  className="text-sm text-gray-400 hover:text-primary-600 transition-colors disabled:opacity-60"
                >
                  Je suis une agence immobilière →
                </button>
              </div>

              <button
                onClick={() => setStep("creds")}
                className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600"
              >
                ← Corriger mon email
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
