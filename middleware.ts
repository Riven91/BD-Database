import { NextResponse, type NextRequest } from "next/server";

function isPublicPath(pathname: string) {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/auth")) return true;

  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;

  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;

  return false;
}

function hasSupabaseAuthCookie(request: NextRequest) {
  // Supabase kann Cookies splitten: ...-auth-token.0 / .1
  const all = request.cookies.getAll();
  return all.some((c) => {
    const n = c.name;
    return (
      n.startsWith("sb-") &&
      (n.endsWith("-auth-token") || n.includes("-auth-token."))
    );
  });
}

async function checkAuthenticatedViaWhoami(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    // Wichtig: absolute URL für middleware fetch
    const url = new URL("/api/whoami", request.nextUrl.origin);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
      // no-store, damit nix cached
      cache: "no-store",
    });

    if (!res.ok) return false;

    const text = await res.text();
    const data = JSON.parse(text);

    return data?.authenticated === true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Public niemals blocken
  if (isPublicPath(pathname)) return NextResponse.next();

  // API niemals über Middleware blocken – API schützt du in den Routes via requireUser()
  if (pathname.startsWith("/api")) return NextResponse.next();

  // Schneller Fallback: wenn nicht mal Supabase-Cookie existiert, direkt auf Login
  const hasCookie = hasSupabaseAuthCookie(request);
  if (!hasCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname + (search || ""));
    return NextResponse.redirect(loginUrl);
  }

  // Harter Check: ist Session wirklich gültig?
  const authed = await checkAuthenticatedViaWhoami(request);
  if (!authed) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname + (search || ""));
    return NextResponse.redirect(loginUrl);
  }

  // Optional: wenn jemand /login aufruft obwohl eingeloggt → zurück ins Dashboard
  if (pathname === "/login") {
    const redirectTo = request.nextUrl.searchParams.get("redirect") || "/";
    const target = request.nextUrl.clone();
    target.pathname = redirectTo;
    return NextResponse.redirect(target);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
