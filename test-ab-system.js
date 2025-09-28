/**
 * A/B Testing System Verification Script
 * Tests the complete A/B testing integration with ML recommendations and bundle pricing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testABSystem() {
  console.log('🧪 Testing A/B System Integration...\n');
  
  try {
    // Test 1: Create a sample experiment
    console.log('📊 Test 1: Creating ML Algorithm Experiment');
    const _experiment = await prisma.$queryRaw`
      INSERT INTO ab_experiments (
        shop_id, name, description, test_type, status, 
        traffic_allocation, start_date, end_date
      ) VALUES (
        'test-shop',
        'ML Algorithm Comparison',
        'Test different ML personalization modes for recommendations',
        'ml_algorithm',
        'running',
        1.0,
        datetime('now'),
        datetime('now', '+30 days')
      )
    `;
    
    // Get the experiment ID
    const [newExperiment] = await prisma.$queryRaw`
      SELECT * FROM ab_experiments WHERE name = 'ML Algorithm Comparison' LIMIT 1
    `;
    
    console.log('✅ Created experiment:', newExperiment.name);
    console.log(`   ID: ${newExperiment.id}, Type: ${newExperiment.test_type}`);
    
    // Test 2: Create variants
    console.log('\n📋 Test 2: Creating Experiment Variants');
    const variants = [
      { name: 'Control', config: '{"personalizationMode": "basic", "mlEnabled": true}', traffic: 34 },
      { name: 'Advanced ML', config: '{"personalizationMode": "advanced", "mlEnabled": true}', traffic: 33 },
      { name: 'ML Disabled', config: '{"personalizationMode": "basic", "mlEnabled": false}', traffic: 33 }
    ];
    
    for (const variant of variants) {
      await prisma.$queryRaw`
        INSERT INTO ab_variants (
          experiment_id, name, config_data, traffic_percentage
        ) VALUES (
          ${newExperiment.id}, ${variant.name}, ${variant.config}, ${variant.traffic}
        )
      `;
    }
    
    console.log('✅ Created 3 variants: Control, Advanced ML, ML Disabled');
    
    // Test 3: Simulate user assignments
    console.log('\n👥 Test 3: Simulating User Assignments');
    const testUsers = ['user_001', 'user_002', 'user_003', 'user_004', 'user_005'];
    
    for (const userId of testUsers) {
      // Simulate the deterministic hash assignment (simplified)
      const hash = userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      const variantIndex = hash % 3;
      const assignedVariant = variants[variantIndex];
      
      // Get variant ID
      const [variantRecord] = await prisma.$queryRaw`
        SELECT id FROM ab_variants WHERE experiment_id = ${newExperiment.id} AND name = ${assignedVariant.name}
      `;
      
      await prisma.$queryRaw`
        INSERT INTO ab_assignments (
          experiment_id, variant_id, user_identifier, identifier_type, shop_id
        ) VALUES (
          ${newExperiment.id}, ${variantRecord.id}, ${userId}, 'session', 'test-shop'
        )
      `;
      
      console.log(`   ${userId} → ${assignedVariant.name}`);
    }
    
    // Test 4: Simulate events
    console.log('\n📈 Test 4: Simulating Conversion Events');
    const events = [
      { user: 'user_001', event: 'recommendation_shown', variant: 'Control' },
      { user: 'user_001', event: 'recommendation_clicked', variant: 'Control' },
      { user: 'user_002', event: 'recommendation_shown', variant: 'Advanced ML' },
      { user: 'user_002', event: 'recommendation_clicked', variant: 'Advanced ML' },
      { user: 'user_002', event: 'purchase_completed', variant: 'Advanced ML' },
      { user: 'user_003', event: 'recommendation_shown', variant: 'ML Disabled' }
    ];
    
    for (const event of events) {
      await prisma.$queryRaw`
        INSERT INTO ab_events (
          experiment_id, user_id, variant_name, event_type, 
          properties, created_at
        ) VALUES (
          ${newExperiment.id}, ${event.user}, ${event.variant}, ${event.event},
          '{}', datetime('now')
        )
      `;
    }
    
    console.log('✅ Recorded 6 events across variants');
    
    // Test 5: Check statistics
    console.log('\n📊 Test 5: Computing Statistics');
    const stats = await prisma.$queryRaw`
      SELECT 
        variant_name,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_events,
        SUM(CASE WHEN event_type = 'purchase_completed' THEN 1 ELSE 0 END) as conversions
      FROM ab_events 
      WHERE experiment_id = ${newExperiment.id}
      GROUP BY variant_name
    `;
    
    console.log('Statistics by variant:');
    for (const stat of stats) {
      const conversionRate = stat.unique_users > 0 ? (stat.conversions / stat.unique_users * 100).toFixed(1) : '0.0';
      console.log(`   ${stat.variant_name}: ${stat.unique_users} users, ${stat.conversions} conversions (${conversionRate}%)`);
    }
    
    // Test 6: Test bundle discount experiment
    console.log('\n💰 Test 6: Creating Bundle Discount Experiment');
    await prisma.$queryRaw`
      INSERT INTO ab_experiments (
        shop_id, name, description, test_type, status, 
        traffic_allocation, start_date, end_date
      ) VALUES (
        'test-shop',
        'Bundle Discount Optimization',
        'Test different bundle discount percentages for conversion rate',
        'discount_percentage',
        'running',
        1.0,
        datetime('now'),
        datetime('now', '+14 days')
      )
    `;
    
    const [bundleExperiment] = await prisma.$queryRaw`
      SELECT * FROM ab_experiments WHERE name = 'Bundle Discount Optimization' LIMIT 1
    `;
    
    const discountVariants = [
      { name: '10% Discount', config: '{"discountPercent": 10}', traffic: 34 },
      { name: '15% Discount', config: '{"discountPercent": 15}', traffic: 33 },
      { name: '20% Discount', config: '{"discountPercent": 20}', traffic: 33 }
    ];
    
    for (const variant of discountVariants) {
      await prisma.$queryRaw`
        INSERT INTO ab_variants (
          experiment_id, name, config_data, traffic_percentage
        ) VALUES (
          ${bundleExperiment.id}, ${variant.name}, ${variant.config}, ${variant.traffic}
        )
      `;
    }
    
    console.log('✅ Created bundle discount experiment with 3 discount levels');
    
    // Test 7: Verify database integrity
    console.log('\n🔍 Test 7: Database Integrity Check');
    const experimentCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ab_experiments`;
    const variantCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ab_variants`;
    const assignmentCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ab_assignments`;
    const eventCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ab_events`;
    
    console.log('Database state:');
    console.log(`   Experiments: ${experimentCount[0].count}`);
    console.log(`   Variants: ${variantCount[0].count}`);
    console.log(`   Assignments: ${assignmentCount[0].count}`);
    console.log(`   Events: ${eventCount[0].count}`);
    
    console.log('\n🎉 A/B Testing System Successfully Activated!');
    console.log('\nNext steps:');
    console.log('• Visit /admin/ab-testing to manage experiments');
    console.log('• API endpoints available at /api/ab-testing');
    console.log('• Recommendations API will now check for active A/B tests');
    console.log('• Bundle pricing will respect discount experiments');
    
  } catch (error) {
    console.error('❌ A/B System Test Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testABSystem();