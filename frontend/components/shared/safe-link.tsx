"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNavigationBlocker } from "@/lib/navigation-blocker";

type SafeLinkProps = React.ComponentProps<typeof Link>;

/** next/link that asks before leaving a page with unsaved changes. */
export function SafeLink({ onNavigate, ...props }: SafeLinkProps) {
  const router = useRouter();
  const { isBlocked, setIsBlocked, confirmLeave } = useNavigationBlocker();
  return (
    <Link
      {...props}
      onNavigate={(e) => {
        if (isBlocked) {
          e.preventDefault();
          const href = typeof props.href === "string" ? props.href : props.href.pathname ?? "/";
          void confirmLeave().then((ok) => {
            if (!ok) return;
            setIsBlocked(false);
            router.push(href);
          });
          return;
        }
        onNavigate?.(e);
      }}
    />
  );
}
