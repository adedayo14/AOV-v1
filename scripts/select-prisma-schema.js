// Production-only schema validation
// Ensures DATABASE_URL is configured for PostgreSQL production database
import { existsSync } from 'fs';
import { resolve } from 'path';

try {
  const hasDbUrl = !!process.env.DATABASE_URL;
  const schemaPath = resolve(process.cwd(), 'prisma', 'schema.prisma');

  if (!hasDbUrl) {
    console.error('[Prisma] ERROR: DATABASE_URL not configured. This app requires PostgreSQL.');
    process.exit(1);
  }

  if (!existsSync(schemaPath)) {
    console.error('[Prisma] ERROR: Schema file not found at', schemaPath);
    process.exit(1);
  }

  console.log('[Prisma] ✅ PostgreSQL schema validated');
} catch (e) {
  console.error('[Prisma] Schema validation failed:', e?.message || e);
  process.exit(1);
}
