import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { withAuth } from "../utils/auth.server";

/**
 * ML Content-Based Recommendations Endpoint
 * Provides enhanced content-based recommendations using customer preferences
 */
export const action = withAuth(async ({ request }: ActionFunctionArgs) => {
  try {
    const data = await request.json();
    const { product_ids, exclude_ids, customer_preferences, privacy_level } = data;
    
    // Get content-based recommendations
    const recommendations = await generateContentRecommendations(
      product_ids || [],
      exclude_ids || [],
      customer_preferences,
      privacy_level || 'basic'
    );
    
    return json({ recommendations });
    
  } catch (error) {
    console.error('Content recommendations error:', error);
    return json({ error: 'Failed to generate content recommendations' }, { status: 500 });
  }
});

async function generateContentRecommendations(
  productIds: string[],
  excludeIds: string[],
  customerPreferences: any,
  privacyLevel: string
) {
  // Get product data for content analysis
  const baseProducts = await getProductsData(productIds);
  
  if (privacyLevel === 'basic') {
    // Basic content matching without personalization
    return await getBasicContentRecommendations(baseProducts, excludeIds);
  }
  
  // Enhanced content recommendations with personalization
  return await getPersonalizedContentRecommendations(
    baseProducts,
    excludeIds,
    customerPreferences,
    privacyLevel
  );
}

async function getBasicContentRecommendations(baseProducts: any[], excludeIds: string[]) {
  // Simple content-based matching using categories and attributes
  const recommendations = [];
  
  for (const product of baseProducts) {
    // Find similar products by category
    const similarProducts = await findSimilarProductsByCategory(
      product.category,
      excludeIds.concat(baseProducts.map(p => p.id))
    );
    
    recommendations.push(...similarProducts.map(p => ({
      product_id: p.id,
      score: calculateBasicSimilarity(product, p),
      reason: `Similar to ${product.title}`,
      strategy: 'content_category',
      attributes_matched: ['category']
    })));
  }
  
  // Remove duplicates and sort by score
  const uniqueRecommendations = Array.from(
    new Map(recommendations.map(r => [r.product_id, r])).values()
  );
  
  return uniqueRecommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

async function getPersonalizedContentRecommendations(
  baseProducts: any[],
  excludeIds: string[],
  customerPreferences: any,
  privacyLevel: string
) {
  const recommendations = [];
  
  for (const product of baseProducts) {
    // Enhanced content matching with customer preferences
    const similarProducts = await findSimilarProductsEnhanced(
      product,
      excludeIds.concat(baseProducts.map(p => p.id)),
      customerPreferences
    );
    
    recommendations.push(...similarProducts.map(p => ({
      product_id: p.id,
      score: calculatePersonalizedSimilarity(product, p, customerPreferences),
      reason: generatePersonalizedReason(product, p, customerPreferences),
      strategy: 'content_personalized',
      attributes_matched: getMatchedAttributes(product, p),
      personalization_factors: getPersonalizationFactors(p, customerPreferences)
    })));
  }
  
  // Advanced personalization for full ML mode
  if (privacyLevel === 'full_ml') {
    const advancedRecs = await getAdvancedContentRecommendations(
      baseProducts,
      excludeIds,
      customerPreferences
    );
    recommendations.push(...advancedRecs);
  }
  
  // Remove duplicates and apply personalized ranking
  const uniqueRecommendations = Array.from(
    new Map(recommendations.map(r => [r.product_id, r])).values()
  );
  
  return applyPersonalizedRanking(uniqueRecommendations, customerPreferences)
    .slice(0, 20);
}

async function findSimilarProductsByCategory(category: string, excludeIds: string[]) {
  // Mock product data - would be real database query
  const allProducts = await getAllProducts();
  
  return allProducts.filter(p => 
    p.category === category && 
    !excludeIds.includes(p.id)
  );
}

async function findSimilarProductsEnhanced(
  baseProduct: any,
  excludeIds: string[],
  customerPreferences: any
) {
  const allProducts = await getAllProducts();
  
  return allProducts.filter(p => {
    if (excludeIds.includes(p.id)) return false;
    
    // Content similarity checks
    const categoryMatch = p.category === baseProduct.category;
    const brandMatch = p.brand === baseProduct.brand;
    const priceRange = getPriceRange(p.price);
    const basePriceRange = getPriceRange(baseProduct.price);
    const priceMatch = priceRange === basePriceRange;
    
    // Basic content similarity
    if (categoryMatch || brandMatch || priceMatch) {
      return true;
    }
    
    // Advanced content similarity (tags, attributes, etc.)
    const tagOverlap = calculateTagOverlap(baseProduct.tags || [], p.tags || []);
    return tagOverlap > 0.3;
  });
}

async function getAdvancedContentRecommendations(
  baseProducts: any[],
  excludeIds: string[],
  customerPreferences: any
) {
  const recommendations = [];
  
  // Semantic similarity using product embeddings (mock)
  for (const product of baseProducts) {
    const semanticSimilar = await findSemanticallySimilarProducts(
      product,
      excludeIds,
      customerPreferences
    );
    
    recommendations.push(...semanticSimilar.map(p => ({
      product_id: p.id,
      score: p.semantic_similarity,
      reason: 'AI-powered semantic similarity',
      strategy: 'content_semantic',
      attributes_matched: ['semantic_embedding'],
      personalization_factors: ['customer_history', 'behavioral_patterns']
    })));
  }
  
  return recommendations;
}

function calculateBasicSimilarity(product1: any, product2: any): number {
  let similarity = 0;
  
  // Category match
  if (product1.category === product2.category) {
    similarity += 0.4;
  }
  
  // Brand match
  if (product1.brand === product2.brand) {
    similarity += 0.3;
  }
  
  // Price range match
  const priceRange1 = getPriceRange(product1.price);
  const priceRange2 = getPriceRange(product2.price);
  if (priceRange1 === priceRange2) {
    similarity += 0.2;
  }
  
  // Tag overlap
  const tagOverlap = calculateTagOverlap(product1.tags || [], product2.tags || []);
  similarity += tagOverlap * 0.1;
  
  return Math.min(1, similarity);
}

function calculatePersonalizedSimilarity(
  product1: any,
  product2: any,
  customerPreferences: any
): number {
  let similarity = calculateBasicSimilarity(product1, product2);
  
  // Apply customer preference boosts
  if (customerPreferences?.category_affinity?.primary === product2.category) {
    similarity += 0.2;
  }
  
  if (customerPreferences?.monetary?.price_tier) {
    const productPriceRange = getPriceRange(product2.price);
    const preferredRange = customerPreferences.monetary.price_tier;
    
    if (productPriceRange === preferredRange) {
      similarity += 0.15;
    }
  }
  
  // Temporal preferences
  if (customerPreferences?.time_patterns?.preferred_hours) {
    const currentHour = new Date().getHours();
    const preferredHours = customerPreferences.time_patterns.preferred_hours;
    
    if (preferredHours.includes(currentHour.toString())) {
      similarity += 0.05;
    }
  }
  
  return Math.min(1, similarity);
}

function generatePersonalizedReason(
  baseProduct: any,
  recommendedProduct: any,
  customerPreferences: any
): string {
  const reasons = [];
  
  if (baseProduct.category === recommendedProduct.category) {
    reasons.push('same category');
  }
  
  if (baseProduct.brand === recommendedProduct.brand) {
    reasons.push('same brand');
  }
  
  if (customerPreferences?.category_affinity?.primary === recommendedProduct.category) {
    reasons.push('matches your preferences');
  }
  
  const priceRange = getPriceRange(recommendedProduct.price);
  if (customerPreferences?.monetary?.price_tier === priceRange) {
    reasons.push('in your preferred price range');
  }
  
  if (reasons.length === 0) {
    return 'Similar product recommendation';
  }
  
  return `Recommended because it's ${reasons.join(' and ')}`;
}

function getMatchedAttributes(product1: any, product2: any): string[] {
  const matches = [];
  
  if (product1.category === product2.category) matches.push('category');
  if (product1.brand === product2.brand) matches.push('brand');
  if (getPriceRange(product1.price) === getPriceRange(product2.price)) matches.push('price_range');
  
  const tagOverlap = calculateTagOverlap(product1.tags || [], product2.tags || []);
  if (tagOverlap > 0.3) matches.push('tags');
  
  return matches;
}

function getPersonalizationFactors(product: any, customerPreferences: any): string[] {
  const factors = [];
  
  if (customerPreferences?.category_affinity?.primary === product.category) {
    factors.push('category_preference');
  }
  
  if (customerPreferences?.monetary?.price_tier === getPriceRange(product.price)) {
    factors.push('price_preference');
  }
  
  if (customerPreferences?.recency?.score > 3) {
    factors.push('recent_activity');
  }
  
  return factors;
}

function applyPersonalizedRanking(recommendations: any[], customerPreferences: any) {
  return recommendations.sort((a, b) => {
    let scoreA = a.score;
    let scoreB = b.score;
    
    // Boost based on personalization factors
    scoreA += (a.personalization_factors?.length || 0) * 0.1;
    scoreB += (b.personalization_factors?.length || 0) * 0.1;
    
    return scoreB - scoreA;
  });
}

async function findSemanticallySimilarProducts(
  baseProduct: any,
  excludeIds: string[],
  customerPreferences: any
) {
  // Mock semantic similarity - would use real embeddings
  const allProducts = await getAllProducts();
  
  return allProducts
    .filter(p => !excludeIds.includes(p.id))
    .map(p => ({
      ...p,
      semantic_similarity: Math.random() * 0.8 + 0.2 // Mock similarity score
    }))
    .filter(p => p.semantic_similarity > 0.5)
    .sort((a, b) => b.semantic_similarity - a.semantic_similarity)
    .slice(0, 5);
}

// Utility functions

function getPriceRange(price: number): string {
  if (price < 25) return 'budget';
  if (price < 75) return 'mid_range';
  if (price < 150) return 'premium';
  return 'luxury';
}

function calculateTagOverlap(tags1: string[], tags2: string[]): number {
  if (tags1.length === 0 || tags2.length === 0) return 0;
  
  const set1 = new Set(tags1);
  const set2 = new Set(tags2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

async function getAllProducts() {
  // Mock product data - would be real database query
  return [
    {
      id: "product_1",
      title: "Wireless Headphones",
      category: "Electronics",
      brand: "TechBrand",
      price: 99.99,
      tags: ["wireless", "audio", "bluetooth", "music"]
    },
    {
      id: "product_2",
      title: "Bluetooth Speaker",
      category: "Electronics",
      brand: "SoundCorp",
      price: 79.99,
      tags: ["wireless", "audio", "bluetooth", "portable"]
    },
    {
      id: "product_3",
      title: "Running Shoes",
      category: "Sports",
      brand: "SportsCo",
      price: 129.99,
      tags: ["athletic", "running", "footwear", "comfort"]
    },
    {
      id: "product_4",
      title: "Yoga Mat",
      category: "Sports",
      brand: "FitnessPro",
      price: 29.99,
      tags: ["yoga", "exercise", "fitness", "mat"]
    },
    {
      id: "product_5",
      title: "Coffee Maker",
      category: "Kitchen",
      brand: "BrewMaster",
      price: 159.99,
      tags: ["coffee", "kitchen", "appliance", "brewing"]
    }
  ];
}

async function getProductsData(productIds: string[]) {
  const allProducts = await getAllProducts();
  return allProducts.filter(p => productIds.includes(p.id));
}
