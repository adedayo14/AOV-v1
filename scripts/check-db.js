import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('Checking A/B experiments...');
  
  try {
    const experiments = await prisma.$queryRaw`SELECT * FROM ab_experiments`;
    console.log('Experiments:', experiments);
    
    const variants = await prisma.$queryRaw`SELECT * FROM ab_variants`;
    console.log('Variants:', variants);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();