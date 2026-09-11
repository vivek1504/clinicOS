"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { PatientDto } from "@/lib/api/types";
import { PatientForm } from "./patient-form";

/** "Edit details" on the front desk's view of a patient, as a modal over the record. */
export function EditPatient({ patient }: { patient: PatientDto }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <Button size="lg" variant="secondary" onClick={() => setOpen(true)}>
        <PencilIcon />
        Edit details
      </Button>
      <Modal open={open} title="Edit details" description="Demographics, contact, allergies and known conditions." onClose={close}>
        <PatientForm
          embedded
          existing={patient}
          submitLabel="Save details"
          onBack={close}
          onDone={() => {
            close();
            router.refresh();
          }}
        />
      </Modal>
    </>
  );
}
