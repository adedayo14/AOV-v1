import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { withAuth } from "../utils/auth.server";

/**
 * ML-Enhanced Popular Recommendations Endpoint
 * Provides popularity-based recommendations with customer preference filtering
 */
export const action = withAuth(async ({ request }: ActionFunctionArgs) => {
  try {
    const data = await request.json();
    const { exclude_ids, customer_preferences, privacy_level } = data;
    
    // Get popular recommendations
    const recommendations = await generatePopularRecommendations(
      exclude_ids || [],
      customer_preferences,
      privacy_level || 'basic'
    );
    
    return json({ recommendations });
    
  } catch (error) {
    console.error('Popular recommendations error:', error);
    return json({ error: 'Failed to generate popular recommendations' }, { status: 500 });
  }
});

async function generatePopularRecommendations(
  excludeIds: string[],
  customerPreferences: any,
  privacyLevel: string
) {
  // Get base popularity data
  const popularProducts = await getPopularProducts(excludeIds);
  
  if (privacyLevel === 'basic') {
    // Return basic popularity without personalization
    return popularProducts.slice(0, 20).map(product => ({
      product_id: product.id,
      score: product.popularity_score,
      reason: 'Popular choice',
      strategy: 'popularity_basic',
      popularity_metrics: {
        view_count: product.view_count,
        purchase_count: product.purchase_count,
        rating: product.avg_rating
      }
    }));
  }
  
  // Enhanced popularity with customer preference filtering
  const personalizedRecommendations = applyPersonalizationFilters(
    popularProducts,
    customerPreferences,
    privacyLevel
  );
  
  return personalizedRecommendations.slice(0, 20);
}

async function getPopularProducts(excludeIds: string[]) {
  // Mock popularity data - would be real database query with analytics
  const allProducts = await getAllProducts();
  
  // Calculate popularity scores based on various metrics
  return allProducts
    .filter(product => !excludeIds.includes(product.id))
    .map(product => ({
      ...product,
      popularity_score: calculatePopularityScore(product),
      view_count: Math.floor(Math.random() * 5000) + 100,
      purchase_count: Math.floor(Math.random() * 500) + 10,
      cart_add_count: Math.floor(Math.random() * 800) + 20,
      avg_rating: Math.round((Math.random() * 2 + 3) * 10) / 10, // 3.0 - 5.0
      conversion_rate: Math.round((Math.random() * 0.15 + 0.05) * 1000) / 1000 // 0.05 - 0.20
    }))
    .sort((a, b) => b.popularity_score - a.popularity_score);
}

function calculatePopularityScore(product: any): number {
  // Multi-factor popularity scoring
  const baseScore = Math.random() * 0.5 + 0.3; // Base random score 0.3-0.8
  
  // Factors that increase popularity (mock calculations)
  let score = baseScore;
  
  // Category popularity boost
  const popularCategories = ['Electronics', 'Fashion', 'Home'];
  if (popularCategories.includes(product.category)) {
    score += 0.1;
  }
  
  // Price range popularity
  const price = product.price || 50;
  if (price >= 20 && price <= 100) {
    score += 0.05; // Sweet spot pricing
  }
  
  // Seasonal boost (mock)
  const month = new Date().getMonth();
  if (product.category === 'Sports' && (month >= 2 && month <= 5)) {
    score += 0.1; // Spring/summer sports boost
  }
  
  return Math.min(1, score);
}

function applyPersonalizationFilters(
  popularProducts: any[],
  customerPreferences: any,
  privacyLevel: string
) {
  const recommendations = popularProducts.map(product => {
    let personalizedScore = product.popularity_score;
    const personalizationFactors = [];
    let reason = 'Popular choice';
    
    // Apply customer preference filters
    if (customerPreferences) {
      // Category affinity boost
      if (customerPreferences.category_affinity?.primary === product.category) {
        personalizedScore += 0.2;
        personalizationFactors.push('favorite_category');
        reason = 'Popular in your favorite category';
      } else if (customerPreferences.category_affinity?.secondary === product.category) {
        personalizedScore += 0.1;
        personalizationFactors.push('preferred_category');
      }
      
      // Price sensitivity matching
      if (customerPreferences.monetary?.price_tier) {
        const productPriceRange = getPriceRange(product.price);
        if (productPriceRange === customerPreferences.monetary.price_tier) {
          personalizedScore += 0.15;
          personalizationFactors.push('price_preference');
          reason = `Popular choice in your ${productPriceRange} price range`;
        }
      }
      
      // Brand loyalty boost
      if (customerPreferences.brand_loyalty?.top_brands?.includes(product.brand)) {
        personalizedScore += 0.1;
        personalizationFactors.push('brand_loyalty');
        reason = `Popular from ${product.brand}, a brand you like`;
      }
      
      // Recency-based boost for active customers
      if (customerPreferences.recency?.score >= 4) {
        personalizedScore += 0.05;
        personalizationFactors.push('active_customer');
      }
      
      // Frequency-based adjustments
      if (customerPreferences.frequency?.purchase_frequency >= 4) {
        // Loyal customers might prefer premium options
        if (product.price > 100) {
          personalizedScore += 0.08;
          personalizationFactors.push('premium_preference');
        }
      } else if (customerPreferences.frequency?.purchase_frequency <= 2) {
        // New customers might prefer popular, safer choices
        if (product.popularity_score > 0.7) {
          personalizedScore += 0.1;
          personalizationFactors.push('safe_choice');
          reason = 'Highly popular choice for new customers';
        }
      }
      
      // Time-based personalization (full ML only)
      if (privacyLevel === 'full_ml' && customerPreferences.time_patterns) {
        const currentHour = new Date().getHours();
        const preferredHours = customerPreferences.time_patterns.preferred_hours || [];
        
        if (preferredHours.includes(currentHour.toString())) {
          personalizedScore += 0.03;
          personalizationFactors.push('time_preference');
        }
      }
    }
    
    // Advanced personalization for full ML mode
    if (privacyLevel === 'full_ml') {
      personalizedScore = applyAdvancedPersonalization(
        product,
        personalizedScore,
        customerPreferences,
        personalizationFactors
      );
    }
    
    return {
      product_id: product.id,
      score: Math.min(1, personalizedScore),
      reason,
      strategy: privacyLevel === 'basic' ? 'popularity_basic' : 'popularity_personalized',
      popularity_metrics: {
        base_popularity: product.popularity_score,
        view_count: product.view_count,
        purchase_count: product.purchase_count,
        cart_add_count: product.cart_add_count,
        avg_rating: product.avg_rating,
        conversion_rate: product.conversion_rate
      },
      personalization_factors: personalizationFactors,
      personalization_boost: personalizedScore - product.popularity_score
    };
  });
  
  // Sort by personalized score
  return recommendations.sort((a, b) => b.score - a.score);
}

function applyAdvancedPersonalization(
  product: any,
  currentScore: number,
  customerPreferences: any,
  personalizationFactors: string[]
): number {
  let advancedScore = currentScore;
  
  // Churn risk consideration
  if (customerPreferences.advanced?.churn_risk > 0.7) {
    // High churn risk - boost popular, engaging products
    if (product.avg_rating > 4.5) {
      advancedScore += 0.1;
      personalizationFactors.push('churn_prevention');
    }
  }
  
  // LTV prediction consideration
  if (customerPreferences.advanced?.predicted_ltv > 200) {
    // High LTV customers - can suggest premium products
    if (product.price > 80) {
      advancedScore += 0.08;
      personalizationFactors.push('high_ltv');
    }
  }
  
  // Next purchase probability
  if (customerPreferences.advanced?.next_purchase_probability > 0.6) {
    // Likely to purchase - boost conversion-optimized products
    if (product.conversion_rate > 0.15) {
      advancedScore += 0.07;
      personalizationFactors.push('high_conversion');
    }
  }
  
  // Seasonal pattern matching
  if (customerPreferences.seasonality) {
    const currentSeason = getCurrentSeason();
    const seasonalActivity = customerPreferences.seasonality[currentSeason] || 0;
    
    if (seasonalActivity > 0.5) {
      advancedScore += 0.05;
      personalizationFactors.push('seasonal_activity');
    }
  }
  
  return advancedScore;
}

function getPriceRange(price: number): string {
  if (price < 25) return 'budget';
  if (price < 75) return 'mid_range';
  if (price < 150) return 'premium';
  return 'luxury';
}

function getCurrentSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

async function getAllProducts() {
  // Mock product data - would be real database query
  return [
    {
      id: "product_1",
      title: "Wireless Headphones",
      category: "Electronics",
      brand: "TechBrand",
      price: 99.99
    },
    {
      id: "product_2",
      title: "Bluetooth Speaker",
      category: "Electronics",
      brand: "SoundCorp",
      price: 79.99
    },
    {
      id: "product_3",
      title: "Running Shoes",
      category: "Sports",
      brand: "SportsCo",
      price: 129.99
    },
    {
      id: "product_4",
      title: "Yoga Mat",
      category: "Sports",
      brand: "FitnessPro",
      price: 29.99
    },
    {
      id: "product_5",
      title: "Coffee Maker",
      category: "Kitchen",
      brand: "BrewMaster",
      price: 159.99
    },
    {
      id: "product_6",
      title: "Smart Watch",
      category: "Electronics",
      brand: "TechBrand",
      price: 249.99
    },
    {
      id: "product_7",
      title: "Backpack",
      category: "Fashion",
      brand: "StyleCorp",
      price: 59.99
    },
    {
      id: "product_8",
      title: "Water Bottle",
      category: "Sports",
      brand: "HydroPro",
      price: 24.99
    },
    {
      id: "product_9",
      title: "Desk Lamp",
      category: "Home",
      brand: "LightCo",
      price: 45.99
    },
    {
      id: "product_10",
      title: "Phone Case",
      category: "Electronics",
      brand: "ProtectTech",
      price: 19.99
    }
  ];
}
