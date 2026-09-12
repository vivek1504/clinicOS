"use client";

import { useEffect } from "react";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";

export function ErrorState({
  error,
  retry,
  title,
  fallback = "The clinical server did not respond. Check that the backend is running, then retry.",
}: {
  error: Error & { digest?: string };
  retry: () => void;
  title: string;
  fallback?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const network = error.message === "Could not reach the server" || !error.message;
  // Only the backend writes messages for people. Anything else (a render crash, a stale bundle after a deploy,
  // a serialised server error) is engineering text and stays out of the clinic's face.
  const fromBackend = error.name === "ApiError";
  const body = network
    ? fallback
    : fromBackend
      ? error.message
      : "Something went wrong while drawing this page. Retry usually fixes it. If it keeps happening, reload the page or tell your administrator.";
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="panel w-full max-w-md">
        <EmptyState
          icon={<AlertCircleIcon className="size-5 text-danger-700" aria-hidden="true" />}
          title={title}
          body={body}
          action={
            <Button variant="secondary" onClick={() => retry()}>
              <RefreshCwIcon />
              Retry
            </Button>
          }
        />
        {process.env.NODE_ENV !== "production" && !network && !fromBackend ? (
          <details className="border-t border-line px-6 py-3 text-[12px] text-ink-3">
            <summary className="cursor-pointer">Details (development only)</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px]">{error.message}</pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
