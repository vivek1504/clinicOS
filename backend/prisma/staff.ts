import type { Prisma } from "@prisma/client";

/** Demo sign-ins. Idempotent: safe to run on every deploy, never touches patients or appointments. */
export async function upsertStaff(tx: Prisma.TransactionClient, passwordHash: string) {
  await tx.user.upsert({
    where: { id: "doc_default" },
    update: { name: "Dr. Mehta", email: "mehta@clinicos.local", passwordHash, role: "DOCTOR" },
    create: { id: "doc_default", name: "Dr. Mehta", email: "mehta@clinicos.local", passwordHash, role: "DOCTOR" },
  });
  // Front desk sign-in: reception@clinicos.local / clinicos
  await tx.user.upsert({
    where: { id: "rec_default" },
    update: { name: "Priya Nair", email: "reception@clinicos.local", passwordHash, role: "RECEPTIONIST" },
    create: { id: "rec_default", name: "Priya Nair", email: "reception@clinicos.local", passwordHash, role: "RECEPTIONIST" },
  });
}
