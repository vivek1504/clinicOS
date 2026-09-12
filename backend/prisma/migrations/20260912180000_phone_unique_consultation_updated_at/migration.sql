-- One patient per phone number, enforced here rather than by a read-then-write in the service.
CREATE UNIQUE INDEX "Patient_phone_key" ON "Patient"("phone");

-- When a consultation was last changed; only its own doctor can change it, so the writer is already known.
ALTER TABLE "Consultation" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
