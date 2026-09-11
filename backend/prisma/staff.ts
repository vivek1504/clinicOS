import type { Prisma } from "@prisma/client";

/** Demo sign-ins (vivek@gmail.com and recp@gmail.com, password pass123). Idempotent: safe to run on every deploy, never touches patients or appointments. */
export async function upsertStaff(tx: Prisma.TransactionClient, passwordHash: string) {
  await tx.user.upsert({
    where: { id: "doc_default" },
    update: { name: "Dr. Vivek", email: "vivek@gmail.com", passwordHash, role: "DOCTOR" },
    create: { id: "doc_default", name: "Dr. Vivek", email: "vivek@gmail.com", passwordHash, role: "DOCTOR" },
  });
  // Front desk sign-in: recp@gmail.com / pass123
  await tx.user.upsert({
    where: { id: "rec_default" },
    update: { name: "Priya Nair", email: "recp@gmail.com", passwordHash, role: "RECEPTIONIST" },
    create: { id: "rec_default", name: "Priya Nair", email: "recp@gmail.com", passwordHash, role: "RECEPTIONIST" },
  });
}
