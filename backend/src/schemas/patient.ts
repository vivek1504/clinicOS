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
