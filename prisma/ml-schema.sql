-- ML Data Schema for Cart Uplift
-- This schema supports GDPR-compliant machine learning data storage

-- User Privacy Settings
CREATE TABLE ml_privacy_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    shop_id TEXT NOT NULL,
    consent_level TEXT NOT NULL CHECK (consent_level IN ('basic', 'enhanced', 'full_ml')),
    consent_timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_retention_days INTEGER NOT NULL DEFAULT 90,
    features_enabled TEXT NOT NULL DEFAULT '{}', -- JSON object
    last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    withdrawal_requested BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Customer ML Profiles
CREATE TABLE ml_customer_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    profile_type TEXT NOT NULL DEFAULT 'customer',
    session_count INTEGER DEFAULT 0,
    purchase_count INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0.00,
    average_order_value DECIMAL(10,2) DEFAULT 0.00,
    last_purchase_date DATETIME,
    first_visit_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    customer_segment TEXT,
    recency_score INTEGER DEFAULT 0,
    frequency_score INTEGER DEFAULT 0,
    monetary_score INTEGER DEFAULT 0,
    churn_risk DECIMAL(3,2) DEFAULT 0.00,
    predicted_ltv DECIMAL(10,2) DEFAULT 0.00,
    next_purchase_probability DECIMAL(3,2) DEFAULT 0.00,
    preferences TEXT DEFAULT '{}', -- JSON object
    computed_features TEXT DEFAULT '{}', -- JSON object
    last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES ml_privacy_settings(user_id),
    UNIQUE(user_id, shop_id)
);

-- Behavior Events
CREATE TABLE ml_behavior_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'page_view', 'product_view', 'cart_view', 'checkout_start', 
        'item_added', 'item_removed', 'purchase', 'search', 
        'recommendation_shown', 'recommendation_clicked'
    )),
    product_id TEXT,
    category_id TEXT,
    variant_id TEXT,
    quantity INTEGER,
    price DECIMAL(10,2),
    cart_value DECIMAL(10,2),
    search_query TEXT,
    recommendation_strategy TEXT,
    recommendation_score DECIMAL(3,2),
    view_duration INTEGER, -- milliseconds
    page_url TEXT,
    referrer_url TEXT,
    device_type TEXT,
    browser_type TEXT,
    event_data TEXT DEFAULT '{}', -- JSON for additional data
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES ml_privacy_settings(user_id)
);

-- Product Associations (for collaborative filtering)
CREATE TABLE ml_product_associations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL,
    product_a_id TEXT NOT NULL,
    product_b_id TEXT NOT NULL,
    association_type TEXT NOT NULL CHECK (association_type IN (
        'frequently_bought_together', 'viewed_together', 'similar_customers'
    )),
    confidence DECIMAL(3,2) NOT NULL,
    support DECIMAL(3,2) NOT NULL,
    lift DECIMAL(5,2) NOT NULL,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    last_calculated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, product_a_id, product_b_id, association_type)
);

-- User Similarity Matrix (for collaborative filtering)
CREATE TABLE ml_user_similarities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL,
    user_a_id TEXT NOT NULL,
    user_b_id TEXT NOT NULL,
    similarity_score DECIMAL(3,2) NOT NULL,
    similarity_type TEXT NOT NULL CHECK (similarity_type IN (
        'cosine', 'pearson', 'jaccard', 'euclidean'
    )),
    common_products INTEGER NOT NULL DEFAULT 0,
    last_calculated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_a_id) REFERENCES ml_privacy_settings(user_id),
    FOREIGN KEY (user_b_id) REFERENCES ml_privacy_settings(user_id),
    UNIQUE(shop_id, user_a_id, user_b_id, similarity_type)
);

-- Recommendation History
CREATE TABLE ml_recommendation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    recommendation_strategy TEXT NOT NULL CHECK (recommendation_strategy IN (
        'collaborative_filtering', 'content_based', 'popularity', 
        'bundle_discovery', 'hybrid', 'rule_based'
    )),
    recommendation_score DECIMAL(3,2) NOT NULL,
    position INTEGER NOT NULL, -- Position in recommendation list
    shown_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    clicked_at DATETIME,
    purchased_at DATETIME,
    cart_added_at DATETIME,
    context_data TEXT DEFAULT '{}', -- JSON for additional context
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES ml_privacy_settings(user_id)
);

-- Bundle Discovery Results
CREATE TABLE ml_bundle_discoveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL,
    bundle_name TEXT NOT NULL,
    product_ids TEXT NOT NULL, -- JSON array of product IDs
    bundle_type TEXT NOT NULL CHECK (bundle_type IN (
        'frequent_itemset', 'association_rule', 'similarity_based', 'manual'
    )),
    confidence DECIMAL(3,2) NOT NULL,
    support DECIMAL(3,2) NOT NULL,
    lift DECIMAL(5,2) NOT NULL,
    frequency INTEGER NOT NULL DEFAULT 0,
    revenue_impact DECIMAL(10,2) DEFAULT 0.00,
    conversion_rate DECIMAL(3,2) DEFAULT 0.00,
    times_shown INTEGER DEFAULT 0,
    times_clicked INTEGER DEFAULT 0,
    times_purchased INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    last_performance_update DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shop_id, bundle_name)
);

-- ML Model Performance Metrics
CREATE TABLE ml_model_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_id TEXT NOT NULL,
    model_type TEXT NOT NULL CHECK (model_type IN (
        'collaborative_filtering', 'content_based', 'bundle_discovery', 
        'customer_profiling', 'churn_prediction', 'ltv_prediction'
    )),
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    sample_size INTEGER NOT NULL,
    evaluation_period_start DATETIME NOT NULL,
    evaluation_period_end DATETIME NOT NULL,
    model_version TEXT NOT NULL DEFAULT '1.0',
    calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Data Deletion Log (GDPR Compliance)
CREATE TABLE ml_deletion_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    deletion_type TEXT NOT NULL CHECK (deletion_type IN (
        'complete', 'ml_only', 'anonymize', 'expired'
    )),
    requested_at DATETIME NOT NULL,
    processed_at DATETIME,
    status TEXT NOT NULL CHECK (status IN (
        'pending', 'processing', 'completed', 'failed'
    )),
    deleted_tables TEXT, -- JSON array of affected tables
    records_deleted INTEGER DEFAULT 0,
    records_anonymized INTEGER DEFAULT 0,
    error_message TEXT,
    verified_at DATETIME,
    retention_period_days INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_ml_privacy_settings_user_id ON ml_privacy_settings(user_id);
CREATE INDEX idx_ml_privacy_settings_shop_id ON ml_privacy_settings(shop_id);
CREATE INDEX idx_ml_privacy_settings_consent_level ON ml_privacy_settings(consent_level);

CREATE INDEX idx_ml_customer_profiles_user_id ON ml_customer_profiles(user_id);
CREATE INDEX idx_ml_customer_profiles_shop_id ON ml_customer_profiles(shop_id);
CREATE INDEX idx_ml_customer_profiles_segment ON ml_customer_profiles(customer_segment);

CREATE INDEX idx_ml_behavior_events_user_id ON ml_behavior_events(user_id);
CREATE INDEX idx_ml_behavior_events_shop_id ON ml_behavior_events(shop_id);
CREATE INDEX idx_ml_behavior_events_session_id ON ml_behavior_events(session_id);
CREATE INDEX idx_ml_behavior_events_event_type ON ml_behavior_events(event_type);
CREATE INDEX idx_ml_behavior_events_product_id ON ml_behavior_events(product_id);
CREATE INDEX idx_ml_behavior_events_timestamp ON ml_behavior_events(timestamp);

CREATE INDEX idx_ml_product_associations_shop_id ON ml_product_associations(shop_id);
CREATE INDEX idx_ml_product_associations_product_a ON ml_product_associations(product_a_id);
CREATE INDEX idx_ml_product_associations_product_b ON ml_product_associations(product_b_id);
CREATE INDEX idx_ml_product_associations_type ON ml_product_associations(association_type);

CREATE INDEX idx_ml_user_similarities_shop_id ON ml_user_similarities(shop_id);
CREATE INDEX idx_ml_user_similarities_user_a ON ml_user_similarities(user_a_id);
CREATE INDEX idx_ml_user_similarities_user_b ON ml_user_similarities(user_b_id);
CREATE INDEX idx_ml_user_similarities_score ON ml_user_similarities(similarity_score);

CREATE INDEX idx_ml_recommendation_history_user_id ON ml_recommendation_history(user_id);
CREATE INDEX idx_ml_recommendation_history_shop_id ON ml_recommendation_history(shop_id);
CREATE INDEX idx_ml_recommendation_history_product_id ON ml_recommendation_history(product_id);
CREATE INDEX idx_ml_recommendation_history_strategy ON ml_recommendation_history(recommendation_strategy);
CREATE INDEX idx_ml_recommendation_history_shown_at ON ml_recommendation_history(shown_at);

CREATE INDEX idx_ml_bundle_discoveries_shop_id ON ml_bundle_discoveries(shop_id);
CREATE INDEX idx_ml_bundle_discoveries_active ON ml_bundle_discoveries(is_active);
CREATE INDEX idx_ml_bundle_discoveries_type ON ml_bundle_discoveries(bundle_type);

CREATE INDEX idx_ml_model_performance_shop_id ON ml_model_performance(shop_id);
CREATE INDEX idx_ml_model_performance_model_type ON ml_model_performance(model_type);
CREATE INDEX idx_ml_model_performance_calculated_at ON ml_model_performance(calculated_at);

CREATE INDEX idx_ml_deletion_log_user_id ON ml_deletion_log(user_id);
CREATE INDEX idx_ml_deletion_log_status ON ml_deletion_log(status);
CREATE INDEX idx_ml_deletion_log_requested_at ON ml_deletion_log(requested_at);

-- Views for Common Queries
CREATE VIEW ml_active_users AS
SELECT 
    p.user_id,
    p.shop_id,
    s.consent_level,
    s.features_enabled,
    p.customer_segment,
    p.last_updated as profile_updated,
    s.last_updated as settings_updated
FROM ml_customer_profiles p
JOIN ml_privacy_settings s ON p.user_id = s.user_id
WHERE s.withdrawal_requested = FALSE
  AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP);

CREATE VIEW ml_performance_summary AS
SELECT 
    shop_id,
    model_type,
    AVG(metric_value) as avg_performance,
    COUNT(*) as measurement_count,
    MAX(calculated_at) as last_measured
FROM ml_model_performance
WHERE calculated_at > datetime('now', '-30 days')
GROUP BY shop_id, model_type;

-- Triggers for Data Retention
CREATE TRIGGER cleanup_expired_behavior_events
AFTER INSERT ON ml_behavior_events
BEGIN
    DELETE FROM ml_behavior_events 
    WHERE user_id = NEW.user_id 
      AND timestamp < datetime('now', '-' || (
          SELECT COALESCE(data_retention_days, 90) 
          FROM ml_privacy_settings 
          WHERE user_id = NEW.user_id
      ) || ' days');
END;

CREATE TRIGGER cleanup_expired_recommendation_history
AFTER INSERT ON ml_recommendation_history
BEGIN
    DELETE FROM ml_recommendation_history 
    WHERE user_id = NEW.user_id 
      AND shown_at < datetime('now', '-' || (
          SELECT COALESCE(data_retention_days, 90) 
          FROM ml_privacy_settings 
          WHERE user_id = NEW.user_id
      ) || ' days');
END;
