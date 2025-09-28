-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_settings_shop ON Settings(shop);
CREATE INDEX IF NOT EXISTS idx_ml_recommendations_shop_created ON MLRecommendationHistory(shop, createdAt);
CREATE INDEX IF NOT EXISTS idx_product_bundles_shop_status ON ProductBundle(shop, status);
CREATE INDEX IF NOT EXISTS idx_ab_experiments_shop_status ON ab_experiments(shop, status);
CREATE INDEX IF NOT EXISTS idx_ab_events_variant_type ON ab_events(variant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_bundle_performance_bundle_date ON BundlePerformance(bundleId, date);
-- Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orders_shop_date ON Orders(shop, processedAt);
CREATE INDEX IF NOT EXISTS idx_ml_events_user_shop ON MLEvents(userId, shop);
