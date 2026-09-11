-- Patients who did not turn up leave the queue without blocking anyone behind them.
ALTER TYPE "AppointmentStatus" ADD VALUE 'NO_SHOW';
