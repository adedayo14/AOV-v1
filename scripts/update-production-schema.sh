#!/bin/bash
# Force database schema update for production

echo "🔧 Pushing database schema to production..."

# Set production environment
export NODE_ENV=production

# Push schema changes
npx prisma db push --accept-data-loss

echo "✅ Database schema push completed"
