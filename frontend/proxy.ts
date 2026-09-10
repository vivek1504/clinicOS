import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "session";

/**
 * Presence check only: no session cookie means straight to sign-in. The backend validates the
 * cookie itself on every request, and the app layout redirects when it has expired.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/sign-in" || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the API rewrite, Next internals and static files.
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
