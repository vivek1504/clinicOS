-- Staff roles: the Doctor table now holds receptionists too.
CREATE TYPE "Role" AS ENUM ('DOCTOR', 'RECEPTIONIST');
ALTER TABLE "Doctor" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'DOCTOR';

-- BOOKED: on the schedule but not yet checked in. CANCELLED: off the schedule, slot released.
ALTER TYPE "AppointmentStatus" ADD VALUE 'BOOKED' BEFORE 'WAITING';
ALTER TYPE "AppointmentStatus" ADD VALUE 'CANCELLED';
