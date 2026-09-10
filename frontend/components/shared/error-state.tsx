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
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="panel w-full max-w-md">
        <EmptyState
          icon={<AlertCircleIcon className="size-5 text-danger-700" aria-hidden="true" />}
          title={title}
          body={network ? fallback : error.message}
          action={
            <Button variant="secondary" onClick={() => retry()}>
              <RefreshCwIcon />
              Retry
            </Button>
          }
        />
      </div>
    </div>
  );
}
