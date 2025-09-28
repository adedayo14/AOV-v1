import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

/**
 * A/B Testing API for Cart Uplift
 * Handles variant assignment, event tracking, and result analysis
 */

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const { session } = await authenticate.public.appProxy(request);
    
    if (!session?.shop) {
      return json({ error: 'Shop not found' }, { status: 400 });
    }

    if (action === 'experiments') {
      // Get active experiments for the shop
      const experiments = await prisma.aBExperiment.findMany({
        where: { 
          shopId: session.shop,
          status: 'running'
        },
        include: { variants: true }
      });
      
      return json({ experiments });
    }

    return json({ status: 'ready', message: 'A/B testing API is active' });
  } catch (error) {
    console.error('A/B testing API error:', error);
    return json({ error: 'Failed to process request' }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { session } = await authenticate.public.appProxy(request);
    
    if (!session?.shop) {
      return json({ error: 'Shop not found' }, { status: 400 });
    }

    const formData = await request.formData();
    const action = formData.get('action') as string;

    if (action === 'assign-variant') {
      return await handleVariantAssignment(session.shop, formData);
    }
    
    if (action === 'track-event') {
      return await handleEventTracking(session.shop, formData);
    }

    return json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('A/B testing API action error:', error);
    return json({ error: 'Failed to process action' }, { status: 500 });
  }
}

/**
 * Handle variant assignment for A/B test
 */
async function handleVariantAssignment(shop: string, formData: FormData) {
  const experimentId = parseInt(formData.get('experimentId') as string);
  const userId = formData.get('userId') as string;
  
  if (!experimentId || !userId) {
    return json({ error: 'Missing experimentId or userId' }, { status: 400 });
  }

  try {
    // Check for existing assignment
    const existingAssignment = await prisma.aBAssignment.findFirst({
      where: {
        experimentId,
        userIdentifier: userId,
        shopId: shop
      },
      include: { variant: true }
    });

    if (existingAssignment) {
      return json({
        variant: existingAssignment.variant.name,
        config: JSON.parse(existingAssignment.variant.configData || '{}'),
        assignmentId: existingAssignment.id
      });
    }

    // Get experiment and variants
    const experiment = await prisma.aBExperiment.findFirst({
      where: { 
        id: experimentId, 
        shopId: shop, 
        status: 'running' 
      },
      include: { variants: true }
    });

    if (!experiment || !experiment.variants.length) {
      return json({ variant: 'control', config: {}, assignmentId: null });
    }

    // Simple random assignment based on traffic percentage
    const totalTraffic = experiment.variants.reduce((sum, v) => sum + Number(v.trafficPercentage), 0);
    const random = Math.random() * totalTraffic;
    
    let cumulativePercentage = 0;
    let selectedVariant = experiment.variants[0]; // Default to first variant
    
    for (const variant of experiment.variants) {
      cumulativePercentage += Number(variant.trafficPercentage);
      if (random < cumulativePercentage) {
        selectedVariant = variant;
        break;
      }
    }

    // Create assignment
    const assignment = await prisma.aBAssignment.create({
      data: {
        experimentId,
        variantId: selectedVariant.id,
        userIdentifier: userId,
        identifierType: 'session',
        shopId: shop,
      }
    });

    // Track exposure event
    await prisma.aBEvent.create({
      data: {
        experimentId,
        variantId: selectedVariant.id,
        assignmentId: assignment.id,
        eventType: 'exposure',
        shopId: shop,
        userIdentifier: userId,
      }
    });

    return json({
      variant: selectedVariant.name,
      config: JSON.parse(selectedVariant.configData || '{}'),
      assignmentId: assignment.id
    });
  } catch (error) {
    console.error('Variant assignment error:', error);
    return json({ error: 'Failed to assign variant' }, { status: 500 });
  }
}

/**
 * Handle event tracking for A/B tests
 */
async function handleEventTracking(shop: string, formData: FormData) {
  const experimentId = parseInt(formData.get('experimentId') as string);
  const variantId = parseInt(formData.get('variantId') as string);
  const assignmentId = parseInt(formData.get('assignmentId') as string);
  const eventType = formData.get('eventType') as string;
  const userId = formData.get('userId') as string;
  const eventValue = parseFloat(formData.get('eventValue') as string) || 0;
  const eventData = formData.get('eventData') as string || '{}';

  try {
    // Create event
    await prisma.aBEvent.create({
      data: {
        experimentId,
        variantId,
        assignmentId,
        eventType,
        shopId: shop,
        userIdentifier: userId,
        eventValue,
        eventData,
      }
    });

    // Update variant statistics if it's a conversion
    if (eventType === 'conversion') {
      await prisma.aBVariant.update({
        where: { id: variantId },
        data: {
          totalConversions: { increment: 1 },
          totalRevenue: { increment: eventValue }
        }
      });
    }

    return json({ success: true, message: 'Event tracked successfully' });
  } catch (error) {
    console.error('Event tracking error:', error);
    return json({ error: 'Failed to track event' }, { status: 500 });
  }
}