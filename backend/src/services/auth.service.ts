import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface DoctorDto {
  id: string;
  name: string;
  email: string;
}

export const hashPassword = (password: string) => Bun.password.hash(password);

export class AuthService {
  async signIn(email: string, password: string): Promise<{ doctor: DoctorDto; token: string; expiresAt: Date }> {
    const doctor = await prisma.doctor.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Same error for unknown email and wrong password: never confirm which accounts exist.
    if (!doctor?.passwordHash || !(await Bun.password.verify(password, doctor.passwordHash))) {
      throw new AppError("UNAUTHORIZED", "Incorrect email or password");
    }
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const session = await prisma.session.create({
      data: { id: crypto.randomUUID(), doctorId: doctor.id, expiresAt },
    });
    return { doctor: { id: doctor.id, name: doctor.name, email: doctor.email }, token: session.id, expiresAt };
  }

  async doctorForToken(token: string | undefined): Promise<DoctorDto | null> {
    if (!token) return null;
    const session = await prisma.session.findUnique({
      where: { id: token },
      include: { doctor: { select: { id: true, name: true, email: true } } },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: token } }).catch(() => {});
      return null;
    }
    return session.doctor;
  }

  async signOut(token: string | undefined): Promise<void> {
    if (!token) return;
    await prisma.session.deleteMany({ where: { id: token } });
  }
}
