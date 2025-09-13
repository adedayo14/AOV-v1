import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { withAuth } from "../utils/auth.server";

/**
 * ML Events Endpoint
 * Handles privacy-compliant behavior tracking events
 */
export const action = withAuth(async ({ request, auth }: ActionFunctionArgs) => {
  try {
    const data = await request.json();
    const { events, privacy_level, consent_timestamp } = data;
    
    // Validate privacy level and consent
    if (!privacy_level || privacy_level === 'basic') {
      // Only process anonymous events for basic mode
      const anonymousEvents = events.filter(event => 
        !event.user_id && ['cart_updated', 'checkout_started'].includes(event.event)
      );
      
      // Store anonymous analytics only
      await processAnonymousEvents(anonymousEvents, auth.session.shop);
      
      return json({ success: true, processed: anonymousEvents.length });
    }
    
    // Enhanced/Full ML mode - check consent
    if (!consent_timestamp) {
      return json({ error: 'Consent required for enhanced tracking' }, { status: 400 });
    }
    
    // Process events with privacy controls
    const processedEvents = await processPrivacyCompliantEvents(
      events, 
      privacy_level, 
      auth.session.shop
    );
    
    return json({ success: true, processed: processedEvents.length });
    
  } catch (error) {
    console.error('ML events processing error:', error);
    return json({ error: 'Failed to process events' }, { status: 500 });
  }
});

async function processAnonymousEvents(events, shop) {
  // Store only aggregated, anonymous analytics
  // This would typically go to a database or analytics service
  
  for (const event of events) {
    // Example: Aggregate cart abandonment rates
    if (event.event === 'cart_updated') {
      // Store anonymous cart metrics
      console.log(`Anonymous cart event for shop ${shop}:`, {
        timestamp: event.timestamp,
        session_id: event.session_id // No user ID
      });
    }
  }
}

async function processPrivacyCompliantEvents(events, privacyLevel, shop) {
  const processedEvents = [];
  
  for (const event of events) {
    // Apply privacy filters based on level
    const sanitizedEvent = sanitizeEventData(event, privacyLevel);
    
    if (sanitizedEvent) {
      // Store for ML processing
      await storeMLEvent(sanitizedEvent, shop);
      processedEvents.push(sanitizedEvent);
    }
  }
  
  return processedEvents;
}

function sanitizeEventData(event, privacyLevel) {
  // Base sanitization
  const sanitized = {
    event: event.event,
    timestamp: event.timestamp,
    session_id: event.session_id,
    properties: {
      privacy_level: privacyLevel
    }
  };
  
  // Add data based on privacy level
  if (privacyLevel === 'enhanced') {
    // Include product interactions and user ID
    sanitized.user_id = event.user_id;
    sanitized.properties.product_id = event.properties?.product_id;
    sanitized.properties.category = event.properties?.category;
    sanitized.properties.price = event.properties?.price;
  }
  
  if (privacyLevel === 'full_ml') {
    // Include all behavioral data
    sanitized.user_id = event.user_id;
    sanitized.properties = { ...event.properties };
    
    // But still exclude PII
    delete sanitized.properties.email;
    delete sanitized.properties.phone;
    delete sanitized.properties.address;
  }
  
  return sanitized;
}

async function storeMLEvent(event, shop) {
  // This would typically store in a database optimized for ML processing
  // For now, just log the structure
  console.log(`ML Event stored for shop ${shop}:`, {
    event: event.event,
    user_id: event.user_id,
    timestamp: event.timestamp,
    privacy_level: event.properties.privacy_level
  });
}
