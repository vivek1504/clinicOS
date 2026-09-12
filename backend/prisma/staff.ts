import type { Prisma } from "@prisma/client";

/**
 * The two staff accounts (vivek@gmail.com and recp@gmail.com). Idempotent and safe on every deploy: the password
 * is set only when an account is first created, so a changed password survives redeploys. The seed resets it on purpose.
 */
export async function upsertStaff(tx: Prisma.TransactionClient, passwordHash: string, { resetPassword = false } = {}) {
  const password = resetPassword ? { passwordHash } : {};
  await tx.user.upsert({
    where: { id: "doc_default" },
    update: { name: "Dr. Vivek", email: "vivek@gmail.com", role: "DOCTOR", ...password },
    create: { id: "doc_default", name: "Dr. Vivek", email: "vivek@gmail.com", passwordHash, role: "DOCTOR" },
  });
  await tx.user.upsert({
    where: { id: "rec_default" },
    update: { name: "Priya Nair", email: "recp@gmail.com", role: "RECEPTIONIST", ...password },
    create: { id: "rec_default", name: "Priya Nair", email: "recp@gmail.com", passwordHash, role: "RECEPTIONIST" },
  });
}
