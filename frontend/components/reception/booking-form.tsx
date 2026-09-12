"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, Calendar03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SafeLink } from "@/components/shared/safe-link";
import { createAppointment, getAppointments, rescheduleAppointment } from "@/lib/api/appointments";
import { formatShortDate, formatTime } from "@/lib/format";
import { ApiError } from "@/lib/api/client";
import type { AppointmentDto, PatientDto } from "@/lib/api/types";
import { bookingSchema, fieldErrors, focusFirstError, type FieldErrors } from "@/lib/forms";

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });
/** Weeks the date strip pages through; anything later goes via the calendar. */
const STRIP_WEEKS = 3;
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

/** Select triggers sized and coloured like Input, so the form reads as one set of fields. */
const TRIGGER = "w-full rounded-md border-line-strong bg-surface px-3 text-ink data-[size=default]:h-9 data-placeholder:text-ink-4";

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
  const [dateOpen, setDateOpen] = useState(false);
  const isToday = date === localDate(now);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const daysOut = date ? Math.floor((new Date(`${date}T12:00:00`).getTime() - today.getTime()) / 86_400_000) : -1;
  const clear = (key: string) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  // The strip shows one week at a time; `week` is the page (0 = today's), `dir` which way the last page turn slid.
  const [[week, dir], setWeek] = useState<[number, 1 | -1]>([daysOut >= 0 ? Math.min(Math.floor(daysOut / 7), STRIP_WEEKS - 1) : 0, 1]);
  const inStrip = daysOut >= week * 7 && daysOut < week * 7 + 7;
  const pickDate = (d: Date) => {
    setDate(localDate(d));
    clear("date");
    clear("time");
    const days = Math.floor((d.getTime() - today.getTime()) / 86_400_000);
    const page = Math.min(Math.floor(days / 7), STRIP_WEEKS - 1);
    if (page !== week) setWeek([page, page > week ? 1 : -1]);
  };
  // Arrow keys move the date itself: a day sideways, a week up or down, within the strip. They work anywhere on the
  // form or its modal, except while typing in a field or inside a dropdown or the calendar. Focus follows the tile.
  const stripRef = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  const stepDate = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step || walkIn) return;
    if ((e.target as Element | null)?.closest("input, textarea, [role=combobox], [role=listbox], [data-slot=popover-content], .rdp-root")) return;
    e.preventDefault();
    const d = new Date(`${date || localDate(today)}T12:00:00`);
    d.setDate(d.getDate() + step);
    if (d < today || Math.floor((d.getTime() - today.getTime()) / 86_400_000) >= STRIP_WEEKS * 7) return;
    refocus.current = true;
    pickDate(d);
  };
  const stepRef = useRef(stepDate);
  useEffect(() => {
    stepRef.current = stepDate;
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => stepRef.current(e);
    // Capture phase: the modal stops keydown from bubbling, so a bubbling listener never hears it.
    document.addEventListener("keydown", h, true);
    return () => document.removeEventListener("keydown", h, true);
  }, []);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    stripRef.current?.querySelector<HTMLButtonElement>("[aria-checked=true]")?.focus();
  }, [date]);

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
  const slotLabel = (t: string) => `${formatTime(`${date}T${t}:00`)}${takenBy.has(t) ? ` · ${takenBy.get(t)}` : isToday && t < earliestToday ? " · passed" : ""}`;
  const patientItems = patients.map((p) => ({ value: p.id, label: `${p.name} · ${p.phone}` }));
  const timeItems = slots.map((t) => ({ value: t, label: slotLabel(t) }));
  // First slot in clinic hours that is neither taken nor already behind us.
  const nextFree = slots.find((t) => !slotUnavailable(t)) ?? null;

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
          <Select
            items={patientItems}
            value={patientId}
            onValueChange={(v) => {
              setPatientId(v ?? "");
              clear("patientId");
            }}
          >
            <SelectTrigger id="patientId" aria-invalid={!!errors.patientId || undefined} aria-describedby={describe("patientId")} className={TRIGGER}>
              <SelectValue placeholder={patients.length === 0 ? "No patients registered yet" : "Choose a patient"} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {patientItems.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Select
            items={doctors.map((d) => ({ value: d.id, label: d.name }))}
            value={doctorId}
            onValueChange={(v) => {
              setDoctorId(v ?? "");
              clear("doctorId");
            }}
          >
            <SelectTrigger id="doctorId" aria-invalid={!!errors.doctorId || undefined} aria-describedby={describe("doctorId")} className={TRIGGER}>
              <SelectValue placeholder="Choose a doctor" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id="doctorId-error" message={errors.doctorId} />
        </div>
      )}

      {existing ? null : (
        <Label className="flex items-center gap-2.5 font-normal text-ink">
          <Checkbox
            checked={walkIn}
            onCheckedChange={(checked) => {
              setWalkIn(checked === true);
              clear("time");
            }}
          />
          Walk-in: the patient is here now, put them straight in the queue
        </Label>
      )}

      {walkIn ? null : (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label id="date-label">Date</Label>
            {/* Three weeks as a strip, a week per page; the calendar behind the last button reaches any later day. Days before today cannot be picked at all; the server refuses them too. */}
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous week" disabled={week === 0} onClick={() => setWeek([week - 1, -1])}>
                <HugeiconsIcon icon={ArrowLeft01Icon} />
              </Button>
              <div className="min-w-0 flex-1 overflow-hidden">
                {/* Re-keyed per page so the new week slides in from the side it came from. */}
                <div key={week} ref={stripRef} role="radiogroup" aria-labelledby="date-label" aria-describedby={describe("date")} className={`grid grid-cols-7 gap-1 animate-in duration-300 ease-out ${dir > 0 ? "slide-in-from-right-1/2" : "slide-in-from-left-1/2"} fade-in`}>
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(today);
                    d.setDate(d.getDate() + week * 7 + i);
                    const v = localDate(d);
                    const on = v === date;
                    return (
                      <button key={v} type="button" role="radio" aria-checked={on} tabIndex={on || (!inStrip && i === 0) ? 0 : -1} onClick={() => pickDate(d)} className={`flex flex-col items-center rounded-md py-1.5 text-[11px] font-medium uppercase transition-colors ${on ? "bg-accent-600 text-white" : "text-ink-3 hover:bg-surface-2 hover:text-ink"}`}>
                        <span>{WEEKDAY.format(d)}</span>
                        <span className={`text-lg leading-tight font-semibold ${on ? "" : "text-ink"}`}>{d.getDate()}</span>
                        <span>{MONTH.format(d)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Next week" disabled={week >= STRIP_WEEKS - 1} onClick={() => setWeek([week + 1, 1])}>
                <HugeiconsIcon icon={ArrowRight01Icon} />
              </Button>
              {week < STRIP_WEEKS - 1 && daysOut < STRIP_WEEKS * 7 ? null : (
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger aria-label="More dates" aria-invalid={!!errors.date || undefined} render={<Button type="button" variant="secondary" className={`h-auto shrink-0 flex-col gap-0 px-2 shadow-none ${inStrip ? "" : "border-accent-600 text-accent-700"}`} />}>
                    <HugeiconsIcon icon={Calendar03Icon} />
                    <span className="text-[11px]">{inStrip ? "More" : formatShortDate(new Date(`${date}T12:00:00`))}</span>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date ? new Date(`${date}T12:00:00`) : undefined}
                      defaultMonth={date ? new Date(`${date}T12:00:00`) : today}
                      disabled={{ before: today }}
                      onSelect={(d) => {
                        if (!d) return;
                        pickDate(d);
                        setDateOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <FieldError id="date-error" message={errors.date} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="time">Time</Label>
            {/* A list of slots, not a free-form time: a taken or past slot cannot be chosen at all. */}
            <Select
              items={timeItems}
              value={slotUnavailable(time) ? null : time}
              onValueChange={(v) => {
                setTime(v ?? "");
                clear("time");
              }}
            >
              <SelectTrigger id="time" aria-invalid={!!errors.time || undefined} aria-describedby={describe("time")} className={TRIGGER}>
                <SelectValue placeholder="Choose a slot" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {slots.map((t) => (
                  <SelectItem key={t} value={t} disabled={slotUnavailable(t)}>
                    {slotLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id="time-error" message={errors.time} />
          </div>
        </div>
      )}

      {walkIn ? null : (
        <div className="rounded-md bg-surface-2/60 px-3 py-2.5 text-[13px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Already booked that day</p>
            {nextFree ? (
              <button
                type="button"
                onClick={() => {
                  setTime(nextFree);
                  clear("time");
                }}
                className="text-[12px] font-medium text-accent-700 underline-offset-2 hover:underline"
              >
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
        <Input
          id="reason"
          maxLength={300}
          value={reason}
          placeholder="e.g. Follow-up on blood pressure"
          aria-invalid={!!errors.reason || undefined}
          aria-describedby={describe("reason")}
          onChange={(e) => {
            setReason(e.target.value);
            clear("reason");
          }}
        />
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
