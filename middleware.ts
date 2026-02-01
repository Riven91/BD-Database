import { NextRequest, NextResponse } from "next/server";

const PRODUCTION_HOST = "management.blooddiamond-tattoo.de";
const PUBLIC_FILE = /\.(.*)$/;

function isBypassPath(pathname: string) {
  // Login pages are always public
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;

  // Never gate APIs or Next internals
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next")) return true;

  // Common public files
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  if (PUBLIC_FILE.test(pathname)) return true;

  return false;
}

function isProdHost(req: NextRequest) {
  const hostname = (req.nextUrl.hostname || "").toLowerCase();
  return hostname === PRODUCTION_HOST;
}

export function middleware(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl;

    // Always allow the request to continue.
    // Keep debug headers so you can verify middleware is running.
    const res = NextResponse.next();
    res.headers.set("x-mw", "1");
    res.headers.set("x-mw-path", pathname);

    if (isProdHost(req)) res.headers.set("x-mw-prod", "1");
    if (isBypassPath(pathname)) res.headers.set("x-mw-bypass", "1");

    // IMPORTANT:
    // No auth gating here. No redirects. No cookie heuristics.
    // This prevents lockouts when auth is stored in localStorage.
    return res;
  } catch (e) {
    console.error("MIDDLEWARE_FAIL", e);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/:path*"],
};
