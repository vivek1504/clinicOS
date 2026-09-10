export function getDayRange(dateStr?: string): { start: Date; nextDayStart: Date } {
  let d: Date;
  if (dateStr) {
    const parts = dateStr.split("-").map(Number);
    const y = parts[0] ?? new Date().getFullYear();
    const m = (parts[1] ?? 1) - 1;
    const day = parts[2] ?? 1;
    d = new Date(y, m, day);
  } else {
    d = new Date();
  }
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const nextDayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return { start, nextDayStart };
}

export function getAge(dob: Date | string): number {
  const birth = typeof dob === "string" ? new Date(dob) : dob;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}
