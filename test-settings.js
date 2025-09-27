// Quick test script to verify settings functionality
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function testSettings() {
  try {
    console.log('🧪 Testing settings functionality...');
    
    // Test shop name
    const shop = 'test-shop.myshopify.com';
    
    // First, try to get existing settings
    console.log('📖 Getting current settings...');
    let settings = await db.settings.findUnique({
      where: { shop }
    });
    
    if (!settings) {
      console.log('📝 No settings found, creating new...');
      settings = await db.settings.create({
        data: {
          shop,
          enableApp: true,
          enableRecommendationTitleCaps: false,  // Test the field we're interested in
        }
      });
      console.log('✅ Created settings:', {
        id: settings.id,
        shop: settings.shop,
        enableTitleCaps: settings.enableTitleCaps
      });
    } else {
      console.log('✅ Found existing settings:', {
        id: settings.id,
        shop: settings.shop,
        enableRecommendationTitleCaps: settings.enableRecommendationTitleCaps
      });
    }
    
    // Now try to update the enableRecommendationTitleCaps field
    console.log('🔄 Updating enableRecommendationTitleCaps to true...');
    const updatedSettings = await db.settings.update({
      where: { shop },
      data: {
        enableRecommendationTitleCaps: true
      }
    });
    
    console.log('✅ Updated settings:', {
      id: updatedSettings.id,
      shop: updatedSettings.shop,
      enableRecommendationTitleCaps: updatedSettings.enableRecommendationTitleCaps
    });    console.log('🎉 Settings test completed successfully!');
    
  } catch (error) {
    console.error('❌ Settings test failed:', error);
  } finally {
    await db.$disconnect();
  }
}

testSettings();
