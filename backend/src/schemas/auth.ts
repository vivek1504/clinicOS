import { t } from "elysia";
import { Role } from "@prisma/client";

export const SignInBody = t.Object({
  email: t.String({ format: "email", maxLength: 254 }),
  password: t.String({ minLength: 1, maxLength: 256 }),
});

export const DoctorDto = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
  role: t.Enum(Role),
});

export const MeResponse = t.Object({ doctor: DoctorDto });
