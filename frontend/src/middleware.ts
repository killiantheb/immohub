import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROLE_ROUTES: Record<string, string> = {
  owner:       "/app/dashboard",
  agency:      "/app/dashboard",
  opener:      "/opener",
  tenant:      "/tenant",
  company:     "/company",
  super_admin: "/app/dashboard",
};

const AUTH_ROUTES      = ["/login", "/register"];
const PRIVATE_PREFIXES = ["/app", "/opener", "/tenant", "/company"];

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  // Redirect production domain only (althy.ch) — keep vercel.app accessible for testing
  // Uncomment when althy.ch is live and configured in Vercel:
  // if (host === "althy.ch" || host === "www.althy.ch") { /* keep */ }
  // if (host.endsWith(".vercel.app") && process.env.REDIRECT_VERCEL_TO_ALTHY === "true") {
  //   const url = request.nextUrl.clone();
  //   url.host = "althy.ch";
  //   url.protocol = "https:";
  //   return NextResponse.redirect(url, 301);
  // }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as any),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() validates JWT server-side — never use getSession() in middleware
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const role = user?.user_metadata?.role as string | undefined;

  // Authenticated user on auth pages → redirect to role home
  if (user && isAuthRoute(pathname)) {
    const target = (role && ROLE_ROUTES[role]) || "/app/dashboard";
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Unauthenticated user on private route → redirect to login
  const isPrivate = PRIVATE_PREFIXES.some((p) => pathname.startsWith(p));
  if (!user && isPrivate) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user on root → redirect to role home
  if (user && pathname === "/") {
    const target = (role && ROLE_ROUTES[role]) || "/app/dashboard";
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Role-based guard on /app — opener/tenant/company don't belong in the main dashboard
  if (user && pathname.startsWith("/app")) {
    if (role === "opener") return NextResponse.redirect(new URL("/opener", request.url));
    if (role === "tenant") return NextResponse.redirect(new URL("/tenant", request.url));
    if (role === "company") return NextResponse.redirect(new URL("/company", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
