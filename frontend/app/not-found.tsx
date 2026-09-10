import { ArrowLeftIcon, FileQuestionIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { SafeLink } from "@/components/shared/safe-link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-16">
      <div className="panel w-full">
        <EmptyState
          icon={<FileQuestionIcon className="size-5" aria-hidden="true" />}
          title="Page not found"
          body="This page does not exist or has moved."
          action={
            <Button variant="secondary" render={<SafeLink href="/" />}>
              <ArrowLeftIcon />
              Back to today&apos;s appointments
            </Button>
          }
        />
      </div>
    </main>
  );
}
