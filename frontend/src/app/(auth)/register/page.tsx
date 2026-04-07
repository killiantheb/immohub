"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { AlthyLogo } from "@/components/AlthyLogo";
import { useAuth } from "@/lib/auth";

const schema = z
  .object({
    first_name: z.string().min(1, "Prénom requis").max(100),
    last_name: z.string().min(1, "Nom requis").max(100),
    email: z.string().email("Email invalide"),
    role: z.enum(["owner", "agency", "tenant", "opener", "company"]),
    password: z
      .string()
      .min(8, "8 caractères minimum")
      .regex(/[A-Z]/, "Au moins une majuscule")
      .regex(/[0-9]/, "Au moins un chiffre"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

const ROLES = [
  { value: "owner", label: "Propriétaire", desc: "Je gère mes biens en direct" },
  { value: "agency", label: "Agence", desc: "Je gère des biens pour des clients" },
  { value: "tenant", label: "Locataire", desc: "Je cherche ou j'occupe un bien" },
  { value: "opener", label: "Apporteur", desc: "J'apporte des affaires immobilières" },
  { value: "company", label: "Prestataire", desc: "Plombier, électricien, etc." },
] as const;

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8 caractères", ok: password.length >= 8 },
    { label: "Majuscule", ok: /[A-Z]/.test(password) },
    { label: "Chiffre", ok: /[0-9]/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="mt-2 flex gap-3">
      {checks.map(({ label, ok }) => (
        <span
          key={label}
          className={`flex items-center gap-1 text-xs ${ok ? "text-green-600" : "text-gray-400"}`}
        >
          <CheckCircle2 className={`h-3 w-3 ${ok ? "text-green-500" : "text-gray-300"}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: "owner" },
  });

  const password = watch("password", "");

  const onSubmit = async (data: FormValues) => {
    setServerError(null);
    try {
      await signUp(data.email, data.password, {
        first_name: data.first_name,
        last_name: data.last_name,
        role: data.role,
      });
      router.push("/onboarding");
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Erreur lors de l'inscription";
      setServerError(
        msg.includes("already registered")
          ? "Un compte existe déjà avec cet email"
          : msg,
      );
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex lg:w-5/12 flex-col items-center justify-center bg-primary-600 p-12 text-white">
        <div className="mb-6 flex items-center gap-4">
          <AlthyLogo size={52} />
          <span className="text-4xl font-bold tracking-tight">ALTHY</span>
        </div>
        <p className="max-w-xs text-center text-primary-100">
          Rejoignez des centaines de professionnels qui gèrent leur activité
          immobilière avec ALTHY.
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex w-full items-start justify-center overflow-y-auto bg-beige-100 px-6 py-10 lg:w-7/12">
        <div className="w-full max-w-lg">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <AlthyLogo size={32} />
            <span className="text-2xl font-bold text-gray-900">ALTHY</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Créer un compte</h1>
            <p className="mt-1 text-sm text-gray-500">
              Remplissez le formulaire pour accéder à votre espace.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="first_name" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Prénom
                </label>
                <input
                  id="first_name"
                  type="text"
                  autoComplete="given-name"
                  {...register("first_name")}
                  className={`input ${errors.first_name ? "border-red-400" : ""}`}
                  placeholder="Jean"
                />
                {errors.first_name && (
                  <p className="mt-1 text-xs text-red-500">{errors.first_name.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="last_name" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Nom
                </label>
                <input
                  id="last_name"
                  type="text"
                  autoComplete="family-name"
                  {...register("last_name")}
                  className={`input ${errors.last_name ? "border-red-400" : ""}`}
                  placeholder="Dupont"
                />
                {errors.last_name && (
                  <p className="mt-1 text-xs text-red-500">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                className={`input ${errors.email ? "border-red-400" : ""}`}
                placeholder="vous@exemple.com"
              />
              {errors.email && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Je suis…
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ROLES.map((r) => (
                  <label
                    key={r.value}
                    className="relative flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:border-primary-400 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50"
                  >
                    <input
                      type="radio"
                      value={r.value}
                      {...register("role")}
                      className="mt-0.5 accent-primary-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.label}</p>
                      <p className="text-xs text-gray-500">{r.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  {...register("password")}
                  className={`input pr-10 ${errors.password ? "border-red-400" : ""}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrength password={password} />
              {errors.password && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirm_password" className="mb-1.5 block text-sm font-medium text-gray-700">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <input
                  id="confirm_password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  {...register("confirm_password")}
                  className={`input pr-10 ${errors.confirm_password ? "border-red-400" : ""}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirm_password && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {errors.confirm_password.message}
                </p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex w-full items-center justify-center gap-2 py-2.5 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Création du compte…
                </>
              ) : (
                "Créer mon compte"
              )}
            </button>

            <p className="text-center text-xs text-gray-500">
              En créant un compte, vous acceptez nos{" "}
              <Link href="/terms" className="text-primary-600 hover:underline">
                CGU
              </Link>{" "}
              et notre{" "}
              <Link href="/privacy" className="text-primary-600 hover:underline">
                Politique de confidentialité
              </Link>
              .
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Déjà un compte ?{" "}
            <Link href="/login" className="font-medium text-primary-600 hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
