import { Elysia, t } from "elysia";
import { prisma } from "../lib/prisma";

/** Who can be booked. Used by the front desk's booking form. */
export const staffRoutes = new Elysia().get(
  "/doctors",
  async () => prisma.user.findMany({ where: { role: "DOCTOR" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  { response: { 200: t.Array(t.Object({ id: t.String(), name: t.String() })) } }
);
