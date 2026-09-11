-- One appointment per doctor per time slot. Separate migration: Postgres refuses to use an enum value
-- in the transaction that added it.
CREATE UNIQUE INDEX "Appointment_doctor_slot"
  ON "Appointment" ("doctorId", "scheduledAt")
  WHERE "status" <> 'CANCELLED';
