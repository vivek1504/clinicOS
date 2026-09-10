export const MIN_NOTES = 20;
export const MAX_NOTES = 5000;

export function notesValidationMessage(value: string): string | null {
  const len = value.trim().length;
  if (len === 0) return "Type your notes first";
  if (len < MIN_NOTES) return `Add at least ${MIN_NOTES} characters (${MIN_NOTES - len} more)`;
  if (value.length > MAX_NOTES) return `Maximum ${MAX_NOTES} characters (${value.length - MAX_NOTES} over)`;
  return null;
}
