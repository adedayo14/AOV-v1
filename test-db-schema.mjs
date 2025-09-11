import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testDB() {
  try {
    // First, let's see the schema
    const result = await prisma.$queryRaw`PRAGMA table_info(Settings)`;
    console.log('Settings table structure:');
    result.forEach(column => {
      console.log(`- ${column.name}: ${column.type} (${column.notnull ? 'NOT NULL' : 'NULLABLE'})`);
    });
    
    // Check current settings
    const settings = await prisma.settings.findMany();
    console.log('\nCurrent settings:');
    settings.forEach(setting => {
      console.log(`Shop: ${setting.shop}, enableTitleCaps: ${setting.enableTitleCaps}`);
    });
    
  } catch (error) {
    console.error('Database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDB();
