import { cache } from "react";
import { apiFetch } from "./client";

export interface DoctorDto {
  id: string;
  name: string;
  email: string;
}

export function signIn(email: string, password: string) {
  return apiFetch<{ doctor: DoctorDto }>("/auth/sign-in", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function signOut() {
  return apiFetch<{ ok: true }>("/auth/sign-out", { method: "POST" });
}

/** Per-request memoized on the server: the layout and the page share one call. */
export const getMe = cache(() => apiFetch<{ doctor: DoctorDto }>("/auth/me").then((r) => r.doctor));
