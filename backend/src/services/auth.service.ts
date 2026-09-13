import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import type { Role } from "@prisma/client";
import { createHash } from "node:crypto";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const MAX_SIGN_IN_FAILURES = 10;
const LOCK_MS = 15 * 60 * 1000;
// ponytail: per-process counter keyed by ip+email; move it to the Session table or a shared store when there is more than one instance.
// The ip in the key stops a stranger who knows a staff email from locking that account out.
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

/** The browser holds the token; the table holds only its hash, so a database dump does not hand out live sessions. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export class AuthService {
  async signIn(email: string, password: string, ip = "?"): Promise<{ doctor: DoctorDto; token: string; expiresAt: Date }> {
    const normalized = email.trim().toLowerCase();
    const key = `${ip}|${normalized}`;
    let strikes = failures.get(key);
    if (strikes?.lockedUntil) {
      if (strikes.lockedUntil > Date.now()) {
        throw new AppError("TOO_MANY_ATTEMPTS", "Too many failed sign-ins. Try again in a few minutes.");
      }
      failures.delete(key); // the lock was served; a fresh set of attempts, not an instant re-lock
      strikes = undefined;
    }
    const doctor = await prisma.user.findUnique({ where: { email: normalized } });
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
    const token = crypto.randomUUID();
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId: doctor.id } }),
      prisma.session.create({ data: { id: hashToken(token), userId: doctor.id, expiresAt } }),
    ]);
    return { doctor: { id: doctor.id, name: doctor.name, email: doctor.email, role: doctor.role }, token, expiresAt };
  }

  async doctorForToken(token: string | undefined): Promise<DoctorDto | null> {
    if (!token) return null;
    const id = hashToken(token);
    const session = await prisma.session.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id } }).catch(() => {});
      return null;
    }
    return session.user;
  }

  async signOut(token: string | undefined): Promise<void> {
    if (!token) return;
    await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  }
}
