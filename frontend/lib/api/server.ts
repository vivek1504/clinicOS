import { cookies } from "next/headers";
import { setServerCookieSource } from "./client";

// Imported once from the root layout so every server-side apiFetch carries the browser's session cookie.
setServerCookieSource(async () => (await cookies()).toString());
