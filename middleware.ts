import { NextRequest, NextResponse } from "next/server";

const PRODUCTION_HOST = "management.blooddiamond-tattoo.de";
const PUBLIC_FILE = /\.(.*)$/;

function isBypassPath(pathname: string) {
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;

  // never gate APIs or Next internals
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next")) return true;

  // common public files
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  if (PUBLIC_FILE.test(pathname)) return true;

  return false;
}

function isProdHost(req: NextRequest) {
  // This is safer than relying on raw headers (ports/proxies/case)
  const hostname = (req.nextUrl.hostname || "").toLowerCase();
  return hostname === PRODUCTION_HOST;
}

function hasLikelyAuthCookie(req: NextRequest) {
  const cookies = req.cookies.getAll();

  // Accept any of these patterns as "session likely exists"
  return cookies.some((c) => {
    const n = (c.name || "").toLowerCase();
    if (!c.value) return false;

    return (
      n.startsWith("sb-") ||                   // common supabase cookie prefix
      n.includes("supabase") ||                // some setups
      n.includes("auth-token") ||              // older/other wrappers
      n.includes("access-token") ||
      n.includes("refresh-token")
    );
  });
}

export function middleware(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl;

    // Debug header to prove middleware is running
    const res = NextResponse.next();
    res.headers.set("x-mw", "1");
    res.headers.set("x-mw-path", pathname);

    if (!isProdHost(req)) return res;
    res.headers.set("x-mw-prod", "1");

    if (isBypassPath(pathname)) return res;
    res.headers.set("x-mw-gated", "1");

    if (!hasLikelyAuthCookie(req)) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      const redir = NextResponse.redirect(url);
      redir.headers.set("x-mw", "1");
      redir.headers.set("x-mw-prod", "1");
      redir.headers.set("x-mw-redirect", "1");
      return redir;
    }

    res.headers.set("x-mw-auth", "1");
    return res;
  } catch (e) {
    // Never break prod because of middleware
    console.error("MIDDLEWARE_FAIL", e);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/:path*"],
};
