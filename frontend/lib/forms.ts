import { z } from "zod";

/** Field rules for the three forms. Messages are written for the person typing, and limits mirror the backend's. */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

export const signInSchema = z.object({
  email: z.string().trim().min(1, "Enter your work email").pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Enter your password"),
});

export const patientSchema = z.object({
  name: z.string().trim().min(2, "Enter the patient's full name").max(120, "Keep the name under 120 characters"),
  dob: z
    .string()
    .regex(DATE, "Enter a date of birth")
    .refine((d) => new Date(`${d}T00:00:00`) <= new Date(), "Date of birth can't be in the future"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], { message: "Choose a gender" }),
  phone: z.string().regex(/^\d{10}$/, "Enter a 10-digit mobile number"),
  allergies: z.array(z.string().trim().max(80, "Keep each allergy under 80 characters")),
  conditions: z.array(z.string().trim().max(80, "Keep each condition under 80 characters")),
});

export const bookingSchema = z
  .object({
    patientId: z.string().min(1, "Choose a patient"),
    doctorId: z.string().min(1, "Choose a doctor"),
    walkIn: z.boolean(),
    date: z.string().regex(DATE, "Choose a date"),
    time: z.string().regex(TIME, "Choose a time"),
    reason: z.string().trim().min(1, "Say why the patient is coming in").max(300, "Keep the reason under 300 characters"),
  })
  .refine((v) => v.walkIn || new Date(`${v.date}T${v.time}:00`).getTime() >= Date.now() - 5 * 60 * 1000, {
    message: "That time has already passed",
    path: ["time"],
  })
  .refine((v) => v.walkIn || Number(v.time.slice(3, 5)) % 15 === 0, {
    message: "Times are in 15-minute steps (:00, :15, :30 or :45)",
    path: ["time"],
  });

export type FieldErrors = Partial<Record<string, string>>;

/** First message per field, or null when the data is valid. */
export function fieldErrors(schema: z.ZodType, data: unknown): FieldErrors | null {
  const result = schema.safeParse(data);
  if (result.success) return null;
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Moves focus to the first field that has an error, in the form's own order. */
export function focusFirstError(form: HTMLFormElement | null, errors: FieldErrors) {
  if (!form) return;
  for (const el of Array.from(form.querySelectorAll<HTMLElement>("input, select, textarea"))) {
    const key = el.id || el.getAttribute("name") || "";
    if (errors[key]) {
      el.focus();
      return;
    }
  }
}
