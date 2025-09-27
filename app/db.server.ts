import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient;
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

// Note: avoid running migrations at runtime in serverless environments.
// Migrations should be handled during deploy (CI/CD) to prevent cold start failures.

export default prisma;
