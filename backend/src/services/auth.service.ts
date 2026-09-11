import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import type { Role } from "@prisma/client";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Any signed-in staff member. The name is historical: receptionists live in the same table. */
export interface DoctorDto {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const hashPassword = (password: string) => Bun.password.hash(password);

export class AuthService {
  async signIn(email: string, password: string): Promise<{ doctor: DoctorDto; token: string; expiresAt: Date }> {
    const doctor = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Same error for unknown email and wrong password: never confirm which accounts exist.
    if (!doctor?.passwordHash || !(await Bun.password.verify(password, doctor.passwordHash))) {
      throw new AppError("UNAUTHORIZED", "Incorrect email or password");
    }
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await prisma.session.create({
      data: { id: crypto.randomUUID(), userId: doctor.id, expiresAt },
    });
    return { doctor: { id: doctor.id, name: doctor.name, email: doctor.email, role: doctor.role }, token: session.id, expiresAt };
  }

  async doctorForToken(token: string | undefined): Promise<DoctorDto | null> {
    if (!token) return null;
    const session = await prisma.session.findUnique({
      where: { id: token },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: token } }).catch(() => {});
      return null;
    }
    return session.user;
  }

  async signOut(token: string | undefined): Promise<void> {
    if (!token) return;
    await prisma.session.deleteMany({ where: { id: token } });
  }
}
