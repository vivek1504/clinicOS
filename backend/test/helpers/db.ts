import { prisma } from "../../src/lib/prisma";

export const TEST_PASSWORD = "correct horse";
export const TEST_SESSION = "test-session-token";
/** Request headers for a signed-in doctor. */
export const authed = { cookie: `session=${TEST_SESSION}` };

export async function resetTestDb() {
  // Truncate tables in reverse dependency order or CASCADE
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "Session", "Consultation", "Appointment", "Patient", "Doctor" CASCADE;
  `);

  const doctor = await prisma.doctor.create({
    data: {
      id: "doc_default",
      name: "Dr. Default MD",
      email: "doc@test.local",
      passwordHash: await Bun.password.hash(TEST_PASSWORD),
    },
  });
  await prisma.session.create({
    data: { id: TEST_SESSION, doctorId: doctor.id, expiresAt: new Date(Date.now() + 60_000) },
  });

  const patient = await prisma.patient.create({
    data: {
      id: "pat_test_1",
      name: "Test Patient",
      dob: new Date("1990-01-01"),
      gender: "FEMALE",
      phone: "+1-555-9999",
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
