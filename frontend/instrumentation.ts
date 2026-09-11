/**
 * Runs once when the server starts. The clinic's clock, not the host's: "today" and every rendered time come from
 * the process timezone, and Vercel runs in UTC, so without this the dashboard shows yesterday after 5:30 pm IST.
 */
export function register() {
  // Hosts often set TZ=UTC themselves, so this must overwrite, not fill in.
  process.env.TZ = process.env.CLINIC_TZ || "Asia/Kolkata";
}
