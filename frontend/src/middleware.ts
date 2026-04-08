import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes accessibles sans authentification
const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/terms", "/privacy", "/legal", "/contact"];
// Préfixes qui nécessitent une session
const PROTECTED_PREFIXES = ["/app"];
// Préfixes anciens (portails séparés) → redirigés vers /app
const LEGACY_PORTALS: Record<string, string> = {
  "/opener":  "/app",
  "/tenant":  "/app",
  "/company": "/app",
};

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
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

  // Utilisateur connecté sur page auth → home
  if (user && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  // Utilisateur connecté sur / → home
  if (user && pathname === "/") {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
