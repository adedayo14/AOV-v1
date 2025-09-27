#!/bin/bash

# Production build script for Vercel deployment
# Handles schema switching and database operations separately from the main build

echo "Starting production build process..."

# Check if we're in production environment
if [ -n "$DATABASE_DATABASE_URL" ]; then
  echo "Production environment detected - switching to production schema"
  
  # Copy production schema
  cp prisma/schema.production.prisma prisma/schema.prisma
  
  # Generate Prisma client with production schema
  npx prisma generate
  
  # Push schema to production database (only if needed)
  # Note: We don't run this during build to avoid deployment failures
  # This should be run manually after deployment
  # npx prisma db push
  
  echo "Production schema configured"
else
  echo "Development environment - using default schema"
  npx prisma generate
fi

# Build the application
echo "Building application..."
npm run remix:build

echo "Production build completed successfully!"