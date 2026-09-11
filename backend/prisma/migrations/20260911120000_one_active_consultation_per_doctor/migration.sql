-- A doctor can have at most one appointment IN_CONSULTATION at a time.

-- Existing data may already break the rule (seeded demo data does). Keep the most recently scheduled
-- IN_CONSULTATION appointment per doctor in the room and send the rest back to WAITING.
UPDATE "Appointment" a SET "status" = 'WAITING'
WHERE a."status" = 'IN_CONSULTATION'
  AND a."id" <> (
    SELECT b."id" FROM "Appointment" b
    WHERE b."doctorId" = a."doctorId" AND b."status" = 'IN_CONSULTATION'
    ORDER BY b."scheduledAt" DESC, b."id"
    LIMIT 1
  );

-- Partial unique index: Prisma's schema language cannot express it, so it lives here only.
-- The service maps the resulting unique violation (P2002) to ALREADY_IN_CONSULTATION.
CREATE UNIQUE INDEX "Appointment_one_active_per_doctor"
  ON "Appointment" ("doctorId")
  WHERE "status" = 'IN_CONSULTATION';
