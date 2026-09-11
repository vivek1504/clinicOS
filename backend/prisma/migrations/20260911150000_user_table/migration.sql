-- The staff table is "User" now that it holds receptionists as well as doctors. Data is kept; only names change.
-- Appointment and Consultation keep "doctorId": that relation really is always a doctor.
ALTER TABLE "Doctor" RENAME TO "User";
ALTER TABLE "User" RENAME CONSTRAINT "Doctor_pkey" TO "User_pkey";
ALTER INDEX "Doctor_email_key" RENAME TO "User_email_key";

ALTER TABLE "Session" RENAME COLUMN "doctorId" TO "userId";
ALTER TABLE "Session" RENAME CONSTRAINT "Session_doctorId_fkey" TO "Session_userId_fkey";
ALTER INDEX "Session_doctorId_idx" RENAME TO "Session_userId_idx";
