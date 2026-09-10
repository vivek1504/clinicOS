import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getMe } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let doctor;
  try {
    doctor = await getMe();
  } catch (err) {
    // Cookie present but no longer valid (expired or revoked): the proxy let it through, so redirect here.
    if (isApiError(err) && err.status === 401) redirect("/sign-in?expired=1");
    throw err;
  }
  return <AppShell doctor={doctor}>{children}</AppShell>;
}
