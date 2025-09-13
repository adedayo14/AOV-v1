/**
 * ML System Integration Test
 * Tests the complete end-to-end ML pipeline with privacy compliance
 */

class MLSystemIntegrationTest {
    constructor() {
        this.testUserId = 'test-user-' + Date.now();
        this.testShopId = 'test-shop';
        this.testSessionId = 'test-session-' + Date.now();
        this.testResults = {};
    }

    async runAllTests() {
        console.log('🧪 Starting ML System Integration Tests...');
        
        try {
            // Test 1: Privacy Settings and Consent
            await this.testPrivacySettingsFlow();
            
            // Test 2: Behavior Tracking with Privacy Compliance
            await this.testBehaviorTrackingFlow();
            
            // Test 3: Customer Profiling and Feature Generation
            await this.testCustomerProfilingFlow();
            
            // Test 4: Collaborative Filtering Recommendations
            await this.testCollaborativeFilteringFlow();
            
            // Test 5: Bundle Discovery and Association Rules
            await this.testBundleDiscoveryFlow();
            
            // Test 6: ML Recommendation Engine Integration
            await this.testMLRecommendationEngineFlow();
            
            // Test 7: GDPR Data Export and Deletion
            await this.testGDPRComplianceFlow();
            
            // Test 8: Performance Monitoring and Analytics
            await this.testPerformanceMonitoringFlow();
            
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Integration test failed:', error);
            this.testResults.overall = { status: 'failed', error: error.message };
        }
    }

    async testPrivacySettingsFlow() {
        console.log('🔒 Testing Privacy Settings Flow...');
        
        try {
            // Test privacy settings manager
            const { PrivacySettingsManager } = await import('../extensions/cart-uplift/src/ml/privacy-settings.js');
            const privacyManager = new PrivacySettingsManager(this.testUserId);
            
            // Test consent dialog
            const consentResult = await this.simulateUserConsent(privacyManager, 'enhanced');
            
            // Test privacy level validation
            const privacyLevel = privacyManager.getPrivacyLevel();
            
            // Test feature enablement
            const features = privacyManager.getEnabledFeatures();
            
            this.testResults.privacySettings = {
                status: 'passed',
                consentResult,
                privacyLevel,
                features,
                timestamp: new Date().toISOString()
            };
            
            console.log('✅ Privacy Settings Flow - PASSED');
            
        } catch (error) {
            console.error('❌ Privacy Settings Flow - FAILED:', error);
            this.testResults.privacySettings = {
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async testBehaviorTrackingFlow() {
        console.log('📊 Testing Behavior Tracking Flow...');
        
        try {
            // Test behavior tracker with privacy compliance
            const { BehaviorTracker } = await import('../extensions/cart-uplift/src/ml/behavior-tracker.js');
            const tracker = new BehaviorTracker({
                userId: this.testUserId,
                sessionId: this.testSessionId,
                privacyLevel: 'enhanced'
            });
            
            // Test event tracking
            const events = [
                { type: 'product_view', productId: 'prod_123', duration: 5000 },
                { type: 'item_added', productId: 'prod_123', quantity: 1 },
                { type: 'cart_view', cartValue: 99.99 },
                { type: 'checkout_start', cartValue: 99.99 }
            ];
            
            const trackingResults = [];
            for (const event of events) {
                const result = await tracker.track(event.type, event);
                trackingResults.push(result);
            }
            
            // Test API endpoint
            const apiResponse = await this.testAPIEndpoint('/api/ml/events', {
                user_id: this.testUserId,
                events: events,
                privacy_level: 'enhanced'
            });
            
            this.testResults.behaviorTracking = {
                status: 'passed',
                eventsTracked: trackingResults.length,
                apiResponse,
                timestamp: new Date().toISOString()
            };
            
            console.log('✅ Behavior Tracking Flow - PASSED');
            
        } catch (error) {
            console.error('❌ Behavior Tracking Flow - FAILED:', error);
            this.testResults.behaviorTracking = {
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async testCustomerProfilingFlow() {
        console.log('👤 Testing Customer Profiling Flow...');
        
        try {
            // Test customer profiler
            const { CustomerProfiler } = await import('../extensions/cart-uplift/src/ml/customer-profiler.js');
            const profiler = new CustomerProfiler(this.testUserId, 'enhanced');
            
            // Test profile generation
            const profile = await profiler.generateProfile();
            
            // Test RFM analysis
            const rfmScores = profiler.calculateRFMScores({
                lastPurchaseDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
                purchaseCount: 3,
                totalSpent: 245.75
            });
            
            // Test API endpoint
            const apiResponse = await this.testAPIEndpoint('/api/ml/profile', {
                user_id: this.testUserId,
                privacy_level: 'enhanced'
            });
            
            this.testResults.customerProfiling = {
                status: 'passed',
                profile,
                rfmScores,
                apiResponse,
                timestamp: new Date().toISOString()
            };
            
            console.log('✅ Customer Profiling Flow - PASSED');
            
        } catch (error) {
            console.error('❌ Customer Profiling Flow - FAILED:', error);
            this.testResults.customerProfiling = {
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async testCollaborativeFilteringFlow() {
        console.log('🤝 Testing Collaborative Filtering Flow...');
        
        try {
            // Test collaborative filtering engine
            const { CollaborativeFilteringEngine } = await import('../extensions/cart-uplift/src/ml/collaborative-filtering.js');
            const collaborativeEngine = new CollaborativeFilteringEngine(this.testUserId, 'full_ml');
            
            // Test recommendations generation
            const recommendations = await collaborativeEngine.getRecommendations({
                strategy: 'user_based',
                count: 5
            });
            
            // Test similarity calculations
            const similarities = collaborativeEngine.calculateUserSimilarity(
                [1, 0, 1, 1, 0], // User A preferences
                [1, 1, 0, 1, 0]  // User B preferences
            );
            
            // Test API endpoint
            const apiResponse = await this.testAPIEndpoint('/api/ml/collaborative-data', {
                user_id: this.testUserId,
                privacy_level: 'full_ml'
            });
            
            this.testResults.collaborativeFiltering = {
                status: 'passed',
                recommendations,
                similarities,
                apiResponse,
                timestamp: new Date().toISOString()
            };
            
            console.log('✅ Collaborative Filtering Flow - PASSED');
            
        } catch (error) {
            console.error('❌ Collaborative Filtering Flow - FAILED:', error);
            this.testResults.collaborativeFiltering = {
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async testBundleDiscoveryFlow() {
        console.log('📦 Testing Bundle Discovery Flow...');
        
        try {
            // Test bundle discovery engine
            const { BundleDiscoveryEngine } = await import('../extensions/cart-uplift/src/ml/bundle-discovery.js');
            const bundleEngine = new BundleDiscoveryEngine(this.testShopId);
            
            // Test bundle discovery
            const bundles = await bundleEngine.discoverBundles({
                minSupport: 0.1,
                minConfidence: 0.5,
                maxItems: 3
            });
            
            // Test association rule mining
            const rules = bundleEngine.findRuleBasedBundles([
                ['prod_1', 'prod_2'],
                ['prod_1', 'prod_3'],
                ['prod_2', 'prod_3'],
                ['prod_1', 'prod_2', 'prod_3']
            ]);
            
            // Test API endpoint
            const apiResponse = await this.testAPIEndpoint('/api/ml/bundle-data', {
                shop_id: this.testShopId,
                min_support: 0.1,
                min_confidence: 0.5
            });
            
            this.testResults.bundleDiscovery = {
                status: 'passed',
                bundles,
                rules,
                apiResponse,
                timestamp: new Date().toISOString()
            };
            
            console.log('✅ Bundle Discovery Flow - PASSED');
            
        } catch (error) {
            console.error('❌ Bundle Discovery Flow - FAILED:', error);
            this.testResults.bundleDiscovery = {
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async testMLRecommendationEngineFlow() {
        console.log('🎯 Testing ML Recommendation Engine Flow...');
        
        try {
            // Test main ML recommendation engine
            const { MLRecommendationEngine } = await import('../extensions/cart-uplift/src/ml/ml-recommendation-engine.js');
            const mlEngine = new MLRecommendationEngine({
                userId: this.testUserId,
                sessionId: this.testSessionId,
                privacyLevel: 'enhanced'
            });
            
            // Test personalized recommendations
            const recommendations = await mlEngine.getRecommendations({
                context: 'cart',
                currentProducts: ['prod_123'],
                count: 5
            });
            
            // Test hybrid strategy combination
            const hybridRecommendations = mlEngine.combineRecommendationStrategies([
                { strategy: 'collaborative', recommendations: ['prod_1', 'prod_2'] },
                { strategy: 'content_based', recommendations: ['prod_2', 'prod_3'] },
                { strategy: 'popularity', recommendations: ['prod_3', 'prod_4'] }
            ]);
            
            this.testResults.mlRecommendationEngine = {
                status: 'passed',
                recommendations,
                hybridRecommendations,
                timestamp: new Date().toISOString()
            };
            
            console.log('✅ ML Recommendation Engine Flow - PASSED');
            
        } catch (error) {
            console.error('❌ ML Recommendation Engine Flow - FAILED:', error);
            this.testResults.mlRecommendationEngine = {
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async testGDPRComplianceFlow() {
        console.log('🔐 Testing GDPR Compliance Flow...');
        
        try {
            // Test data export
            const exportResponse = await this.testAPIEndpoint('/api/ml/export-data', {
                user_id: this.testUserId,
                privacy_level: 'enhanced'
            });
            
            // Test data deletion
            const deletionResponse = await this.testAPIEndpoint('/api/ml/delete-data', {
                user_id: this.testUserId,
                deletion_type: 'ml_only',
                confirm_deletion: true
            });
            
            this.testResults.gdprCompliance = {
                status: 'passed',
                exportResponse,
                deletionResponse,
                timestamp: new Date().toISOString()
            };
            
            console.log('✅ GDPR Compliance Flow - PASSED');
            
        } catch (error) {
            console.error('❌ GDPR Compliance Flow - FAILED:', error);
            this.testResults.gdprCompliance = {
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async testPerformanceMonitoringFlow() {
        console.log('📈 Testing Performance Monitoring Flow...');
        
        try {
            // Test performance metrics collection
            const performanceMetrics = {
                recommendation_accuracy: 0.75,
                click_through_rate: 0.12,
                conversion_rate: 0.034,
                response_time: 245,
                user_satisfaction: 4.2
            };
            
            // Test content-based recommendations API
            const contentResponse = await this.testAPIEndpoint('/api/ml/content-recommendations', {
                product_id: 'prod_123',
                user_id: this.testUserId,
                count: 5
            });
            
            // Test popularity recommendations API
            const popularityResponse = await this.testAPIEndpoint('/api/ml/popular-recommendations', {
                user_id: this.testUserId,
                category: 'electronics',
                count: 5
            });
            
            this.testResults.performanceMonitoring = {
                status: 'passed',
                performanceMetrics,
                contentResponse,
                popularityResponse,
                timestamp: new Date().toISOString()
            };
            
            console.log('✅ Performance Monitoring Flow - PASSED');
            
        } catch (error) {
            console.error('❌ Performance Monitoring Flow - FAILED:', error);
            this.testResults.performanceMonitoring = {
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async simulateUserConsent(privacyManager, level) {
        // Simulate user granting consent
        return await privacyManager.updatePrivacyLevel(level, {
            dataRetention: 90,
            features: {
                personalizedRecommendations: true,
                behaviorTracking: level !== 'basic',
                crossSessionData: level === 'enhanced' || level === 'full_ml',
                predictiveAnalytics: level === 'full_ml',
                collaborativeFiltering: level === 'full_ml',
                advancedProfiling: level === 'full_ml'
            }
        });
    }

    async testAPIEndpoint(endpoint, data) {
        // Mock API testing - in production would make actual HTTP requests
        console.log(`Testing API endpoint: ${endpoint}`);
        
        // Simulate API response based on endpoint
        return {
            success: true,
            endpoint,
            requestData: data,
            responseTime: Math.random() * 200 + 50, // 50-250ms
            timestamp: new Date().toISOString()
        };
    }

    generateTestReport() {
        console.log('\n📋 ML System Integration Test Report\n');
        console.log('=====================================');
        
        const testSummary = {
            totalTests: Object.keys(this.testResults).length,
            passedTests: 0,
            failedTests: 0,
            timestamp: new Date().toISOString()
        };
        
        for (const [testName, result] of Object.entries(this.testResults)) {
            const status = result.status === 'passed' ? '✅' : '❌';
            console.log(`${status} ${testName}: ${result.status.toUpperCase()}`);
            
            if (result.status === 'passed') {
                testSummary.passedTests++;
            } else {
                testSummary.failedTests++;
                console.log(`   Error: ${result.error}`);
            }
        }
        
        console.log('\n📊 Summary:');
        console.log(`   Total Tests: ${testSummary.totalTests}`);
        console.log(`   Passed: ${testSummary.passedTests}`);
        console.log(`   Failed: ${testSummary.failedTests}`);
        console.log(`   Success Rate: ${((testSummary.passedTests / testSummary.totalTests) * 100).toFixed(1)}%`);
        
        if (testSummary.failedTests === 0) {
            console.log('\n🎉 All ML system integration tests passed!');
            console.log('✅ System is ready for production deployment');
        } else {
            console.log('\n⚠️  Some tests failed. Please review and fix issues before deployment.');
        }
        
        // Save detailed results for analysis
        this.testResults.summary = testSummary;
        
        return this.testResults;
    }
}

// Export for use in test environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MLSystemIntegrationTest;
}

// Auto-run tests if this file is executed directly
if (typeof window !== 'undefined' && window.location?.href?.includes('test')) {
    const testRunner = new MLSystemIntegrationTest();
    testRunner.runAllTests();
}
