import { redirect } from "next/navigation";
import { getMe } from "./api/auth";
import type { StaffRole } from "./api/types";

/** Server-side gate for a page: the wrong role is sent to its own home instead. The backend enforces the same rule on every request. */
export async function requireRole(role: StaffRole, elsewhere: string) {
  const me = await getMe();
  if (me.role !== role) redirect(elsewhere);
  return me;
}
