// Runs on every deploy after migrations: makes sure both demo accounts exist. Nothing else is written.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { upsertStaff } from "./staff";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL must be defined");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const passwordHash = await Bun.password.hash("clinicos");
await prisma.$transaction((tx) => upsertStaff(tx, passwordHash));
console.log("Staff accounts ensured.");
await prisma.$disconnect();
