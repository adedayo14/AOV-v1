-- A/B Testing System for Cart Uplift
-- Enables testing of ML algorithms, bundle pricing, copy variations, etc.

-- A/B Test Experiments
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

-- A/B Test Variants
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

-- User Assignments to Variants
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

-- A/B Test Events and Conversions
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

-- A/B Test Results Cache
CREATE TABLE ab_results_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    
    -- Statistical results
    control_variant_id INTEGER NOT NULL,
    test_variant_id INTEGER NOT NULL,
    
    -- Performance metrics
    control_conversion_rate DECIMAL(5,4),
    test_conversion_rate DECIMAL(5,4),
    conversion_rate_lift DECIMAL(5,4), -- Percentage lift
    
    control_revenue_per_visitor DECIMAL(10,2),
    test_revenue_per_visitor DECIMAL(10,2),
    revenue_lift DECIMAL(5,4),
    
    -- Statistical significance
    p_value DECIMAL(10,8),
    confidence_interval_lower DECIMAL(5,4),
    confidence_interval_upper DECIMAL(5,4),
    is_statistically_significant BOOLEAN DEFAULT FALSE,
    
    -- Sample sizes
    control_sample_size INTEGER,
    test_sample_size INTEGER,
    total_sample_size INTEGER,
    
    -- Cache metadata
    calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL DEFAULT (datetime('now', '+1 hour')),
    
    FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id) ON DELETE CASCADE,
    FOREIGN KEY (control_variant_id) REFERENCES ab_variants(id),
    FOREIGN KEY (test_variant_id) REFERENCES ab_variants(id)
);

-- Indexes for Performance
CREATE INDEX idx_ab_experiments_shop_status ON ab_experiments(shop_id, status);
CREATE INDEX idx_ab_experiments_dates ON ab_experiments(start_date, end_date);
CREATE INDEX idx_ab_variants_experiment ON ab_variants(experiment_id);
CREATE INDEX idx_ab_assignments_experiment_user ON ab_assignments(experiment_id, user_identifier, identifier_type);
CREATE INDEX idx_ab_assignments_shop_expires ON ab_assignments(shop_id, expires_at);
CREATE INDEX idx_ab_events_experiment_variant ON ab_events(experiment_id, variant_id);
CREATE INDEX idx_ab_events_timestamp ON ab_events(timestamp);
CREATE INDEX idx_ab_events_type_shop ON ab_events(event_type, shop_id);
CREATE INDEX idx_ab_results_cache_experiment ON ab_results_cache(experiment_id, expires_at);

-- Views for Common Queries
CREATE VIEW active_experiments AS
SELECT 
    e.id,
    e.shop_id,
    e.name,
    e.test_type,
    e.traffic_allocation,
    e.primary_metric,
    e.start_date,
    e.end_date,
    COUNT(v.id) as variant_count,
    SUM(v.total_visitors) as total_visitors,
    SUM(v.total_conversions) as total_conversions,
    SUM(v.total_revenue) as total_revenue
FROM ab_experiments e
LEFT JOIN ab_variants v ON e.id = v.experiment_id
WHERE e.status = 'running'
  AND (e.start_date IS NULL OR e.start_date <= datetime('now'))
  AND (e.end_date IS NULL OR e.end_date > datetime('now'))
GROUP BY e.id, e.shop_id, e.name, e.test_type, e.traffic_allocation, e.primary_metric, e.start_date, e.end_date;

CREATE VIEW experiment_performance AS
SELECT 
    e.id as experiment_id,
    e.name as experiment_name,
    e.shop_id,
    v.id as variant_id,
    v.name as variant_name,
    v.is_control,
    v.traffic_percentage,
    
    -- Visitor metrics
    COUNT(DISTINCT a.user_identifier) as unique_visitors,
    COUNT(CASE WHEN ev.event_type = 'exposure' THEN 1 END) as exposures,
    COUNT(CASE WHEN ev.event_type = 'click' THEN 1 END) as clicks,
    COUNT(CASE WHEN ev.event_type = 'purchase' THEN 1 END) as conversions,
    
    -- Revenue metrics
    SUM(CASE WHEN ev.event_type = 'purchase' THEN ev.event_value ELSE 0 END) as total_revenue,
    AVG(CASE WHEN ev.event_type = 'purchase' THEN ev.event_value END) as avg_order_value,
    
    -- Calculated rates
    CASE 
        WHEN COUNT(CASE WHEN ev.event_type = 'exposure' THEN 1 END) > 0 
        THEN ROUND(
            (COUNT(CASE WHEN ev.event_type = 'purchase' THEN 1 END) * 100.0) / 
            COUNT(CASE WHEN ev.event_type = 'exposure' THEN 1 END), 4
        )
        ELSE 0 
    END as conversion_rate,
    
    CASE 
        WHEN COUNT(DISTINCT a.user_identifier) > 0 
        THEN ROUND(
            SUM(CASE WHEN ev.event_type = 'purchase' THEN ev.event_value ELSE 0 END) / 
            COUNT(DISTINCT a.user_identifier), 2
        )
        ELSE 0 
    END as revenue_per_visitor

FROM ab_experiments e
JOIN ab_variants v ON e.id = v.experiment_id
LEFT JOIN ab_assignments a ON v.id = a.variant_id
LEFT JOIN ab_events ev ON a.id = ev.assignment_id
WHERE e.status IN ('running', 'completed')
GROUP BY e.id, e.name, e.shop_id, v.id, v.name, v.is_control, v.traffic_percentage;

-- Triggers for Real-time Updates
CREATE TRIGGER update_variant_stats
AFTER INSERT ON ab_events
WHEN NEW.event_type IN ('exposure', 'purchase')
BEGIN
    UPDATE ab_variants 
    SET 
        total_visitors = total_visitors + CASE WHEN NEW.event_type = 'exposure' THEN 1 ELSE 0 END,
        total_conversions = total_conversions + CASE WHEN NEW.event_type = 'purchase' THEN 1 ELSE 0 END,
        total_revenue = total_revenue + CASE WHEN NEW.event_type = 'purchase' THEN NEW.event_value ELSE 0 END
    WHERE id = NEW.variant_id;
    
    -- Invalidate results cache when new data comes in
    DELETE FROM ab_results_cache WHERE experiment_id = NEW.experiment_id;
END;

-- Cleanup trigger for expired assignments
CREATE TRIGGER cleanup_expired_assignments
AFTER INSERT ON ab_assignments
BEGIN
    DELETE FROM ab_assignments 
    WHERE expires_at < datetime('now');
END;

-- Auto-complete experiments trigger
CREATE TRIGGER auto_complete_experiments
AFTER INSERT ON ab_events
BEGIN
    UPDATE ab_experiments 
    SET status = 'completed', updated_at = datetime('now')
    WHERE id = NEW.experiment_id 
      AND status = 'running'
      AND end_date IS NOT NULL 
      AND end_date <= datetime('now');
END;