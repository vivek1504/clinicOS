"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SPRING_QUICK } from "@/components/shared/reveal";
import { useRouter } from "next/navigation";
import { CalendarPlusIcon, UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { AppointmentDto, PatientDto } from "@/lib/api/types";
import { BookingForm, type BookingDraft } from "./booking-form";
import { PatientForm, type PatientDraft } from "./patient-form";

export interface DeskActionsInitial {
  register?: boolean;
  book?: boolean;
  walkIn?: boolean;
  patientId?: string;
  /** Open straight into moving this appointment. */
  reschedule?: AppointmentDto | null;
}

/**
 * The two front-desk actions as modals. They open from the header buttons or from the URL
 * (`?register=1`, `?book=1`, `?walkIn=1`, `&patientId=`), so other screens can deep-link into them.
 * Registering flows straight into booking with the new patient selected.
 */
export function DeskActions({
  patients,
  doctors,
  date,
  initial,
}: {
  patients: PatientDto[];
  doctors: { id: string; name: string }[];
  date: string;
  initial: DeskActionsInitial;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  // Initial state comes from the URL flags; the page keys this component on them, so a new URL remounts it.
  const [modal, setModal] = useState<"register" | "book" | "reschedule" | null>(
    initial.reschedule ? "reschedule" : initial.register ? "register" : initial.book || initial.walkIn ? "book" : null,
  );
  const [bookPatientId, setBookPatientId] = useState<string | undefined>(initial.patientId);
  const [walkIn, setWalkIn] = useState(Boolean(initial.walkIn));
  // Book reached from Register goes back to Register; Book opened directly goes back to the desk.
  const [fromRegister, setFromRegister] = useState(false);
  // A patient registered a moment ago is not in the server-rendered list yet.
  const [added, setAdded] = useState<PatientDto[]>([]);
  // Each step's values survive the swap, so Back and forth never loses typing.
  const [registerDraft, setRegisterDraft] = useState<Partial<PatientDraft>>({});
  // Once registered, going back edits that patient instead of trying to create them twice.
  const [registered, setRegistered] = useState<PatientDto | null>(null);
  const [bookingDraft, setBookingDraft] = useState<Partial<BookingDraft>>({});

  /** Closing also strips the URL flags and refetches the schedule, so a finished booking shows up at once. */
  const close = () => {
    setModal(null);
    setRegisterDraft({});
    setBookingDraft({});
    setRegistered(null);
    router.replace(`/front-desk?date=${date}`);
  };

  const allPatients = [...added, ...patients.filter((p) => !added.some((a) => a.id === p.id))].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" variant="secondary" onClick={() => setModal("register")}>
          <UserPlusIcon />
          Register patient
        </Button>
        <Button
          size="lg"
          onClick={() => {
            setBookPatientId(undefined);
            setWalkIn(false);
            setFromRegister(false);
            setModal("book");
          }}
        >
          <CalendarPlusIcon />
          Book appointment
        </Button>
      </div>

      {/* One dialog for both steps, so Register flowing into Book is a content swap, not a close and reopen. */}
      <Modal
        open={modal !== null}
        title={modal === "reschedule" ? "Reschedule" : modal === "register" ? "Register patient" : walkIn ? "Walk-in" : "Book appointment"}
        description={
          modal === "reschedule" && initial.reschedule
            ? `${initial.reschedule.patient.name} with ${initial.reschedule.doctor.name}.`
            : modal === "register"
              ? "Phone numbers are checked against existing patients so nobody gets two records."
              : "Times stay as booked; the doctor sees patients in check-in order."
        }
        onClose={close}
      >
        <AnimatePresence mode="wait" initial={false}>
          {modal === "register" ? (
            <motion.div key="register" initial={reduce ? false : { opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -16, transition: { duration: 0.14 } }} transition={SPRING_QUICK}>
              <PatientForm
                embedded
                existing={registered ?? undefined}
                initial={registerDraft}
                onDraftChange={setRegisterDraft}
                onDone={(created) => {
                  setRegistered(created);
                  setAdded((xs) => [created, ...xs.filter((x) => x.id !== created.id)]);
                  setBookPatientId(created.id);
                  setWalkIn(false);
                  setFromRegister(true);
                  setModal("book");
                }}
              />
            </motion.div>
          ) : modal === "book" ? (
            <motion.div key="book" initial={reduce ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: 16, transition: { duration: 0.14 } }} transition={SPRING_QUICK}>
              <BookingForm embedded patients={allPatients} doctors={doctors} defaults={{ patientId: bookPatientId, date, walkIn }} existing={null} initial={bookingDraft} onDraftChange={setBookingDraft} onBack={fromRegister ? () => setModal("register") : close} onDone={close} />
            </motion.div>
          ) : modal === "reschedule" && initial.reschedule ? (
            <motion.div key="reschedule" initial={reduce ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.14 } }} transition={SPRING_QUICK}>
              <BookingForm embedded patients={allPatients} doctors={doctors} defaults={{ date, walkIn: false }} existing={initial.reschedule} onBack={close} onDone={close} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Modal>
    </>
  );
}
