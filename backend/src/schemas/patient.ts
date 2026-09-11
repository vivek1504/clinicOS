import { t } from "elysia";
import { Gender } from "@prisma/client";

export { Gender };

export const PatientDto = t.Object({
  id: t.String(),
  name: t.String(),
  dob: t.String(),
  age: t.Integer(),
  gender: t.Enum(Gender),
  phone: t.String(),
  allergies: t.Array(t.String()),
  conditions: t.Array(t.String()),
});

export const GetPatientsQuery = t.Object({
  q: t.Optional(t.String()),
});

export const CreatePatientBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 120 }),
  dob: t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" }),
  gender: t.Enum(Gender),
  phone: t.String({ minLength: 3, maxLength: 40 }),
  allergies: t.Optional(t.Array(t.String({ maxLength: 80 }))),
  conditions: t.Optional(t.Array(t.String({ maxLength: 80 }))),
  /** Set after the front desk has seen the "already registered" warning and still wants a new record. */
  allowDuplicate: t.Optional(t.Boolean()),
});

export const UpdatePatientBody = t.Partial(t.Omit(CreatePatientBody, ["allowDuplicate"]));
