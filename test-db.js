import { PrismaClient } from '@prisma/client';

async function testDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Test settings query
    console.log('Testing settings query for shop: test-lab-101.myshopify.com');
    const settings = await prisma.settings.findUnique({
      where: { shop: 'test-lab-101.myshopify.com' }
    });
    
    console.log('Settings found:', settings ? 'Yes' : 'No');
    if (settings) {
      console.log('Settings ID:', settings.id);
      console.log('Button Color:', settings.buttonColor);
    } else {
      console.log('No settings found, creating default...');
      const newSettings = await prisma.settings.create({
        data: {
          shop: 'test-lab-101.myshopify.com',
          enableApp: true,
          enableStickyCart: true,
          enableFreeShipping: true,
          freeShippingThreshold: 100,
          buttonColor: '#000000',
          backgroundColor: '#ffffff',
          textColor: '#1A1A1A'
        }
      });
      console.log('Created settings with ID:', newSettings.id);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack.split('\n').slice(0, 5).join('\n')
    });
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();
