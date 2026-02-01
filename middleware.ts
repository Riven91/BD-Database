import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

const PUBLIC_FILE = /\.(.*)$/;

function isPublicPath(pathname: string) {
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;

  // never gate APIs or Next internals
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next")) return true;

  // public files
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  if (PUBLIC_FILE.test(pathname)) return true;

  return false;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // IMPORTANT: this is what creates/refreshes the Supabase auth cookies
  const supabase = createMiddlewareClient({ req, res });

  // refresh session if it exists (and set cookies on response)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // Allow public paths always
  if (isPublicPath(pathname)) {
    res.headers.set("x-mw", "1");
    res.headers.set("x-mw-public", "1");
    return res;
  }

  // Everything else requires login
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const redirectRes = NextResponse.redirect(url);

    redirectRes.headers.set("x-mw", "1");
    redirectRes.headers.set("x-mw-redirect", "1");
    return redirectRes;
  }

  res.headers.set("x-mw", "1");
  res.headers.set("x-mw-auth", "1");
  return res;
}

export const config = {
  matcher: ["/:path*"],
};
