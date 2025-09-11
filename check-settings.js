import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkSettings() {
  try {
    const settings = await prisma.settings.findMany();
    console.log('📊 Current settings in database:');
    settings.forEach(setting => {
      console.log('Shop:', setting.shop);
      console.log('enableTitleCaps:', setting.enableTitleCaps);
      console.log('Has enableTitleCaps field:', 'enableTitleCaps' in setting);
      console.log('All Keys:', Object.keys(setting));
      console.log('---');
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSettings();
