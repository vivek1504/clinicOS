"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SafeLink } from "@/components/shared/safe-link";
import { createAppointment, getAppointments, rescheduleAppointment } from "@/lib/api/appointments";
import { formatTime } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import type { AppointmentDto, PatientDto } from "@/lib/api/types";

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const SELECT =
  "h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-accent-500 focus-visible:ring-3 focus-visible:ring-accent-500/15";

/** Creates a booking, or moves an existing one when `existing` is given. Native date and time inputs; the browser does the picking. */
export function BookingForm({
  patients,
  doctors,
  defaults,
  existing,
}: {
  patients: PatientDto[];
  doctors: { id: string; name: string }[];
  defaults: { patientId?: string; date: string; walkIn: boolean };
  existing: AppointmentDto | null;
}) {
  const router = useRouter();
  const now = new Date();
  const start = existing ? new Date(existing.scheduledAt) : null;
  const [patientId, setPatientId] = useState(existing?.patientId ?? defaults.patientId ?? patients[0]?.id ?? "");
  const [doctorId, setDoctorId] = useState(existing?.doctorId ?? doctors[0]?.id ?? "");
  const [walkIn, setWalkIn] = useState(defaults.walkIn && !existing);
  const [date, setDate] = useState(start ? localDate(start) : defaults.date);
  const [time, setTime] = useState(start ? localTime(start) : localTime(now));
  const [reason, setReason] = useState(existing?.reason ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayRows, setDayRows] = useState<AppointmentDto[]>([]);
  const isToday = date === localDate(now);

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
    setBusy(true);
    setError(null);
    const when = walkIn ? new Date() : new Date(`${date}T${time}:00`);
    when.setSeconds(0, 0);
    try {
      if (existing) {
        await rescheduleAppointment(existing.id, { scheduledAt: when.toISOString(), reason: reason.trim() || undefined });
      } else {
        await createAppointment({ patientId, doctorId, scheduledAt: when.toISOString(), reason: reason.trim(), status: walkIn ? "WAITING" : "BOOKED" });
      }
      router.push(`/front-desk?date=${localDate(when)}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the appointment");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="panel grid gap-5 p-6">
      {existing ? null : (
        <div className="grid gap-2">
          <Label htmlFor="patient">Patient</Label>
          <select id="patient" required value={patientId} onChange={(e) => setPatientId(e.target.value)} className={SELECT}>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.phone}
              </option>
            ))}
          </select>
          <p className="text-[12px] text-ink-3">
            Not on the list?{" "}
            <SafeLink href="/front-desk/patients/new" className="font-medium text-accent-700 underline-offset-2 hover:underline">
              Register a new patient
            </SafeLink>
          </p>
        </div>
      )}

      {existing || doctors.length === 1 ? null : (
        <div className="grid gap-2">
          <Label htmlFor="doctor">Doctor</Label>
          <select id="doctor" required value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={SELECT}>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {existing ? null : (
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input type="checkbox" checked={walkIn} onChange={(e) => setWalkIn(e.target.checked)} className="size-4 accent-accent-700" />
          Walk-in: the patient is here now, put them straight in the queue
        </label>
      )}

      {walkIn ? null : (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="time">Time</Label>
            <Input id="time" type="time" required step={300} min={isToday ? localTime(now) : undefined} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
      )}

      {walkIn ? null : (
        <div className="rounded-md bg-surface-2/60 px-3 py-2.5 text-[13px]">
          <p className="eyebrow">Already booked that day</p>
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
        <Input id="reason" required={!existing} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Follow-up on blood pressure" />
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-100 px-3 py-2 text-[13px] font-medium text-danger-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" render={<SafeLink href={`/front-desk?date=${defaults.date}`} />}>
          Back
        </Button>
        <Button type="submit" loading={busy} disabled={busy || !patientId || !doctorId}>
          {existing ? "Save new time" : walkIn ? "Add to queue" : "Book appointment"}
        </Button>
      </div>
    </form>
  );
}
