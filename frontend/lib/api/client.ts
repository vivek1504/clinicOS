import type { ErrorEnvelope } from "./types";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Server Components call the backend directly, so the browser's session cookie has to be forwarded by hand.
 * `lib/api/server.ts` registers the source (next/headers) from the root layout; client bundles never import it.
 */
let serverCookieSource: (() => Promise<string>) | null = null;
export function setServerCookieSource(fn: () => Promise<string>) {
  serverCookieSource = fn;
}

function baseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.API_URL ?? "http://localhost:3001";
  }
  return "/api";
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) };
  if (typeof window === "undefined" && serverCookieSource) {
    const cookie = await serverCookieSource();
    if (cookie) headers.cookie = cookie;
  }
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, { ...init, cache: "no-store", headers });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new ApiError("NETWORK", "Could not reach the server", 0);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ErrorEnvelope | null;
    // Session expired mid-use in the browser: go sign in. In-progress notes are already mirrored to sessionStorage.
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/")) {
      // Full navigation on purpose: a stale session should reset all client state, not just change route.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    throw new ApiError(
      body?.error?.code ?? `HTTP_${res.status}`,
      body?.error?.message ?? res.statusText,
      res.status,
    );
  }

  return (await res.json()) as T;
}

export function isApiError(err: unknown, code?: string): err is ApiError {
  return err instanceof ApiError && (code === undefined || err.code === code);
}
