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
  phone: t.String({ pattern: "^\\d{10}$" }), // Indian mobile numbers: ten digits, nothing else
  allergies: t.Optional(t.Array(t.String({ maxLength: 80 }))),
  conditions: t.Optional(t.Array(t.String({ maxLength: 80 }))),
});

export const UpdatePatientBody = t.Partial(CreatePatientBody);
