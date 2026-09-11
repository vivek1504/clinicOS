import { prisma } from "../../src/lib/prisma";

export const TEST_PASSWORD = "correct horse";
export const TEST_SESSION = "test-session-token";
export const TEST_RECEPTION_SESSION = "test-reception-session-token";
/** Request headers for a signed-in doctor. */
export const authed = { cookie: `session=${TEST_SESSION}` };
/** Request headers for a signed-in receptionist. */
export const authedReception = { cookie: `session=${TEST_RECEPTION_SESSION}` };

export async function resetTestDb() {
  // Truncate tables in reverse dependency order or CASCADE
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "Session", "Consultation", "Appointment", "Patient", "User" CASCADE;
  `);

  const doctor = await prisma.user.create({
    data: {
      id: "doc_default",
      name: "Dr. Default MD",
      email: "doc@test.local",
      passwordHash: await Bun.password.hash(TEST_PASSWORD),
    },
  });
  await prisma.session.create({
    data: { id: TEST_SESSION, userId: doctor.id, expiresAt: new Date(Date.now() + 60_000) },
  });
  const receptionist = await prisma.user.create({
    data: { id: "rec_default", name: "Front Desk", email: "desk@test.local", role: "RECEPTIONIST", passwordHash: doctor.passwordHash },
  });
  await prisma.session.create({
    data: { id: TEST_RECEPTION_SESSION, userId: receptionist.id, expiresAt: new Date(Date.now() + 60_000) },
  });

  const patient = await prisma.patient.create({
    data: {
      id: "pat_test_1",
      name: "Test Patient",
      dob: new Date("1990-01-01"),
      gender: "FEMALE",
      phone: "9876599999",
      allergies: ["Peanuts"],
      conditions: ["Asthma"],
    },
  });

  const appointment = await prisma.appointment.create({
    data: {
      id: "appt_test_1",
      patientId: patient.id,
      doctorId: doctor.id,
      scheduledAt: new Date(),
      reason: "Routine checkup",
      status: "WAITING",
    },
  });

  return { doctor, patient, appointment };
}
