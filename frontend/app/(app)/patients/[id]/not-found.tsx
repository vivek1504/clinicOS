import { ArrowLeftIcon, UserXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { SafeLink } from "@/components/shared/safe-link";

export default function PatientNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="panel w-full max-w-md">
        <EmptyState
          icon={<UserXIcon className="size-5" aria-hidden="true" />}
          title="Patient not found"
          body="No patient record matches this identifier. It may have been removed."
          action={
            <Button variant="secondary" render={<SafeLink href="/" />}>
              <ArrowLeftIcon />
              Back to today&apos;s appointments
            </Button>
          }
        />
      </div>
    </div>
  );
}
