// Runs on every production deploy after migrations: makes sure both staff accounts exist. An existing account's
// password is left alone. First creation uses STAFF_PASSWORD, or the documented demo password when unset.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { upsertStaff } from "./staff";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be defined");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const passwordHash = await Bun.password.hash(process.env.STAFF_PASSWORD || "pass123");
await prisma.$transaction((tx) => upsertStaff(tx, passwordHash));
console.log("Staff accounts ensured.");
await prisma.$disconnect();
