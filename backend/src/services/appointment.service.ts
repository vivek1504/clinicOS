import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { getDayRange } from "../lib/dates";
import { assertCanStart, assertOwnsAppointment } from "./queue";
import { AppointmentStatus, Prisma, type Role } from "@prisma/client";

export interface AppointmentDtoType {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  reason: string;
  status: AppointmentStatus;
  patient: { id: string; name: string };
  doctor: { id: string; name: string };
  consultation?: { id: string } | null;
}

const INCLUDE = {
  patient: { select: { id: true, name: true } },
  doctor: { select: { id: true, name: true } },
  consultation: { select: { id: true } },
} satisfies Prisma.AppointmentInclude;

type Row = Prisma.AppointmentGetPayload<{ include: typeof INCLUDE }>;

const toDto = (a: Row): AppointmentDtoType => ({
  id: a.id,
  patientId: a.patientId,
  doctorId: a.doctorId,
  scheduledAt: a.scheduledAt.toISOString(),
  reason: a.reason,
  status: a.status,
  patient: a.patient,
  doctor: a.doctor,
  consultation: a.consultation ? { id: a.consultation.id } : null,
});

const ANY: Role[] = ["DOCTOR", "RECEPTIONIST"];
const DOCTOR: Role[] = ["DOCTOR"];
const RECEPTION: Role[] = ["RECEPTIONIST"];

/** From -> to -> who may do it. Anything missing is never legal. Arrival (check-in, walk-in, returning no-show) is the front desk's call; a doctor only starts a WAITING patient. */
const TRANSITIONS: Record<AppointmentStatus, Partial<Record<AppointmentStatus, Role[]>>> = {
  BOOKED: { WAITING: RECEPTION, NO_SHOW: RECEPTION, CANCELLED: ANY },
  WAITING: { IN_CONSULTATION: DOCTOR, COMPLETED: DOCTOR, NO_SHOW: RECEPTION, CANCELLED: ANY },
  NO_SHOW: { WAITING: RECEPTION, CANCELLED: ANY },
  IN_CONSULTATION: { WAITING: DOCTOR, COMPLETED: DOCTOR },
  COMPLETED: {},
  CANCELLED: { BOOKED: ANY }, // undo a mistaken cancel; the slot must still be free
};

const isUniqueViolation = (err: unknown): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/** The update's `where` named the status we read; nothing matched, so someone else moved the appointment meanwhile. */
const isStaleStatus = (err: unknown): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
const stale = (id: string) => new AppError("CONFLICT", `Appointment ${id} was changed by someone else; reload and try again`);

const GRACE_MS = 5 * 60 * 1000; // a walk-in booked "now" must not trip the past-time check

export const SLOT_MINUTES = 15;

/** Scheduled bookings sit on the quarter hour, so one slot is one 15-minute step. Walk-ins are "now" and skip this. */
const assertOnSlot = (d: Date) => {
  if (d.getMinutes() % SLOT_MINUTES !== 0 || d.getSeconds() !== 0 || d.getMilliseconds() !== 0) {
    throw new AppError("VALIDATION", "Choose a time on the quarter hour (:00, :15, :30 or :45)");
  }
};

const OPEN: AppointmentStatus[] = ["BOOKED", "WAITING", "IN_CONSULTATION"];

/** One open appointment per patient per day. Completed, absent or cancelled ones do not count. */
async function assertNoOpenAppointment(patientId: string, on: Date, exceptId?: string) {
  const dayStart = new Date(on);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const open = await prisma.appointment.findFirst({
    where: { patientId, status: { in: OPEN }, scheduledAt: { gte: dayStart, lt: dayEnd }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    orderBy: { scheduledAt: "asc" },
    include: { patient: { select: { name: true } } },
  });
  if (open) {
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(open.scheduledAt);
    throw new AppError("CONFLICT", `${open.patient.name} already has an open appointment that day at ${time}`, { appointmentId: open.id });
  }
}

const parseWhen = (iso: string): Date => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new AppError("VALIDATION", "scheduledAt is not a valid date");
  if (d.getTime() < Date.now() - GRACE_MS) throw new AppError("VALIDATION", "That time has already passed");
  return d;
};

export class AppointmentService {
  async listAppointments(dateStr?: string, patientId?: string): Promise<AppointmentDtoType[]> {
    if (patientId) {
      const rows = await prisma.appointment.findMany({ where: { patientId }, orderBy: { scheduledAt: "desc" }, take: 50, include: INCLUDE });
      return rows.map(toDto);
    }
    const { start, nextDayStart } = getDayRange(dateStr);
    const rows = await prisma.appointment.findMany({
      where: { scheduledAt: { gte: start, lt: nextDayStart } },
      orderBy: { scheduledAt: "asc" },
      include: INCLUDE,
    });
    return rows.map(toDto);
  }

  async create(input: { patientId: string; doctorId: string; scheduledAt: string; reason: string; status?: "BOOKED" | "WAITING" }): Promise<AppointmentDtoType> {
    const [patient, doctor] = await Promise.all([
      prisma.patient.findUnique({ where: { id: input.patientId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: input.doctorId }, select: { id: true, role: true } }),
    ]);
    if (!patient) throw new AppError("NOT_FOUND", `Patient not found: ${input.patientId}`);
    if (!doctor || doctor.role !== "DOCTOR") throw new AppError("NOT_FOUND", `Doctor not found: ${input.doctorId}`);
    const when = parseWhen(input.scheduledAt);
    if (input.status !== "WAITING") assertOnSlot(when);
    await assertNoOpenAppointment(input.patientId, when);
    try {
      const row = await prisma.appointment.create({
        data: {
          patientId: input.patientId,
          doctorId: input.doctorId,
          scheduledAt: when,
          reason: input.reason.trim(),
          status: input.status ?? "BOOKED",
        },
        include: INCLUDE,
      });
      return toDto(row);
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError("CONFLICT", "That time is already booked for this doctor");
      throw err;
    }
  }

  async reschedule(id: string, input: { scheduledAt?: string; reason?: string }, actor: { id: string; role: Role }): Promise<AppointmentDtoType> {
    const existing = await prisma.appointment.findUnique({ where: { id }, select: { status: true, patientId: true, doctorId: true } });
    if (!existing) throw new AppError("NOT_FOUND", `Appointment not found: ${id}`);
    assertOwnsAppointment(actor, existing);
    if (existing.status === "IN_CONSULTATION" || existing.status === "COMPLETED") {
      throw new AppError("CONFLICT", `Cannot reschedule an appointment that is ${existing.status.toLowerCase().replace("_", " ")}`);
    }
    let when: Date | undefined;
    if (input.scheduledAt) {
      when = parseWhen(input.scheduledAt);
      assertOnSlot(when);
      await assertNoOpenAppointment(existing.patientId, when, id);
    }
    try {
      const row = await prisma.appointment.update({
        where: { id, status: existing.status },
        data: {
          ...(when ? { scheduledAt: when } : {}),
          ...(input.reason ? { reason: input.reason.trim() } : {}),
        },
        include: INCLUDE,
      });
      return toDto(row);
    } catch (err) {
      if (isStaleStatus(err)) throw stale(id);
      if (isUniqueViolation(err)) throw new AppError("CONFLICT", "That time is already booked for this doctor");
      throw err;
    }
  }

  async patchStatus(id: string, newStatus: AppointmentStatus, actor: { id: string; role: Role }): Promise<AppointmentDtoType> {
    const existing = await prisma.appointment.findUnique({ where: { id }, include: INCLUDE });
    if (!existing) throw new AppError("NOT_FOUND", `Appointment not found: ${id}`);
    assertOwnsAppointment(actor, existing);
    if (existing.status === newStatus) return toDto(existing);

    const allowed = TRANSITIONS[existing.status][newStatus];
    if (!allowed) throw new AppError("CONFLICT", `Cannot transition appointment status from ${existing.status} to ${newStatus}`);
    if (!allowed.includes(actor.role)) {
      const who = allowed.includes("DOCTOR") ? "a doctor" : "the front desk";
      throw new AppError("FORBIDDEN", `Only ${who} can move an appointment to ${newStatus.toLowerCase().replace("_", " ")}`);
    }

    if (newStatus === "IN_CONSULTATION") await assertCanStart(prisma, existing);

    try {
      const row = await prisma.appointment.update({ where: { id, status: existing.status }, data: { status: newStatus }, include: INCLUDE });
      return toDto(row);
    } catch (err) {
      if (isStaleStatus(err)) throw stale(id);
      if (!isUniqueViolation(err)) throw err;
      // Two partial unique indexes can fire here. Which one is implied by the target status.
      if (newStatus === "IN_CONSULTATION") {
        // "Appointment_one_active_per_doctor": someone took the room between the check and the write.
        const inRoom = await prisma.appointment.findFirst({
          where: { doctorId: existing.doctorId, status: "IN_CONSULTATION" },
          include: { patient: { select: { id: true, name: true } } },
        });
        throw new AppError("ALREADY_IN_CONSULTATION", `${inRoom?.patient.name ?? "Another patient"} is already in consultation`, {
          appointmentId: inRoom?.id,
          patientId: inRoom?.patientId,
          patientName: inRoom?.patient.name,
        });
      }
      // "Appointment_doctor_slot": un-cancelling into a slot that has since been rebooked.
      throw new AppError("CONFLICT", "That time is already booked for this doctor");
    }
  }
}
