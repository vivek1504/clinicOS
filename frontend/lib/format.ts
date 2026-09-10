const LOCALE = "en-GB";

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

/** "10 Sep 2026" */
export function formatDate(iso: string): string {
  return formatShortDate(new Date(iso));
}

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatGender(gender: string): string {
  switch (gender) {
    case "MALE":
      return "Male";
    case "FEMALE":
      return "Female";
    default:
      return "Other";
  }
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "10 Sep 2026" — unambiguous across locales. */
export function formatShortDate(date: Date): string {
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date); // "Sep", not en-GB's "Sept"
  return `${date.getDate()} ${month} ${date.getFullYear()}`;
}
