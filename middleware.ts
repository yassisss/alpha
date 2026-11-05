import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "alphateam_session";

function decodeSessionPayload(token?: string): { exp?: number; role?: string } | null {
  if (!token || !token.includes(".")) return null;
  try {
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return null;
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(json);
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = decodeSessionPayload(token);

  const isProtectedPath =
    pathname.startsWith("/home") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/admin");

  const isAuthPage = pathname === "/" || pathname.startsWith("/login");

  // 1. Block unauthenticated users from entering any protected route
  if (isProtectedPath && !session) {
    const loginUrl = new URL("/", req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/dashboard") {
    return NextResponse.redirect(new URL("/home", req.url));
  }

  if (
    pathname.startsWith("/admin") &&
    session &&
    session.role !== "ADMIN" &&
    session.role !== "TEAM"
  ) {
    const homeUrl = new URL("/home", req.url);
    return NextResponse.redirect(homeUrl);
  }
  if (isAuthPage && session) {
    const homeUrl = new URL("/home", req.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login/:path*",
    "/home/:path*",
    "/dashboard/:path*",
    "/courses/:path*",
    "/profile/:path*",
    "/admin/:path*",
  ],
};
