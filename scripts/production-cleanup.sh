#!/bin/bash
# Production cleanup script

echo "🧹 Cleaning up for production deployment..."

# Remove any remaining development logs from client-side code
echo "Removing client-side debug logs..."

# Remove all console.log but keep console.warn and console.error for production error handling
find extensions/cart-uplift -name "*.js" -o -name "*.liquid" | xargs sed -i '' '/console\.log(/d'

# Clean up any debug comments
find extensions/cart-uplift -name "*.js" | xargs sed -i '' '/\/\/ DEBUG:/d'
find extensions/cart-uplift -name "*.js" | xargs sed -i '' '/\/\/ TODO:/d'

echo "✅ Production cleanup complete!"
echo "🚀 App is now optimized for production deployment"
