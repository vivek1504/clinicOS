"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function PatientError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorState error={error} retry={retry} title="Could not load this patient" />;
}
