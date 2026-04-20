import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, DEFAULT_LOCALE, isSupportedLocale } from "@/i18n/config";

// Routes accessibles sans authentification
const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/legal", "/legal/cgu", "/legal/confidentialite", "/legal/cookies", "/legal/disclaimer-ia", "/contact", "/bientot"];
// Préfixes qui nécessitent une session
const PROTECTED_PREFIXES = ["/app"];
// Préfixes anciens (portails séparés) → redirigés vers /app
const LEGACY_PORTALS: Record<string, string> = {
  "/opener":  "/app",
  "/tenant":  "/app",
  "/company": "/app",
};

/**
 * Détecte un préfixe locale dans l'URL (ex: /fr-FR/biens, /de-CH/).
 * Si trouvé : pose le cookie NEXT_LOCALE, rewrite vers l'URL sans le préfixe.
 * Permet le switch via URL sans restructurer app/ en app/[locale]/.
 */
function detectLocalePrefix(pathname: string): { locale: string | null; stripped: string } {
  const match = pathname.match(/^\/([a-z]{2}(?:-[A-Z]{2})?)(\/.*|$)/);
  if (match && isSupportedLocale(match[1])) {
    return { locale: match[1], stripped: match[2] || "/" };
  }
  return { locale: null, stripped: pathname };
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // ── i18n : URL locale-préfixée → redirige vers URL canonique + pose cookie
  //          ex: /fr-FR/biens → cookie NEXT_LOCALE=fr-FR, redirect /biens
  const { locale: urlLocale, stripped } = detectLocalePrefix(pathname);
  if (urlLocale) {
    const redirectUrl = new URL(stripped + request.nextUrl.search, request.url);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    redirectResponse.cookies.set(LOCALE_COOKIE, urlLocale, { path: "/", sameSite: "lax" });
    return redirectResponse;
  }

  // Pose le cookie locale par défaut si aucun n'est présent (pour SSR cohérent)
  const currentLocaleCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (!currentLocaleCookie || !isSupportedLocale(currentLocaleCookie)) {
    response.cookies.set(LOCALE_COOKIE, DEFAULT_LOCALE, { path: "/", sameSite: "lax" });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() valide le JWT côté serveur
  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.user_metadata?.role as string | undefined;

  // ── Anciens portails séparés → /app ───────────────────────────────────────
  for (const [prefix, target] of Object.entries(LEGACY_PORTALS)) {
    if (pathname.startsWith(prefix)) {
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  const isPublic    = PUBLIC_ROUTES.some(p => pathname === p || pathname.startsWith(`${p}/`));
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));

  // Utilisateur non-connecté sur route protégée → login
  if (!user && isProtected) {
    const url = new URL("/login", request.url);
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Utilisateur connecté sur page auth → sphère IA (first-screen)
  if (user && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/app/sphere", request.url));
  }

  // Utilisateur connecté sur / → sphère IA (first-screen)
  if (user && pathname === "/") {
    return NextResponse.redirect(new URL("/app/sphere", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
