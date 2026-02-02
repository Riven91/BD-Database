import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isPublicPath(pathname: string) {
  // Login & auth callbacks müssen immer erreichbar bleiben
  if (pathname === "/login") return true;
  if (pathname.startsWith("/auth")) return true;

  // Next internals / static
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;

  // Public files
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Öffentliche Pfade niemals blocken
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // API-Routen erstmal nicht durch Middleware blocken:
  // - sonst killst du dir Import, Webhooks, Supabase callbacks usw.
  // API schützt du über requireUser() in den Routes (hast du schon).
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Wenn ENV fehlt, lieber "fail closed": alles auf Login schicken
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("reason", "missing_env");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Cookie-basierte Session prüfen
  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // damit du nach Login wieder dahin zurück kommst
    loginUrl.searchParams.set("redirect", pathname + (search || ""));
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Alles matchen außer _next/static, _next/image, favicon etc.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
