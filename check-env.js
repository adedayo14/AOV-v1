#!/usr/bin/env node
import 'dotenv/config';

const required = [
  'SHOPIFY_API_KEY',
  'SHOPIFY_API_SECRET',
  'SHOPIFY_APP_URL',
  'DATABASE_URL'
];

console.log('\n🔍 Environment Variables Check:\n');

let missing = [];
required.forEach(key => {
  const value = process.env[key];
  if (!value || value === '') {
    console.log(`❌ ${key}: MISSING`);
    missing.push(key);
  } else {
    const display = key.includes('SECRET') || key.includes('PASSWORD') 
      ? '***' + value.slice(-4)
      : value.length > 50 
        ? value.slice(0, 30) + '...'
        : value;
    console.log(`✅ ${key}: ${display}`);
  }
});

if (missing.length > 0) {
  console.log(`\n⚠️  Missing ${missing.length} required variable(s)`);
  console.log('\n📝 To fix:');
  console.log('   1. Go to https://partners.shopify.com/');
  console.log('   2. Navigate to your app → Configuration');
  console.log('   3. Copy the Client secret');
  console.log('   4. Update .env file with SHOPIFY_API_SECRET value\n');
  process.exit(1);
} else {
  console.log('\n✨ All required variables are set!\n');
}
