import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * A/B Testing API for Cart Uplift
 * Handles variant assignment, event tracking, and statistical calculations
 */

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { session } = await authenticate.public.appProxy(request);
    const shop = session?.shop;
    
    if (!shop) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const experimentId = url.searchParams.get('experiment_id');
    const userId = url.searchParams.get('user_id'); // session_id or customer_id

    switch (action) {
      case 'get_variant':
        return await getVariantAssignment(shop, experimentId, userId);
      
      case 'get_active_experiments':
        return await getActiveExperiments(shop);
      
      case 'get_experiment_results':
        return await getExperimentResults(shop, experimentId);
      
      default:
        return json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('A/B Testing API error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { session } = await authenticate.public.appProxy(request);
    const shop = session?.shop;
    
    if (!shop) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { action: actionType, ...payload } = data;

    switch (actionType) {
      case 'track_event':
        return await trackEvent(shop, payload);
      
      case 'assign_variant':
        return await assignVariant(shop, payload);
      
      default:
        return json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('A/B Testing API action error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Get variant assignment for a user
 */
async function getVariantAssignment(shop: string, experimentId: string | null, userId: string | null) {
  if (!experimentId || !userId) {
    return json({ error: 'Missing experiment_id or user_id' }, { status: 400 });
  }

  try {
    // Check for existing assignment
    const existingAssignment = await db.$queryRaw`
      SELECT a.*, v.name as variant_name, v.config_data
      FROM ab_assignments a
      JOIN ab_variants v ON a.variant_id = v.id
      WHERE a.experiment_id = ? AND a.user_identifier = ? AND a.shop_id = ?
    ` as any[];

    if (existingAssignment.length > 0) {
      const assignment = existingAssignment[0];
      return json({
        variant: assignment.variant_name,
        config: JSON.parse(assignment.config_data || '{}'),
        assignment_id: assignment.id
      });
    }

    // Get experiment details
    const experiment = await db.$queryRaw`
      SELECT * FROM ab_experiments 
      WHERE id = ? AND shop_id = ? AND status = 'running'
      AND (start_date IS NULL OR start_date <= datetime('now'))
      AND (end_date IS NULL OR end_date > datetime('now'))
    ` as any[];

    if (experiment.length === 0) {
      return json({ variant: 'control', config: {}, assignment_id: null });
    }

    // Get variants for this experiment
    const variants = await db.$queryRaw`
      SELECT * FROM ab_variants 
      WHERE experiment_id = ? 
      ORDER BY traffic_percentage DESC
    ` as any[];

    if (variants.length === 0) {
      return json({ variant: 'control', config: {}, assignment_id: null });
    }

    // Assign variant based on deterministic hash
    const hash = simpleHash(userId + experimentId) % 100;
    let cumulativePercentage = 0;
    let selectedVariant = variants[0]; // fallback to first variant

    for (const variant of variants) {
      cumulativePercentage += variant.traffic_percentage;
      if (hash < cumulativePercentage) {
        selectedVariant = variant;
        break;
      }
    }

    // Create assignment record
    const assignmentResult = await db.$queryRaw`
      INSERT INTO ab_assignments (
        experiment_id, variant_id, user_identifier, identifier_type, shop_id
      ) VALUES (?, ?, ?, 'session', ?)
      RETURNING id
    ` as any[];

    const assignmentId = assignmentResult[0]?.id;

    // Track exposure event
    await db.$queryRaw`
      INSERT INTO ab_events (
        experiment_id, variant_id, assignment_id, event_type, 
        shop_id, user_identifier, timestamp
      ) VALUES (?, ?, ?, 'exposure', ?, ?, datetime('now'))
    ` as any[];

    return json({
      variant: selectedVariant.name,
      config: JSON.parse(selectedVariant.config_data || '{}'),
      assignment_id: assignmentId
    });

  } catch (error) {
    console.error('Error getting variant assignment:', error);
    return json({ variant: 'control', config: {}, assignment_id: null });
  }
}

/**
 * Get active experiments for a shop
 */
async function getActiveExperiments(_shop: string) {
  try {
    const experiments = await db.$queryRaw`
      SELECT 
        e.id,
        e.name,
        e.test_type,
        e.traffic_allocation,
        json_group_array(
          json_object(
            'id', v.id,
            'name', v.name,
            'config_data', v.config_data,
            'traffic_percentage', v.traffic_percentage,
            'is_control', v.is_control
          )
        ) as variants_json
      FROM ab_experiments e
      LEFT JOIN ab_variants v ON e.id = v.experiment_id
      WHERE e.shop_id = ? 
        AND e.status = 'running'
        AND (e.start_date IS NULL OR e.start_date <= datetime('now'))
        AND (e.end_date IS NULL OR e.end_date > datetime('now'))
      GROUP BY e.id
    ` as any[];

    const formattedExperiments = experiments.map((exp: any) => ({
      ...exp,
      variants: JSON.parse(exp.variants_json || '[]').filter((v: any) => v.id !== null)
    }));

    return json({ experiments: formattedExperiments });
  } catch (error) {
    console.error('Error getting active experiments:', error);
    return json({ experiments: [] });
  }
}

/**
 * Track A/B testing events
 */
async function trackEvent(shop: string, payload: any) {
  const { 
    experiment_id: _experiment_id, 
    variant_id: _variant_id, 
    assignment_id: _assignment_id, 
    event_type: _event_type, 
    user_identifier: _user_identifier, 
    session_id: _session_id, 
    event_value: _event_value = 0, 
    event_data: _event_data = '{}',
    page_url: _page_url 
  } = payload;

  try {
    await db.$queryRaw`
      INSERT INTO ab_events (
        experiment_id, variant_id, assignment_id, event_type,
        shop_id, user_identifier, session_id, event_value, 
        event_data, page_url, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ` as any[];

    // Invalidate results cache for this experiment
    await db.$queryRaw`
      DELETE FROM ab_results_cache WHERE experiment_id = ?
    ` as any[];

    return json({ success: true });
  } catch (error) {
    console.error('Error tracking A/B event:', error);
    return json({ error: 'Failed to track event' }, { status: 500 });
  }
}

/**
 * Assign variant manually (for API calls)
 */
async function assignVariant(shop: string, payload: any) {
  const { experiment_id, user_identifier, identifier_type: _identifier_type = 'session' } = payload;

  if (!experiment_id || !user_identifier) {
    return json({ error: 'Missing required parameters' }, { status: 400 });
  }

  return await getVariantAssignment(shop, experiment_id, user_identifier);
}

/**
 * Get experiment results with statistical analysis
 */
async function getExperimentResults(shop: string, experimentId: string | null) {
  if (!experimentId) {
    return json({ error: 'Missing experiment_id' }, { status: 400 });
  }

  try {
    // Check cache first
    const cachedResults = await db.$queryRaw`
      SELECT * FROM ab_results_cache 
      WHERE experiment_id = ? AND expires_at > datetime('now')
      ORDER BY calculated_at DESC
      LIMIT 1
    ` as any[];

    if (cachedResults.length > 0) {
      return json({ results: cachedResults[0], cached: true });
    }

    // Calculate fresh results
    const variantPerformance = await db.$queryRaw`
      SELECT 
        v.id,
        v.name,
        v.is_control,
        COUNT(DISTINCT CASE WHEN e.event_type = 'exposure' THEN e.user_identifier END) as visitors,
        COUNT(CASE WHEN e.event_type = 'purchase' THEN 1 END) as conversions,
        SUM(CASE WHEN e.event_type = 'purchase' THEN e.event_value ELSE 0 END) as revenue,
        COUNT(CASE WHEN e.event_type = 'click' THEN 1 END) as clicks
      FROM ab_variants v
      LEFT JOIN ab_events e ON v.id = e.variant_id
      WHERE v.experiment_id = ? AND e.shop_id = ?
      GROUP BY v.id, v.name, v.is_control
    ` as any[];

    if (variantPerformance.length < 2) {
      return json({ 
        results: { 
          insufficient_data: true, 
          message: 'Need at least 2 variants with data' 
        } 
      });
    }

    // Find control and treatment variants
    const controlVariant = variantPerformance.find((v: any) => v.is_control);
    const treatmentVariants = variantPerformance.filter((v: any) => !v.is_control);

    if (!controlVariant || treatmentVariants.length === 0) {
      return json({ 
        results: { 
          insufficient_data: true, 
          message: 'Need both control and treatment variants' 
        } 
      });
    }

    // Calculate statistical significance for each treatment vs control
    const results = [];
    
    for (const treatment of treatmentVariants) {
      const controlConversionRate = controlVariant.visitors > 0 ? controlVariant.conversions / controlVariant.visitors : 0;
      const treatmentConversionRate = treatment.visitors > 0 ? treatment.conversions / treatment.visitors : 0;
      
      const controlRevenuePerVisitor = controlVariant.visitors > 0 ? controlVariant.revenue / controlVariant.visitors : 0;
      const treatmentRevenuePerVisitor = treatment.visitors > 0 ? treatment.revenue / treatment.visitors : 0;
      
      // Simple statistical test (Z-test for proportions)
      const { pValue, isSignificant, confidenceInterval } = calculateSignificance(
        controlVariant.conversions, controlVariant.visitors,
        treatment.conversions, treatment.visitors
      );
      
      const conversionLift = controlConversionRate > 0 ? 
        ((treatmentConversionRate - controlConversionRate) / controlConversionRate) * 100 : 0;
      
      const revenueLift = controlRevenuePerVisitor > 0 ? 
        ((treatmentRevenuePerVisitor - controlRevenuePerVisitor) / controlRevenuePerVisitor) * 100 : 0;

      results.push({
        control_variant_id: controlVariant.id,
        test_variant_id: treatment.id,
        control_conversion_rate: controlConversionRate,
        test_conversion_rate: treatmentConversionRate,
        conversion_rate_lift: conversionLift,
        control_revenue_per_visitor: controlRevenuePerVisitor,
        test_revenue_per_visitor: treatmentRevenuePerVisitor,
        revenue_lift: revenueLift,
        p_value: pValue,
        is_statistically_significant: isSignificant,
        confidence_interval_lower: confidenceInterval.lower,
        confidence_interval_upper: confidenceInterval.upper,
        control_sample_size: controlVariant.visitors,
        test_sample_size: treatment.visitors,
        total_sample_size: controlVariant.visitors + treatment.visitors
      });

      // Cache the results
      await db.$queryRaw`
        INSERT INTO ab_results_cache (
          experiment_id, control_variant_id, test_variant_id,
          control_conversion_rate, test_conversion_rate, conversion_rate_lift,
          control_revenue_per_visitor, test_revenue_per_visitor, revenue_lift,
          p_value, confidence_interval_lower, confidence_interval_upper,
          is_statistically_significant, control_sample_size, test_sample_size, total_sample_size,
          expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+1 hour'))
      ` as any[];
    }

    return json({ 
      results: results.length === 1 ? results[0] : results,
      variant_performance: variantPerformance,
      cached: false 
    });

  } catch (error) {
    console.error('Error getting experiment results:', error);
    return json({ error: 'Failed to get results' }, { status: 500 });
  }
}

/**
 * Calculate statistical significance using Z-test for proportions
 */
function calculateSignificance(
  controlConversions: number, 
  controlVisitors: number,
  treatmentConversions: number, 
  treatmentVisitors: number,
  confidenceLevel: number = 0.95
) {
  if (controlVisitors === 0 || treatmentVisitors === 0) {
    return {
      pValue: 1,
      isSignificant: false,
      confidenceInterval: { lower: 0, upper: 0 }
    };
  }

  const p1 = controlConversions / controlVisitors;
  const p2 = treatmentConversions / treatmentVisitors;
  const pPooled = (controlConversions + treatmentConversions) / (controlVisitors + treatmentVisitors);
  
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / controlVisitors + 1 / treatmentVisitors));
  
  if (se === 0) {
    return {
      pValue: 1,
      isSignificant: false,
      confidenceInterval: { lower: 0, upper: 0 }
    };
  }
  
  const zScore = (p2 - p1) / se;
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore))); // Two-tailed test
  
  const alpha = 1 - confidenceLevel;
  const isSignificant = pValue < alpha;
  
  // Confidence interval for the difference
  const seDiff = Math.sqrt(p1 * (1 - p1) / controlVisitors + p2 * (1 - p2) / treatmentVisitors);
  const zCritical = normalInverse(1 - alpha / 2);
  const marginOfError = zCritical * seDiff;
  
  const diff = p2 - p1;
  const confidenceInterval = {
    lower: (diff - marginOfError) * 100,
    upper: (diff + marginOfError) * 100
  };
  
  return {
    pValue,
    isSignificant,
    confidenceInterval
  };
}

/**
 * Simple hash function for deterministic variant assignment
 */
function simpleHash(str: string): number {
  let hash = 0;
  if (str.length === 0) return hash;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash);
}

/**
 * Normal cumulative distribution function approximation
 */
function normalCDF(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2.0);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Inverse normal distribution approximation
 */
function normalInverse(p: number): number {
  if (p <= 0 || p >= 1) throw new Error('p must be between 0 and 1');
  
  // Approximation for standard normal inverse
  // This is a simplified version - for production use a more accurate approximation
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  let x: number;
  if (p > 0.5) {
    x = Math.sqrt(-2 * Math.log(1 - p));
    x = x - (c0 + c1 * x + c2 * x * x) / (1 + d1 * x + d2 * x * x + d3 * x * x * x);
  } else {
    x = Math.sqrt(-2 * Math.log(p));
    x = -x + (c0 + c1 * x + c2 * x * x) / (1 + d1 * x + d2 * x * x + d3 * x * x * x);
  }
  
  return x;
}