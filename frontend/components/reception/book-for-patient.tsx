"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { CalendarAdd01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { PatientDto } from "@/lib/api/types";
import { BookingForm } from "./booking-form";

/** "Book appointment" on a patient's record: the booking modal with this patient fixed, no trip to the front desk. */
export function BookForPatient({ patient, doctors }: { patient: PatientDto; doctors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <HugeiconsIcon icon={CalendarAdd01Icon} />
        Book appointment
      </Button>
      <Modal open={open} title="Book appointment" description={`For ${patient.name}. Patients are seen in check-in order.`} onClose={close}>
        <BookingForm
          embedded
          patients={[patient]}
          doctors={doctors}
          defaults={{ patientId: patient.id, date: today, walkIn: false }}
          existing={null}
          onDone={() => {
            close();
            router.refresh();
          }}
        />
      </Modal>
    </>
  );
}
