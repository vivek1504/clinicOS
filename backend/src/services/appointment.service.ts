import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { getDayRange } from "../lib/dates";
import { AppointmentStatus } from "../generated/prisma/enums";

export interface AppointmentDtoType {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  reason: string;
  status: AppointmentStatus;
  patient: {
    id: string;
    name: string;
  };
  consultation?: { id: string } | null;
}

export class AppointmentService {
  async listAppointments(dateStr?: string): Promise<AppointmentDtoType[]> {
    const { start, nextDayStart } = getDayRange(dateStr);

    const appointments = await prisma.appointment.findMany({
      where: {
        scheduledAt: {
          gte: start,
          lt: nextDayStart,
        },
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        patient: {
          select: { id: true, name: true },
        },
        consultation: {
          select: { id: true },
        },
      },
    });

    return appointments.map((a) => ({
      id: a.id,
      patientId: a.patientId,
      doctorId: a.doctorId,
      scheduledAt: a.scheduledAt.toISOString(),
      reason: a.reason,
      status: a.status as AppointmentStatus,
      patient: {
        id: a.patient.id,
        name: a.patient.name,
      },
      consultation: a.consultation ? { id: a.consultation.id } : null,
    }));
  }

  async patchStatus(id: string, newStatus: AppointmentStatus): Promise<AppointmentDtoType> {
    const existing = await prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true } },
        consultation: { select: { id: true } },
      },
    });

    if (!existing) {
      throw new AppError("NOT_FOUND", `Appointment not found: ${id}`);
    }

    if (existing.status === newStatus) {
      return {
        id: existing.id,
        patientId: existing.patientId,
        doctorId: existing.doctorId,
        scheduledAt: existing.scheduledAt.toISOString(),
        reason: existing.reason,
        status: existing.status as AppointmentStatus,
        patient: {
          id: existing.patient.id,
          name: existing.patient.name,
        },
        consultation: existing.consultation ? { id: existing.consultation.id } : null,
      };
    }

    // Legal transitions:
    // WAITING -> IN_CONSULTATION
    // IN_CONSULTATION -> COMPLETED
    // WAITING -> COMPLETED (skipped intermediate step)
    const isLegal =
      (existing.status === "WAITING" && newStatus === "IN_CONSULTATION") ||
      (existing.status === "IN_CONSULTATION" && newStatus === "COMPLETED") ||
      (existing.status === "WAITING" && newStatus === "COMPLETED");

    if (!isLegal) {
      throw new AppError(
        "CONFLICT",
        `Cannot transition appointment status from ${existing.status} to ${newStatus}`
      );
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: newStatus },
      include: {
        patient: { select: { id: true, name: true } },
        consultation: { select: { id: true } },
      },
    });

    return {
      id: updated.id,
      patientId: updated.patientId,
      doctorId: updated.doctorId,
      scheduledAt: updated.scheduledAt.toISOString(),
      reason: updated.reason,
      status: updated.status as AppointmentStatus,
      patient: {
        id: updated.patient.id,
        name: updated.patient.name,
      },
      consultation: updated.consultation ? { id: updated.consultation.id } : null,
    };
  }
}
