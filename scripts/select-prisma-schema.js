// Switch Prisma schema at build time based on environment
// If DATABASE_URL is present, use schema.production.prisma; otherwise keep default
import { copyFileSync, existsSync } from 'fs';
import { resolve } from 'path';

try {
  const hasDbUrl = !!process.env.DATABASE_URL;
  const prismaDir = resolve(process.cwd(), 'prisma');
  const devSchema = resolve(prismaDir, 'schema.prisma');
  const prodSchema = resolve(prismaDir, 'schema.production.prisma');

  if (hasDbUrl) {
    if (existsSync(prodSchema)) {
      copyFileSync(prodSchema, devSchema);
      console.log('[Prisma] Using production schema (schema.production.prisma -> schema.prisma)');
    } else {
      console.warn('[Prisma] Expected production schema not found at', prodSchema);
    }
  } else {
    console.log('[Prisma] Using development schema (SQLite)');
  }
} catch (e) {
  console.warn('[Prisma] Schema selection step failed (continuing):', e?.message || e);
}
