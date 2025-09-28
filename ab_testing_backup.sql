PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE ab_experiments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Test configuration
    test_type TEXT NOT NULL CHECK (test_type IN (
        'ml_algorithm', 'bundle_pricing', 'recommendation_copy', 
        'discount_percentage', 'layout_variant', 'personalization_level'
    )),
    
    -- Traffic allocation
    traffic_allocation DECIMAL(3,2) NOT NULL DEFAULT 1.00, -- 0.01 to 1.00 (1% to 100%)
    
    -- Status and timing
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
    start_date DATETIME,
    end_date DATETIME,
    
    -- Success metrics
    primary_metric TEXT NOT NULL DEFAULT 'conversion_rate' CHECK (primary_metric IN (
        'conversion_rate', 'revenue_per_visitor', 'average_order_value', 
        'click_through_rate', 'add_to_cart_rate', 'bundle_take_rate'
    )),
    
    -- Statistical significance
    confidence_level DECIMAL(3,2) NOT NULL DEFAULT 0.95, -- 0.90, 0.95, 0.99
    min_sample_size INTEGER NOT NULL DEFAULT 100,
    
    created_by TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO ab_experiments VALUES(1,'test-shop','ML Algorithm Comparison','Test different ML personalization modes for recommendations','ml_algorithm',1,'running','2025-09-28 10:20:05','2025-10-28 10:20:05','conversion_rate',0.95,100,NULL,'2025-09-28 10:20:05','2025-09-28 10:20:05');
INSERT INTO ab_experiments VALUES(2,'test-shop','ML Algorithm Comparison','Test different ML personalization modes for recommendations','ml_algorithm',1,'running','2025-09-28 10:20:26','2025-10-28 10:20:26','conversion_rate',0.95,100,NULL,'2025-09-28 10:20:26','2025-09-28 10:20:26');
CREATE TABLE ab_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Traffic split
    traffic_percentage DECIMAL(5,2) NOT NULL, -- 0.00 to 100.00
    is_control BOOLEAN DEFAULT FALSE,
    
    -- Variant configuration (JSON)
    config_data TEXT NOT NULL DEFAULT '{}', -- JSON configuration for the variant
    
    -- Performance tracking
    total_visitors INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0.00,
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id) ON DELETE CASCADE
);
INSERT INTO ab_variants VALUES(1,1,'Control',NULL,34,0,'{"personalizationMode": "basic", "mlEnabled": true}',0,0,0,'2025-09-28 10:20:26');
INSERT INTO ab_variants VALUES(2,1,'Advanced ML',NULL,33,0,'{"personalizationMode": "advanced", "mlEnabled": true}',0,0,0,'2025-09-28 10:20:26');
INSERT INTO ab_variants VALUES(3,1,'ML Disabled',NULL,33,0,'{"personalizationMode": "basic", "mlEnabled": false}',0,0,0,'2025-09-28 10:20:26');
CREATE TABLE ab_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    
    -- User identification
    user_identifier TEXT NOT NULL, -- session_id, customer_id, or anonymous_id
    identifier_type TEXT NOT NULL CHECK (identifier_type IN ('session', 'customer', 'anonymous')),
    
    -- Assignment context
    shop_id TEXT NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Sticky assignment (same user gets same variant)
    expires_at DATETIME, -- NULL for permanent assignment
    
    FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES ab_variants(id) ON DELETE CASCADE,
    UNIQUE(experiment_id, user_identifier, identifier_type)
);
CREATE TABLE ab_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    assignment_id INTEGER NOT NULL,
    
    -- Event details
    event_type TEXT NOT NULL CHECK (event_type IN (
        'exposure', 'click', 'add_to_cart', 'checkout_start', 
        'purchase', 'bundle_view', 'recommendation_click'
    )),
    
    -- Context data
    shop_id TEXT NOT NULL,
    user_identifier TEXT NOT NULL,
    session_id TEXT,
    page_url TEXT,
    
    -- Value tracking
    event_value DECIMAL(10,2) DEFAULT 0.00, -- Revenue, discount amount, etc.
    event_data TEXT DEFAULT '{}', -- Additional JSON metadata
    
    -- Timing
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES ab_variants(id) ON DELETE CASCADE,
    FOREIGN KEY (assignment_id) REFERENCES ab_assignments(id) ON DELETE CASCADE
);
COMMIT;
