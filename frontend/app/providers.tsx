"use client";

import { NavigationBlockerProvider } from "@/lib/navigation-blocker";

export function Providers({ children }: { children: React.ReactNode }) {
  return <NavigationBlockerProvider>{children}</NavigationBlockerProvider>;
}
