import { NextResponse, type NextRequest } from "next/server";

const PRODUCTION_HOST = "management.blooddiamond-tattoo.de";

const isExcludedRoute = (pathname: string) => {
  if (pathname === "/login" || pathname === "/favicon.ico") {
    return true;
  }

  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return true;
  }

  return /\.(.*)$/.test(pathname);
};

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (host !== PRODUCTION_HOST) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  if (isExcludedRoute(pathname)) {
    return NextResponse.next();
  }

  const isAuthenticated = req.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.value);

  if (!isAuthenticated) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|api).*)"] };
