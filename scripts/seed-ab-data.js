import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedABTestData() {
  console.log('Seeding A/B test data...');
  
  try {
    // Create a sample experiment
    await prisma.$executeRaw`
      INSERT INTO ab_experiments (
        id, shop_id, name, description, test_type, status, 
        traffic_allocation, primary_metric, confidence_level, 
        start_date, end_date, created_at, updated_at
      ) VALUES (
        1, 'test-shop.myshopify.com', 'Bundle Discount Test', 
        'Testing different discount percentages for bundles',
        'bundle_pricing', 'running', 1.0, 'conversion_rate', 0.95,
        datetime('now', '-7 days'), NULL, datetime('now'), datetime('now')
      )
    `;

    // Create control variant
    await prisma.$executeRaw`
      INSERT INTO ab_variants (
        id, experiment_id, name, description, traffic_percentage, is_control,
        config_data, total_visitors, total_conversions, total_revenue, created_at, updated_at
      ) VALUES (
        1, 1, 'Control (10%)', 'Control variant with 10% discount', 33.33, 1,
        '{"discount_percentage": 10}', 245, 12, 1450.00, datetime('now'), datetime('now')
      )
    `;

    // Create variant 1
    await prisma.$executeRaw`
      INSERT INTO ab_variants (
        id, experiment_id, name, description, traffic_percentage, is_control,
        config_data, total_visitors, total_conversions, total_revenue, created_at, updated_at
      ) VALUES (
        2, 1, '15% Discount', '15% discount variant', 33.33, 0,
        '{"discount_percentage": 15}', 238, 18, 1620.00, datetime('now'), datetime('now')
      )
    `;

    // Create variant 2
    await prisma.$executeRaw`
      INSERT INTO ab_variants (
        id, experiment_id, name, description, traffic_percentage, is_control,
        config_data, total_visitors, total_conversions, total_revenue, created_at, updated_at
      ) VALUES (
        3, 1, '20% Discount', '20% discount variant', 33.33, 0,
        '{"discount_percentage": 20}', 251, 22, 1780.00, datetime('now'), datetime('now')
      )
    `;

    console.log('✅ A/B test data seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding A/B test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedABTestData();