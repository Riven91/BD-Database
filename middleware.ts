import { NextRequest, NextResponse } from "next/server";

const PRODUCTION_HOST = "management.blooddiamond-tattoo.de";
const PUBLIC_FILE = /\.(.*)$/;

function isBypassPath(pathname: string) {
  // Allow login and everything needed for the app to load and auth to work
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;

  // Never gate APIs or Next internals/assets
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next")) return true;

  // Public files
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  if (PUBLIC_FILE.test(pathname)) return true;

  return false;
}

function hasSupabaseSessionCookie(req: NextRequest) {
  // Supabase typically stores cookies starting with "sb-".
  // We treat presence of any sb-* cookie with a value as "logged in".
  const cookies = req.cookies.getAll();
  return cookies.some((c) => c.name.startsWith("sb-") && !!c.value);
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";

  // Only enforce on the real production host
  if (host !== PRODUCTION_HOST) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Do not gate login, api, next assets, public files
  if (isBypassPath(pathname)) return NextResponse.next();

  // Gate everything else
  if (!hasSupabaseSessionCookie(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};

