import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "fintrack_session";
const AUTH_ROUTES = ["/login", "/signup"];

/**
 * Fast path only: bounce obviously logged-out traffic before rendering an app
 * route. Real authorisation happens in the app layout, which validates the
 * session against the database.
 *
 * Deliberately one-directional. Redirecting *away* from /login on mere cookie
 * presence would fight the layout's DB check whenever a cookie outlives its
 * session row (expired, revoked, or pointing at a different database),
 * producing an infinite redirect loop. The auth pages run their own validated
 * check instead.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (!hasSession && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, the manifest, icons and other static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js).*)"],
};
