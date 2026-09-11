"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SafeLink } from "@/components/shared/safe-link";
import { createAppointment, getAppointments, rescheduleAppointment } from "@/lib/api/appointments";
import { formatTime } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import type { AppointmentDto, PatientDto } from "@/lib/api/types";
import { bookingSchema, fieldErrors, focusFirstError, type FieldErrors } from "@/lib/forms";

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const SLOT_MIN = 15;
// ponytail: fixed clinic hours; make these a setting when a clinic needs different ones.
const CLINIC_OPEN = 8;
const CLINIC_CLOSE = 20;
/** The next quarter hour at or after `d`. */
const nextSlot = (d: Date) => {
  const x = new Date(d);
  x.setSeconds(0, 0);
  x.setMinutes(Math.ceil(x.getMinutes() / SLOT_MIN) * SLOT_MIN);
  return x;
};
/** First bookable slot for a new appointment: the next quarter hour, pulled inside clinic hours. Empty once the day is over. */
const defaultSlot = (d: Date) => {
  const x = nextSlot(d);
  if (x.getHours() < CLINIC_OPEN) return `${pad(CLINIC_OPEN)}:00`;
  if (x.getHours() >= CLINIC_CLOSE) return "";
  return localTime(x);
};

const SELECT =
  "h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-accent-500 focus-visible:ring-3 focus-visible:ring-accent-500/15 aria-invalid:border-danger-700";

/** What the form holds while it is being filled in; the modal keeps it across steps so Back loses nothing. */
export interface BookingDraft {
  doctorId: string;
  walkIn: boolean;
  date: string;
  time: string;
  reason: string;
}

/** Creates a booking, or moves an existing one when `existing` is given. Validated with zod before anything is sent. */
export function BookingForm({
  patients,
  doctors,
  defaults,
  existing,
  embedded = false,
  onBack,
  onDone,
  initial,
  onDraftChange,
}: {
  patients: PatientDto[];
  doctors: { id: string; name: string }[];
  defaults: { patientId?: string; date: string; walkIn: boolean };
  existing: AppointmentDto | null;
  /** Inside a modal: no card chrome, a Back button the caller controls, and the caller decides what happens after. */
  embedded?: boolean;
  onBack?: () => void;
  onDone?: () => void;
  /** Values to start from and a callback with every change, so a parent can restore the form later. */
  initial?: Partial<BookingDraft>;
  onDraftChange?: (draft: BookingDraft) => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const now = new Date();
  const start = existing ? new Date(existing.scheduledAt) : null;
  const [patientId, setPatientId] = useState(existing?.patientId ?? defaults.patientId ?? patients[0]?.id ?? "");
  const [doctorId, setDoctorId] = useState(initial?.doctorId ?? existing?.doctorId ?? doctors[0]?.id ?? "");
  const [walkIn, setWalkIn] = useState(initial?.walkIn ?? (defaults.walkIn && !existing));
  const [date, setDate] = useState(initial?.date ?? (start ? localDate(start) : defaults.date));
  const [time, setTime] = useState(initial?.time ?? (start ? localTime(start) : defaultSlot(now)));
  const [reason, setReason] = useState(initial?.reason ?? existing?.reason ?? "");
  useEffect(() => {
    onDraftChange?.({ doctorId, walkIn, date, time, reason });
  }, [doctorId, walkIn, date, time, reason, onDraftChange]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayRows, setDayRows] = useState<AppointmentDto[]>([]);
  const isToday = date === localDate(now);

  // First quarter-hour slot that day the doctor has not got yet, from now if today, from 09:00 otherwise.
  // Who holds each quarter-hour slot that day; shown in the picker so the desk sees availability while choosing.
  const takenBy = new Map(dayRows.map((r) => [localTime(new Date(r.scheduledAt)), r.patient.name]));
  const taken = new Set(takenBy.keys());
  const earliestToday = localTime(nextSlot(now));
  // Every quarter hour in clinic hours, plus the current value if it falls outside them (an older booking being moved).
  const slots = (() => {
    const out: string[] = [];
    for (let h = CLINIC_OPEN; h < CLINIC_CLOSE; h++) for (const m of [0, 15, 30, 45]) out.push(`${pad(h)}:${pad(m)}`);
    if (start && !out.includes(localTime(start))) out.push(localTime(start));
    return out.sort();
  })();
  const slotUnavailable = (t: string) => taken.has(t) || (isToday && t < earliestToday);
  const nextFree = (() => {
    const cursor = isToday ? nextSlot(now) : new Date(`${date}T09:00:00`);
    for (let i = 0; i < 96; i++) {
      const t = localTime(cursor);
      if (!taken.has(t) && cursor.getHours() < 24) return t;
      cursor.setMinutes(cursor.getMinutes() + SLOT_MIN);
    }
    return null;
  })();

  const clear = (key: string) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  // What the chosen doctor already has that day, so clashes are seen before submit, not after.
  useEffect(() => {
    if (walkIn) return;
    let live = true;
    getAppointments(date)
      .then((rows) => {
        if (live) setDayRows(rows.filter((r) => r.doctorId === doctorId && r.status !== "CANCELLED" && r.id !== existing?.id));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [date, doctorId, walkIn, existing?.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { patientId, doctorId, walkIn, date, time, reason: existing && !reason.trim() ? existing.reason : reason };
    const invalid = fieldErrors(bookingSchema, data);
    if (invalid) {
      setErrors(invalid);
      focusFirstError(formRef.current, invalid);
      return;
    }
    setBusy(true);
    setError(null);
    // A walk-in keeps the exact moment so two in the same minute never clash; a booking is a clean slot.
    const when = walkIn ? new Date() : new Date(`${date}T${time}:00`);
    if (!walkIn) when.setSeconds(0, 0);
    try {
      if (existing) {
        await rescheduleAppointment(existing.id, { scheduledAt: when.toISOString(), reason: data.reason.trim() });
      } else {
        await createAppointment({ patientId, doctorId, scheduledAt: when.toISOString(), reason: data.reason.trim(), status: walkIn ? "WAITING" : "BOOKED" });
      }
      if (onDone) onDone();
      else {
        router.push(`/front-desk?date=${localDate(when)}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the appointment");
      setBusy(false);
    }
  };

  const describe = (key: string) => (errors[key] ? `${key}-error` : undefined);

  return (
    <form ref={formRef} noValidate onSubmit={submit} className={embedded ? "grid gap-5" : "panel grid gap-5 p-6"}>
      {existing || (patients.length === 1 && defaults.patientId) ? null : (
        <div className="grid gap-2">
          <Label htmlFor="patientId">Patient</Label>
          <select id="patientId" value={patientId} aria-invalid={!!errors.patientId || undefined} aria-describedby={describe("patientId")} onChange={(e) => { setPatientId(e.target.value); clear("patientId"); }} className={SELECT}>
            {patients.length === 0 ? <option value="">No patients registered yet</option> : null}
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.phone}
              </option>
            ))}
          </select>
          <FieldError id="patientId-error" message={errors.patientId} />
          {embedded ? null : (
            <p className="text-[12px] text-ink-3">
              Not on the list?{" "}
              <SafeLink href="/front-desk/patients/new" className="font-medium text-accent-700 underline-offset-2 hover:underline">
                Register a new patient
              </SafeLink>
            </p>
          )}
        </div>
      )}

      {existing || doctors.length === 1 ? null : (
        <div className="grid gap-2">
          <Label htmlFor="doctorId">Doctor</Label>
          <select id="doctorId" value={doctorId} aria-invalid={!!errors.doctorId || undefined} aria-describedby={describe("doctorId")} onChange={(e) => { setDoctorId(e.target.value); clear("doctorId"); }} className={SELECT}>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <FieldError id="doctorId-error" message={errors.doctorId} />
        </div>
      )}

      {existing ? null : (
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input type="checkbox" checked={walkIn} onChange={(e) => { setWalkIn(e.target.checked); clear("time"); }} className="size-4 accent-accent-700" />
          Walk-in: the patient is here now, put them straight in the queue
        </label>
      )}

      {walkIn ? null : (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} aria-invalid={!!errors.date || undefined} aria-describedby={describe("date")} onChange={(e) => { setDate(e.target.value); clear("date"); clear("time"); }} />
            <FieldError id="date-error" message={errors.date} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="time">Time</Label>
            {/* A list of slots, not a free-form time: the native picker ignores its step, and a taken or past slot cannot be chosen at all. */}
            <select
              id="time"
              value={slotUnavailable(time) ? "" : time}
              aria-invalid={!!errors.time || undefined}
              aria-describedby={describe("time")}
              onChange={(e) => { setTime(e.target.value); clear("time"); }}
              className={SELECT}
            >
              <option value="" disabled>
                Choose a slot
              </option>
              {slots.map((t) => (
                <option key={t} value={t} disabled={slotUnavailable(t)}>
                  {formatTime(`${date}T${t}:00`)}
                  {takenBy.has(t) ? ` · ${takenBy.get(t)}` : isToday && t < earliestToday ? " · passed" : ""}
                </option>
              ))}
            </select>
            <FieldError id="time-error" message={errors.time} />
          </div>
        </div>
      )}

      {walkIn ? null : (
        <div className="rounded-md bg-surface-2/60 px-3 py-2.5 text-[13px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Already booked that day</p>
            {nextFree ? (
              <button type="button" onClick={() => { setTime(nextFree); clear("time"); }} className="text-[12px] font-medium text-accent-700 underline-offset-2 hover:underline">
                Next free slot {formatTime(`${date}T${nextFree}:00`)}
              </button>
            ) : null}
          </div>
          {dayRows.length === 0 ? (
            <p className="mt-1 text-ink-3">Nothing yet.</p>
          ) : (
            <ul className="mt-1 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
              {dayRows.map((r) => (
                <li key={r.id} className="flex min-w-0 gap-2">
                  <span className="num w-18 shrink-0 text-ink-3">{formatTime(r.scheduledAt)}</span>
                  <span className="truncate text-ink">{r.patient.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="reason">Reason for visit</Label>
        <Input id="reason" maxLength={300} value={reason} placeholder="e.g. Follow-up on blood pressure" aria-invalid={!!errors.reason || undefined} aria-describedby={describe("reason")} onChange={(e) => { setReason(e.target.value); clear("reason"); }} />
        <FieldError id="reason-error" message={errors.reason} />
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-100 px-3 py-2 text-[13px] font-medium text-danger-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
        ) : (
          <Button type="button" variant="ghost" render={<SafeLink href={`/front-desk?date=${defaults.date}`} />}>
            Back
          </Button>
        )}
        <Button type="submit" loading={busy} disabled={busy}>
          {existing ? "Save new time" : walkIn ? "Add to queue" : "Book appointment"}
        </Button>
      </div>
    </form>
  );
}
