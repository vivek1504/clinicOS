import { t } from "elysia";

export const ErrorEnvelope = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
    details: t.Optional(t.Any()),
  }),
});

export const IdParams = t.Object({
  id: t.String(),
});
