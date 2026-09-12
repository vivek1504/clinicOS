import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { setServerCookieSource, setServerUnauthorizedHandler } from "./client";

// Imported once from the root layout so every server-side apiFetch carries the browser's session cookie.
setServerCookieSource(async () => (await cookies()).toString());

// A revoked or expired session anywhere in a server render goes to sign-in, not to the nearest error boundary.
setServerUnauthorizedHandler(() => redirect("/sign-in?expired=1"));
