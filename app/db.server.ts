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

// Best-effort: ensure migrations are applied in environments where setup wasn't run
async function ensureMigrationsApplied() {
  // Only attempt in production to avoid dev noise; guard to run once per process
  if (process.env.NODE_ENV === 'production' && !(global as any).__migrationsApplied) {
    (global as any).__migrationsApplied = true;
    try {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const pexec = promisify(exec);
      try {
        await pexec('npx prisma migrate deploy', { env: process.env as any });
        console.log('Prisma migrations deployed');
      } catch (e) {
        console.warn('Prisma migrate deploy failed, attempting db push:', e);
        await pexec('npx prisma db push', { env: process.env as any });
        console.log('Prisma db push completed');
      }
    } catch (e) {
      console.warn('Prisma setup failed (continuing):', e);
    }
  }
}

// Fire and forget; don't block module init
void ensureMigrationsApplied();

export default prisma;
