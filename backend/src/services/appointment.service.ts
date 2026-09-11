import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { getDayRange } from "../lib/dates";
import { assertCanStart } from "./queue";
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

/** From -> to -> who may do it. Anything missing is never legal. */
const TRANSITIONS: Record<AppointmentStatus, Partial<Record<AppointmentStatus, Role[]>>> = {
  BOOKED: { WAITING: ANY, IN_CONSULTATION: DOCTOR, NO_SHOW: RECEPTION, CANCELLED: ANY },
  WAITING: { IN_CONSULTATION: DOCTOR, COMPLETED: DOCTOR, NO_SHOW: RECEPTION, CANCELLED: ANY },
  NO_SHOW: { WAITING: ANY, IN_CONSULTATION: DOCTOR, CANCELLED: ANY },
  IN_CONSULTATION: { WAITING: DOCTOR, COMPLETED: DOCTOR },
  COMPLETED: {},
  CANCELLED: { BOOKED: ANY }, // undo a mistaken cancel; the slot must still be free
};

const isUniqueViolation = (err: unknown): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

const GRACE_MS = 5 * 60 * 1000; // a walk-in booked "now" must not trip the past-time check

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
    try {
      const row = await prisma.appointment.create({
        data: {
          patientId: input.patientId,
          doctorId: input.doctorId,
          scheduledAt: parseWhen(input.scheduledAt),
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

  async reschedule(id: string, input: { scheduledAt?: string; reason?: string }): Promise<AppointmentDtoType> {
    const existing = await prisma.appointment.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw new AppError("NOT_FOUND", `Appointment not found: ${id}`);
    if (existing.status === "IN_CONSULTATION" || existing.status === "COMPLETED") {
      throw new AppError("CONFLICT", `Cannot reschedule an appointment that is ${existing.status.toLowerCase().replace("_", " ")}`);
    }
    try {
      const row = await prisma.appointment.update({
        where: { id },
        data: {
          ...(input.scheduledAt ? { scheduledAt: parseWhen(input.scheduledAt) } : {}),
          ...(input.reason ? { reason: input.reason.trim() } : {}),
        },
        include: INCLUDE,
      });
      return toDto(row);
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError("CONFLICT", "That time is already booked for this doctor");
      throw err;
    }
  }

  async patchStatus(id: string, newStatus: AppointmentStatus, actor: { role: Role }): Promise<AppointmentDtoType> {
    const existing = await prisma.appointment.findUnique({ where: { id }, include: INCLUDE });
    if (!existing) throw new AppError("NOT_FOUND", `Appointment not found: ${id}`);
    if (existing.status === newStatus) return toDto(existing);

    const allowed = TRANSITIONS[existing.status][newStatus];
    if (!allowed) throw new AppError("CONFLICT", `Cannot transition appointment status from ${existing.status} to ${newStatus}`);
    if (!allowed.includes(actor.role)) {
      const who = allowed.includes("DOCTOR") ? "a doctor" : "the front desk";
      throw new AppError("FORBIDDEN", `Only ${who} can move an appointment to ${newStatus.toLowerCase().replace("_", " ")}`);
    }

    if (newStatus === "IN_CONSULTATION") await assertCanStart(prisma, existing);

    try {
      const row = await prisma.appointment.update({ where: { id }, data: { status: newStatus }, include: INCLUDE });
      return toDto(row);
    } catch (err) {
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
