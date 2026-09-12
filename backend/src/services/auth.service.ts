import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import type { Role } from "@prisma/client";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const MAX_SIGN_IN_FAILURES = 10;
const LOCK_MS = 15 * 60 * 1000;
// ponytail: per-process counter keyed by email; move it to the Session table or a shared store when there is more than one instance.
const failures = new Map<string, { count: number; lockedUntil: number }>();
/** Tests share one process; each starts with a clean slate. */
export const resetSignInThrottle = () => failures.clear();

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
    const key = email.trim().toLowerCase();
    const strikes = failures.get(key);
    if (strikes && strikes.lockedUntil > Date.now()) {
      throw new AppError("TOO_MANY_ATTEMPTS", "Too many failed sign-ins. Try again in a few minutes.");
    }
    const doctor = await prisma.user.findUnique({ where: { email: key } });
    // Same error for unknown email and wrong password: never confirm which accounts exist.
    if (!doctor?.passwordHash || !(await Bun.password.verify(password, doctor.passwordHash))) {
      const count = (strikes?.count ?? 0) + 1;
      failures.set(key, { count, lockedUntil: count >= MAX_SIGN_IN_FAILURES ? Date.now() + LOCK_MS : 0 });
      throw new AppError("UNAUTHORIZED", "Incorrect email or password");
    }
    failures.delete(key);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    // One device at a time: signing in replaces any other session, so the other device is signed out on its next
    // request. The unique index on userId makes two simultaneous sign-ins impossible to both survive.
    const [, session] = await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId: doctor.id } }),
      prisma.session.create({ data: { id: crypto.randomUUID(), userId: doctor.id, expiresAt } }),
    ]);
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
