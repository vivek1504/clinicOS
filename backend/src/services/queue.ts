import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * A WAITING (or returning NO_SHOW) appointment may start only when nobody is in the room and everyone booked earlier that day
 * is COMPLETED. Prefers reporting the in-room blocker over the queue blocker. Read-then-write: the partial
 * unique index on IN_CONSULTATION is what makes two simultaneous starts safe; this is the friendly check.
 */
export async function assertCanStart(db: Db, appt: { id: string; doctorId: string; scheduledAt: Date }): Promise<void> {
  const dayStart = new Date(appt.scheduledAt);
  dayStart.setHours(0, 0, 0, 0);
  const blocker = await db.appointment.findFirst({
    where: {
      doctorId: appt.doctorId,
      id: { not: appt.id },
      status: { in: ["WAITING", "IN_CONSULTATION"] }, // COMPLETED and NO_SHOW are out of the way
      OR: [{ status: "IN_CONSULTATION" }, { scheduledAt: { gte: dayStart, lt: appt.scheduledAt } }],
    },
    // Enum order is WAITING, IN_CONSULTATION, COMPLETED, so desc puts the room holder first.
    orderBy: [{ status: "desc" }, { scheduledAt: "asc" }],
    include: { patient: { select: { id: true, name: true } } },
  });
  if (!blocker) return;
  const details = { appointmentId: blocker.id, patientId: blocker.patientId, patientName: blocker.patient.name };
  if (blocker.status === "IN_CONSULTATION") {
    throw new AppError("ALREADY_IN_CONSULTATION", `${blocker.patient.name} is already in consultation`, details);
  }
  throw new AppError("QUEUE_ORDER", `${blocker.patient.name} is ahead in the queue`, details);
}
