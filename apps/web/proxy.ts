import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { apiUrl, SESSION_COOKIE } from "@/lib/api/config";
import { HIDDEN_API_PATHS } from "@/lib/security-headers";

/**
 * Runs before every route (Next 16 "proxy", formerly middleware).
 *
 * 1. /api/* is forwarded to the FastAPI service, so the browser only ever talks to
 *    this origin and the session cookie stays an httpOnly cookie on it (no CORS).
 *    FastAPI's documentation paths are never forwarded: they answer 404 (SEC-003).
 * 2. A page request without a session cookie is sent to /login. The root layout still
 *    checks the cookie with the API, because a cookie can exist but be expired.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (HIDDEN_API_PATHS.includes(pathname)) {
    return NextResponse.json({ detail: "Not Found" }, { status: 404 });
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    const target = `${apiUrl()}${pathname.slice("/api".length) || "/"}${search}`;
    return NextResponse.rewrite(new URL(target));
  }

  const signedIn = request.cookies.has(SESSION_COOKIE);
  if (!signedIn && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Tell the root layout which page is rendering (layouts do not get the path).
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // /api/* always (also files such as export.csv); otherwise everything except Next's own assets
  // and files with an extension (icons, images).
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|.*\\..*).*)"],
};
