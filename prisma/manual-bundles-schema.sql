-- Manual Bundle Creation System for Cart Uplift
-- Enables merchants to create custom bundles and customers to build their own

-- Manual Bundles (Admin Created)
CREATE TABLE manual_bundles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value DECIMAL(10,2) NOT NULL,
    min_items INTEGER DEFAULT 2,
    max_items INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    bundle_type TEXT NOT NULL DEFAULT 'fixed' CHECK (bundle_type IN ('fixed', 'category_rule', 'customer_choice')),
    
    -- Category-based bundle rules
    category_ids TEXT, -- JSON array of category IDs
    collection_ids TEXT, -- JSON array of collection IDs
    product_tags TEXT, -- JSON array of product tags
    
    -- Display settings
    badge_text TEXT DEFAULT 'Bundle Deal',
    priority INTEGER DEFAULT 0,
    
    -- Performance tracking
    views_count INTEGER DEFAULT 0,
    clicks_count INTEGER DEFAULT 0,
    conversions_count INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0.00,
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Bundle Products (for Fixed Bundles)
CREATE TABLE manual_bundle_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bundle_id INTEGER NOT NULL,
    product_id TEXT NOT NULL,
    variant_id TEXT,
    quantity INTEGER DEFAULT 1,
    is_required BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (bundle_id) REFERENCES manual_bundles(id) ON DELETE CASCADE,
    UNIQUE(bundle_id, product_id)
);

-- Customer Bundle Builder Sessions
CREATE TABLE customer_bundle_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    bundle_rule_id INTEGER, -- Links to manual_bundles for category rules
    
    -- Customer selections
    selected_products TEXT NOT NULL DEFAULT '[]', -- JSON array of {product_id, variant_id, quantity}
    total_value DECIMAL(10,2) DEFAULT 0.00,
    discount_applied DECIMAL(10,2) DEFAULT 0.00,
    final_price DECIMAL(10,2) DEFAULT 0.00,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'building' CHECK (status IN ('building', 'completed', 'abandoned')),
    completed_at DATETIME,
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL DEFAULT (datetime('now', '+24 hours')),
    
    FOREIGN KEY (bundle_rule_id) REFERENCES manual_bundles(id)
);

-- Bundle Performance Analytics
CREATE TABLE bundle_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL,
    bundle_id INTEGER,
    bundle_type TEXT NOT NULL CHECK (bundle_type IN ('manual_fixed', 'manual_rule', 'customer_built', 'ml_generated')),
    
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'add_to_cart', 'purchase', 'abandon')),
    event_data TEXT DEFAULT '{}', -- JSON metadata
    
    -- Order context (if applicable)
    order_id TEXT,
    customer_id TEXT,
    session_id TEXT,
    
    -- Value tracking
    bundle_value DECIMAL(10,2),
    discount_amount DECIMAL(10,2),
    items_count INTEGER,
    
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (bundle_id) REFERENCES manual_bundles(id)
);

-- Indexes for Performance
CREATE INDEX idx_manual_bundles_shop_active ON manual_bundles(shop_id, is_active);
CREATE INDEX idx_manual_bundles_type ON manual_bundles(bundle_type);
CREATE INDEX idx_manual_bundle_products_bundle ON manual_bundle_products(bundle_id);
CREATE INDEX idx_customer_bundle_sessions_shop_session ON customer_bundle_sessions(shop_id, session_id);
CREATE INDEX idx_customer_bundle_sessions_status ON customer_bundle_sessions(status, expires_at);
CREATE INDEX idx_bundle_analytics_shop_type ON bundle_analytics(shop_id, bundle_type);
CREATE INDEX idx_bundle_analytics_timestamp ON bundle_analytics(timestamp);

-- Views for Common Queries
CREATE VIEW bundle_performance_summary AS
SELECT 
    b.id,
    b.shop_id,
    b.name,
    b.bundle_type,
    b.is_active,
    COUNT(ba.id) as total_events,
    SUM(CASE WHEN ba.event_type = 'view' THEN 1 ELSE 0 END) as views,
    SUM(CASE WHEN ba.event_type = 'add_to_cart' THEN 1 ELSE 0 END) as adds_to_cart,
    SUM(CASE WHEN ba.event_type = 'purchase' THEN 1 ELSE 0 END) as purchases,
    COALESCE(SUM(ba.bundle_value), 0) as total_revenue,
    COALESCE(AVG(ba.discount_amount), 0) as avg_discount,
    CASE 
        WHEN SUM(CASE WHEN ba.event_type = 'view' THEN 1 ELSE 0 END) > 0 
        THEN ROUND(
            (SUM(CASE WHEN ba.event_type = 'purchase' THEN 1 ELSE 0 END) * 100.0) / 
            SUM(CASE WHEN ba.event_type = 'view' THEN 1 ELSE 0 END), 2
        )
        ELSE 0 
    END as conversion_rate
FROM manual_bundles b
LEFT JOIN bundle_analytics ba ON b.id = ba.bundle_id
GROUP BY b.id, b.shop_id, b.name, b.bundle_type, b.is_active;

-- Customer Bundle Rules View
CREATE VIEW active_bundle_rules AS
SELECT 
    id,
    shop_id,
    name,
    description,
    discount_type,
    discount_value,
    min_items,
    max_items,
    category_ids,
    collection_ids,
    product_tags,
    badge_text
FROM manual_bundles 
WHERE is_active = TRUE 
AND bundle_type IN ('category_rule', 'customer_choice')
ORDER BY priority DESC, created_at DESC;

-- Cleanup trigger for expired sessions
CREATE TRIGGER cleanup_expired_bundle_sessions
AFTER INSERT ON customer_bundle_sessions
BEGIN
    DELETE FROM customer_bundle_sessions 
    WHERE expires_at < datetime('now')
    AND status = 'building';
END;