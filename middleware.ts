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
  // Supabase setzt Cookies je nach Projekt-Ref:
  // sb-<projectref>-auth-token (und evtl. weitere)
  const all = request.cookies.getAll();
  return all.some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Public niemals blocken
  if (isPublicPath(pathname)) return NextResponse.next();

  // API nicht blocken (sonst killt es Import & Callbacks)
  if (pathname.startsWith("/api")) return NextResponse.next();

  const authed = hasSupabaseAuthCookie(request);

  if (!authed) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname + (search || ""));
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
