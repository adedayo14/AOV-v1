import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { withAuth } from "../utils/auth.server";

/**
 * ML Profile Management Endpoint
 * Handles customer profile creation and updates with privacy controls
 */
export const action = withAuth(async ({ request, auth }: ActionFunctionArgs) => {
  try {
    const data = await request.json();
    const { user_id, privacy_level, behavior_data } = data;
    
    if (privacy_level === 'basic') {
      return json({ 
        profile: createAnonymousProfile(),
        features: null 
      });
    }
    
    if (!user_id) {
      return json({ error: 'User ID required for personalized profile' }, { status: 400 });
    }
    
    // Get or create customer profile
    const profile = await getOrCreateCustomerProfile(user_id, privacy_level, auth.session.shop);
    
    // Update with behavior data if provided
    if (behavior_data) {
      await updateProfileWithBehavior(profile, behavior_data, privacy_level);
    }
    
    // Generate ML features
    const features = generateMLFeatures(profile, privacy_level);
    
    return json({ profile, features });
    
  } catch (error) {
    console.error('Profile management error:', error);
    return json({ error: 'Failed to process profile request' }, { status: 500 });
  }
});

// Profile Update Endpoint
export async function updateProfile({ request, auth }: ActionFunctionArgs) {
  try {
    const data = await request.json();
    const { user_id, behavior_data, privacy_level } = data;
    
    if (privacy_level === 'basic' || !user_id) {
      return json({ success: true }); // No profile updates for basic mode
    }
    
    const profile = await getCustomerProfile(user_id, auth.session.shop);
    if (profile) {
      await updateProfileWithBehavior(profile, behavior_data, privacy_level);
    }
    
    return json({ success: true });
    
  } catch (error) {
    console.error('Profile update error:', error);
    return json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

function createAnonymousProfile() {
  return {
    type: 'anonymous',
    session_count: 1,
    preferences: {
      category: null,
      price_range: 'mid',
      brand: null
    },
    created_at: Date.now(),
    updated_at: Date.now()
  };
}

async function getOrCreateCustomerProfile(userId: string, privacyLevel: string, shop: string) {
  // This would typically query a database
  // For now, return a mock profile structure
  
  const existingProfile = await getCustomerProfile(userId, shop);
  
  if (existingProfile) {
    return existingProfile;
  }
  
  // Create new profile
  const profile = {
    type: 'customer',
    user_id: userId,
    shop,
    privacy_level: privacyLevel,
    session_count: 1,
    total_cart_value: 0,
    purchase_count: 0,
    last_purchase_date: null,
    preferences: {
      category_preferences: {},
      brand_preferences: {},
      price_interactions: []
    },
    behavior_patterns: {
      time_patterns: {},
      device_usage: {},
      seasonal_patterns: {}
    },
    segments: ['new_customer'],
    created_at: Date.now(),
    updated_at: Date.now()
  };
  
  // Store profile (would be database operation)
  await storeCustomerProfile(profile);
  
  return profile;
}

async function getCustomerProfile(userId: string, shop: string) {
  // Mock database query - would be real DB operation
  console.log(`Getting profile for user ${userId} in shop ${shop}`);
  return null; // No existing profile for demo
}

async function storeCustomerProfile(profile: any) {
  // Mock database storage - would be real DB operation
  console.log('Storing customer profile:', {
    user_id: profile.user_id,
    shop: profile.shop,
    privacy_level: profile.privacy_level,
    segments: profile.segments
  });
}

async function updateProfileWithBehavior(profile: any, behaviorData: any, privacyLevel: string) {
  if (!behaviorData || privacyLevel === 'basic') return;
  
  // Update profile based on behavior
  profile.updated_at = Date.now();
  
  if (behaviorData.type === 'session_start') {
    profile.session_count = (profile.session_count || 0) + 1;
  }
  
  if (behaviorData.type === 'purchase') {
    profile.purchase_count = (profile.purchase_count || 0) + 1;
    profile.total_cart_value = (profile.total_cart_value || 0) + (behaviorData.value || 0);
    profile.last_purchase_date = Date.now();
  }
  
  if (behaviorData.category && privacyLevel !== 'basic') {
    profile.preferences.category_preferences = profile.preferences.category_preferences || {};
    profile.preferences.category_preferences[behaviorData.category] = 
      (profile.preferences.category_preferences[behaviorData.category] || 0) + 1;
  }
  
  // Store updated profile
  await storeCustomerProfile(profile);
}

function generateMLFeatures(profile: any, privacyLevel: string) {
  if (privacyLevel === 'basic') return null;
  
  // Generate features for ML algorithms
  const features = {
    // RFM Analysis
    recency: calculateRecency(profile),
    frequency: calculateFrequency(profile),
    monetary: calculateMonetary(profile),
    
    // Behavioral features
    category_affinity: calculateCategoryAffinity(profile),
    time_patterns: profile.behavior_patterns?.time_patterns || {},
    
    // Segmentation
    customer_segment: determineCustomerSegment(profile),
    
    // Contextual
    session_context: {
      current_session_length: Date.now() - (profile.session_start || Date.now()),
      is_returning_customer: profile.purchase_count > 0
    }
  };
  
  // Add advanced features for full ML mode
  if (privacyLevel === 'full_ml') {
    features.advanced = {
      churn_risk: calculateChurnRisk(profile),
      predicted_ltv: calculatePredictedLTV(profile),
      next_purchase_probability: calculateNextPurchaseProbability(profile)
    };
  }
  
  return features;
}

function calculateRecency(profile: any) {
  if (!profile.last_purchase_date) {
    return { score: 0, days_since: null };
  }
  
  const daysSince = (Date.now() - profile.last_purchase_date) / (24 * 60 * 60 * 1000);
  
  let score = 0;
  if (daysSince <= 7) score = 5;
  else if (daysSince <= 30) score = 4;
  else if (daysSince <= 90) score = 3;
  else if (daysSince <= 180) score = 2;
  else score = 1;
  
  return { score, days_since: Math.floor(daysSince) };
}

function calculateFrequency(profile: any) {
  const purchases = profile.purchase_count || 0;
  const sessions = profile.session_count || 1;
  
  let purchaseFreq = 0;
  if (purchases >= 10) purchaseFreq = 5;
  else if (purchases >= 5) purchaseFreq = 4;
  else if (purchases >= 3) purchaseFreq = 3;
  else if (purchases >= 1) purchaseFreq = 2;
  else purchaseFreq = 1;
  
  return {
    purchase_frequency: purchaseFreq,
    session_frequency: Math.min(5, Math.floor(sessions / 10) + 1),
    conversion_rate: purchases / sessions
  };
}

function calculateMonetary(profile: any) {
  const totalValue = profile.total_cart_value || 0;
  const purchases = profile.purchase_count || 0;
  const avgOrderValue = purchases > 0 ? totalValue / purchases : 0;
  
  let monetaryScore = 0;
  if (totalValue >= 1000) monetaryScore = 5;
  else if (totalValue >= 500) monetaryScore = 4;
  else if (totalValue >= 200) monetaryScore = 3;
  else if (totalValue >= 50) monetaryScore = 2;
  else monetaryScore = 1;
  
  return {
    total_value: totalValue,
    average_order_value: avgOrderValue,
    monetary_score: monetaryScore
  };
}

function calculateCategoryAffinity(profile: any) {
  const categoryPrefs = profile.preferences?.category_preferences || {};
  const totalInteractions = Object.values(categoryPrefs).reduce((sum: number, count: any) => sum + count, 0);
  
  if (totalInteractions === 0) {
    return { primary: null, secondary: null, distribution: {} };
  }
  
  const entries = Object.entries(categoryPrefs).sort(([,a], [,b]) => (b as number) - (a as number));
  
  return {
    primary: entries[0]?.[0] || null,
    secondary: entries[1]?.[0] || null,
    distribution: Object.fromEntries(
      entries.map(([cat, count]) => [cat, (count as number) / totalInteractions])
    )
  };
}

function determineCustomerSegment(profile: any) {
  const recency = calculateRecency(profile);
  const frequency = calculateFrequency(profile);
  const monetary = calculateMonetary(profile);
  
  // Simple RFM segmentation
  if (recency.score >= 4 && frequency.purchase_frequency >= 4 && monetary.monetary_score >= 4) {
    return 'champion';
  } else if (recency.score >= 3 && frequency.purchase_frequency >= 3) {
    return 'loyal_customer';
  } else if (recency.score >= 4 && frequency.purchase_frequency <= 2) {
    return 'new_customer';
  } else if (recency.score <= 2 && frequency.purchase_frequency >= 3) {
    return 'at_risk';
  } else {
    return 'casual_browser';
  }
}

function calculateChurnRisk(profile: any) {
  const recency = calculateRecency(profile);
  const frequency = calculateFrequency(profile);
  
  let riskScore = 0;
  
  if (recency.days_since && recency.days_since > 90) riskScore += 0.4;
  if (frequency.conversion_rate < 0.1) riskScore += 0.3;
  if ((profile.session_count || 0) < 3) riskScore += 0.2;
  if ((profile.total_cart_value || 0) < 50) riskScore += 0.1;
  
  return Math.min(1, riskScore);
}

function calculatePredictedLTV(profile: any) {
  const monetary = calculateMonetary(profile);
  const frequency = calculateFrequency(profile);
  
  // Simple LTV prediction based on historical data
  const avgOrderValue = monetary.average_order_value || 0;
  const purchaseFreq = frequency.purchase_frequency || 1;
  
  return avgOrderValue * purchaseFreq * 2; // Simplified prediction
}

function calculateNextPurchaseProbability(profile: any) {
  const recency = calculateRecency(profile);
  const frequency = calculateFrequency(profile);
  
  // Simple probability based on recency and frequency
  let probability = 0.1; // Base probability
  
  if (recency.score >= 4) probability += 0.3;
  if (frequency.purchase_frequency >= 3) probability += 0.4;
  if (frequency.conversion_rate > 0.2) probability += 0.2;
  
  return Math.min(1, probability);
}
