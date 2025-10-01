import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Grid,
  ProgressBar,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getSettings } from "../models/settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop; // e.g. test-lab-101.myshopify.com
  
  // Get current settings to calculate setup progress
  const settings = await getSettings(shop);
  
  // Get the current theme ID to create direct embed link
  let currentThemeId = null;
  try {
    const response = await admin.graphql(`
      #graphql
      query getCurrentTheme {
        themes(first: 50) {
          edges {
            node {
              id
              name
              role
            }
          }
        }
      }
    `);
    
    const responseJson = await response.json();
    const themes = responseJson.data?.themes?.edges || [];
    const currentTheme = themes.find((theme: any) => theme.node.role === 'MAIN');
    if (currentTheme) {
      // Extract numeric ID from GraphQL ID (e.g., "gid://shopify/Theme/123456789" -> "123456789")
      currentThemeId = currentTheme.node.id.split('/').pop();
    }
  } catch (error) {
    console.error('Failed to fetch current theme:', error);
  }
  
  // Calculate setup progress focusing on core features
  const setupSteps = [
    { key: 'stickyCart', label: 'Sticky cart enabled', completed: !!settings.enableStickyCart },
  { key: 'analytics', label: 'Analytics enabled', completed: !!settings.enableAnalytics },
    { key: 'recommendations', label: 'Recommendations configured', completed: !!settings.enableRecommendations },
    { key: 'incentives', label: 'Incentives configured', completed: (
      // Free shipping considered configured only if threshold > 0
      (!!settings.enableFreeShipping && Number(settings.freeShippingThreshold) > 0) ||
      // Gift gating considered configured only if there are one or more thresholds
      (!!(settings as any).enableGiftGating && (() => { try { return (JSON.parse((settings as any).giftThresholds || '[]') || []).length > 0; } catch { return false; } })()) ||
      // Combined progress bar mode also counts
      (settings as any).progressBarMode === 'combined'
    ) },
    { key: 'styling', label: 'Styling customized', completed: (
      settings.backgroundColor !== "#ffffff" ||
      settings.textColor !== "#1A1A1A" ||
      (settings.buttonColor !== "var(--button-background, #000000)" && settings.buttonColor !== "#000000")
    )},
  ];
  
  const completedSteps = setupSteps.filter(step => step.completed).length;
  const progressPercentage = Math.round((completedSteps / setupSteps.length) * 100);

  return json({ setupSteps, progressPercentage, currentThemeId, shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
          handle: `${color.toLowerCase()}-snowboard`,
          status: "ACTIVE",
          variants: [
            {
              price: "10.00",
              inventoryQuantity: 100,
              requiresShipping: true,
            },
          ],
        },
      },
    },
  );
  const responseJson = await response.json();
  const product = responseJson.data?.productCreate?.product;
  const userErrors = responseJson.data?.productCreate?.userErrors;

  return json({ product, userErrors });
};

export default function Index() {
  const { setupSteps, progressPercentage, currentThemeId, shop } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  // Build absolute admin URL so it doesn't resolve to the app/dev origin
  const shopHandle = (shop || '').replace('.myshopify.com', '');
  const themeEditorUrl = currentThemeId
    ? `https://admin.shopify.com/store/${shopHandle}/themes/${currentThemeId}/editor?context=apps`
    : `https://admin.shopify.com/store/${shopHandle}/themes/current/editor?context=apps`;

  // Enhanced navigation function that works in embedded app context
  const navigateToPage = (path: string) => {
    console.log('🚀 Navigation requested to:', path);
    console.log('🔍 Current location:', window.location.href);
    
    try {
      // Add a small delay to ensure the click event is properly handled
      setTimeout(() => {
        console.log('🔄 Attempting navigation with useNavigate...');
        navigate(path);
        console.log('✅ Navigation successful using standard navigate');
      }, 10);
    } catch (error) {
      console.error('❌ Standard navigation failed:', error);
      console.log('🔄 Trying window.location fallback...');
      try {
        // Construct full URL for embedded app context
        const baseUrl = window.location.origin;
        const fullUrl = `${baseUrl}${path}`;
        console.log('🔗 Navigating to full URL:', fullUrl);
        window.location.href = fullUrl;
      } catch (fallbackError) {
        console.error('❌ All navigation methods failed:', fallbackError);
        alert(`Navigation failed. Please manually navigate to: ${path}`);
      }
    }
  };

  return (
    <Page fullWidth>
      <TitleBar title="Cart Uplift - Smart Upsells & Cart Optimization" />
      <BlockStack gap="500">
        {/* Hero Section */}
        <Card>
          <BlockStack gap="500">
            <BlockStack gap="300">
              <Text as="h1" variant="headingXl">
                Welcome to Cart Uplift 🚀 v1
              </Text>
              <Text variant="bodyLg" as="p">
                Boost your store's revenue with intelligent cart optimization and upselling features:
              </Text>
              <style dangerouslySetInnerHTML={{
                __html: `
                  .feature-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 24px;
                  }
                  
                  .feature-column {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                  }
                  
                  .feature-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 12px;
                    border-radius: 8px;
                    background: #f6f6f7;
                    margin-bottom: 8px;
                  }
                  
                  .feature-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                  }
                  
                  .feature-checkmark {
                    color: #00a047;
                    font-weight: bold;
                    font-size: 16px;
                  }
                  
                  @media (max-width: 768px) {
                    .feature-grid {
                      grid-template-columns: 1fr;
                      gap: 16px;
                    }
                  }
                `
              }} />
              <div className="feature-grid">
                <div className="feature-column">
                  <div className="feature-item">
                    <div className="feature-content">
                      <span className="feature-checkmark">✓</span>
                      <Text variant="bodyMd" as="span">AI-powered product recommendations</Text>
                    </div>
                    <Button 
                      size="micro" 
                      variant="primary"
                      onClick={() => navigateToPage('/app/settings')}
                    >
                      Configure ML
                    </Button>
                  </div>
                  <div className="feature-item">
                    <div className="feature-content">
                      <span className="feature-checkmark">✓</span>
                      <Text variant="bodyMd" as="span">Dynamic free shipping incentives</Text>
                    </div>
                    <Text variant="bodyMd" as="span" tone="subdued">
                      <Text variant="bodySm" as="span">Configured in theme embed</Text>
                    </Text>
                  </div>
                </div>
                <div className="feature-column">
                  <div className="feature-item">
                    <div className="feature-content">
                      <span className="feature-checkmark">✓</span>
                      <Text variant="bodyMd" as="span">Automated cross-sell suggestions</Text>
                    </div>
                    <Button 
                      size="micro"
                      onClick={() => navigateToPage('/app/manage')}
                    >
                      Manage Products
                    </Button>
                  </div>
                  <div className="feature-item">
                    <div className="feature-content">
                      <span className="feature-checkmark">✓</span>
                      <Text variant="bodyMd" as="span">Cart progress & abandonment tracking</Text>
                    </div>
                    <Button 
                      size="micro"
                      onClick={() => navigateToPage('/app/dashboard')}
                    >
                      View Analytics
                    </Button>
                  </div>
                </div>
                <div className="feature-column">
                  <div className="feature-item">
                    <div className="feature-content">
                      <span className="feature-checkmark">✓</span>
                      <Text variant="bodyMd" as="span">Conversion rate optimization</Text>
                    </div>
                    <Button 
                      size="micro" 
                      variant="primary"
                      onClick={() => navigateToPage('/app/dashboard')}
                    >
                      View Dashboard
                    </Button>
                  </div>
                  <div className="feature-item">
                    <div className="feature-content">
                      <span className="feature-checkmark">✓</span>
                      <Text variant="bodyMd" as="span">Customizable layouts & styling</Text>
                    </div>
                    <Button 
                      size="micro"
                      onClick={() => navigate('/app/settings')}
                    >
                      Customize
                    </Button>
                  </div>
                </div>
              </div>
            </BlockStack>
            <InlineStack gap="300">
              <Button 
                variant="primary"
                size="large"
                onClick={() => navigateToPage('/app/settings')}
              >
                Configure Settings
              </Button>
              <Button 
                size="large"
                onClick={() => navigateToPage('/app/dashboard')}
              >
                View Dashboard
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Main Navigation Section */}
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">📊 Dashboard</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Monitor your Cart Uplift performance in real-time:
                </Text>
                <BlockStack gap="200">
                  <Text variant="bodySm" as="p">• Revenue Impact: Track additional revenue generated by Cart Uplift</Text>
                  <Text variant="bodySm" as="p">• Conversion Metrics: Monitor cart abandonment reduction and upsell success</Text>
                  <Text variant="bodySm" as="p">• Product Performance: See which recommendations drive the most sales</Text>
                  <Text variant="bodySm" as="p">• Customer Insights: Understand shopping behavior and preferences</Text>
                </BlockStack>
                <Text variant="bodyMd" as="p">
                  💡 <strong>Tip:</strong> Use dashboard insights to optimize your cart settings and maximize ROI.
                </Text>
                <div className="card-button-wrapper">
                  <Button 
                    variant="primary" 
                    size="large"
                    onClick={() => navigateToPage('/app/dashboard')}
                  >
                    Open Dashboard
                  </Button>
                </div>
              </BlockStack>
            </Card>
          </Grid.Cell>
          
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">🧪 A/B Testing</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Test and optimize your recommendation algorithms, bundle pricing, and customer experience:
                </Text>
                <BlockStack gap="200">
                  <Text variant="bodySm" as="p">• Bundle Pricing: Test different discount rates (10% vs 15% vs 20%)</Text>
                  <Text variant="bodySm" as="p">• ML Personalization: Test basic vs advanced recommendation algorithms</Text>
                  <Text variant="bodySm" as="p">• Copy Testing: Test "Complete the Look" vs "Perfect Match" titles</Text>
                  <Text variant="bodySm" as="p">• Layout Variants: Test different recommendation grid layouts</Text>
                </BlockStack>
                <Text variant="bodyMd" as="p">
                  🎯 <strong>Ready:</strong> Statistical significance testing and conversion tracking active.
                </Text>
                <div className="card-button-wrapper">
                  <Button 
                    variant="primary" 
                    size="large"
                    onClick={() => navigateToPage('/app/ab-testing')}
                  >
                    Start A/B Testing
                  </Button>
                </div>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>

        {/* Setup Progress Section - Hide when 100% complete */}
        {progressPercentage < 100 && (
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Setup Progress
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  {progressPercentage}% Complete
                </Text>
              </BlockStack>
              
              <div className="cartuplift-setup-progress">
                <ProgressBar progress={progressPercentage} size="small" />
              </div>
              <style dangerouslySetInnerHTML={{
                __html: `
                  /* Force Polaris ProgressBar to black (scoped) */
                  .cartuplift-setup-progress .Polaris-ProgressBar__Indicator,
                  .cartuplift-setup-progress .Polaris-ProgressBar__Indicator:after {
                    background: #000 !important;
                    background-color: #000 !important;
                  }
                  /* Newer Polaris may use CSS variables; override them too */
                  .cartuplift-setup-progress .Polaris-ProgressBar {
                    --pc-progress-bar-color: #000 !important;
                    --p-progress-bar-indicator: #000 !important;
                  }
                `
              }} />
              
              <style dangerouslySetInnerHTML={{
                __html: `
                  .setup-steps-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                    margin-top: 16px;
                  }
                  
                  .setup-step {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px;
                    border-radius: 8px;
                    background: #f6f6f7;
                  }
                  
                  .setup-step.completed {
                    background: #e7f5e7;
                  }
                  
                  .setup-step-icon {
                    font-size: 16px;
                    font-weight: bold;
                  }
                  
                  .setup-step-icon.completed {
                    color: #00a047;
                  }
                  
                  .setup-step-icon.pending {
                    color: #8c9196;
                  }
                  
                  .spacing-gap {
                    height: 16px;
                  }
                `
              }} />
              
              <div className="setup-steps-grid">
                {setupSteps.map((step, _index) => (
                  <div key={step.key} className={`setup-step ${step.completed ? 'completed' : ''}`}>
                    <span className={`setup-step-icon ${step.completed ? 'completed' : 'pending'}`}>
                      {step.completed ? '✓' : '○'}
                    </span>
                    <Text variant="bodyMd" as="span">
                      {step.label}
                    </Text>
                  </div>
                ))}
              </div>
              
              <InlineStack gap="300">
                <Link to="/app/settings">
                  <Button 
                    variant="primary"
                  >
                    Complete Setup
                  </Button>
                </Link>
                <a href={themeEditorUrl} target="_top" rel="noopener noreferrer">
                  <Button variant="secondary">Install Theme Embed</Button>
                </a>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {/* Main Content Grid */}
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Equal height card styles */
            .Polaris-Card {
              height: 100%;
            }

            .Polaris-Card__Section {
              display: flex;
              flex-direction: column;
              height: 100%;
              min-height: 450px;
            }

            .card-content-wrapper {
              flex: 1;
            }

            .card-button-wrapper {
              margin-top: auto;
              padding-top: 16px;
            }

            .cartuplift-action-buttons {
              margin-top: 16px;
              display: flex;
              justify-content: flex-end;
            }

            .cartuplift-action-buttons .Polaris-Button {
              background: #1a1a1a !important;
              border-color: #1a1a1a !important;
              color: white !important;
            }

            .cartuplift-action-buttons .Polaris-Button:hover {
              background: #333 !important;
              border-color: #333 !important;
            }

            @media (max-width: 768px) {
              .cartuplift-action-buttons {
                justify-content: center;
              }
            }
          `
        }} />
        
        <Grid>
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
            <Card padding="400">
              <div className="card-content-wrapper">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    🛠️ Initial Setup
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Get Cart Uplift running on your store:
                  </Text>
                  <BlockStack gap="300">
                    <Text variant="bodyMd" as="p">
                      <strong>1.</strong> Go to your Shopify theme editor
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>2.</strong> Click "App embeds" in the left sidebar
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>3.</strong> Find "Cart Uplift" and toggle it ON
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>4.</strong> Configure your settings in the Settings tab
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>5.</strong> Save your theme changes
                    </Text>
                  </BlockStack>
                  <Text variant="bodyMd" as="p" tone="success">
                    ✅ The app embed must be enabled first before Cart Uplift will work on your store.
                  </Text>
                </BlockStack>
              </div>
              <div className="card-button-wrapper">
                <div className="cartuplift-action-buttons">
                  <a href={themeEditorUrl} target="_top" rel="noopener noreferrer">
                    <Button 
                      variant="primary"
                      size="large"
                    >
                      Open Theme Editor
                    </Button>
                  </a>
                </div>
              </div>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
            <Card padding="400">
              <div className="card-content-wrapper">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    📊 Dashboard
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Monitor your Cart Uplift performance in real-time:
                  </Text>
                  <BlockStack gap="300">
                    <Text variant="bodyMd" as="p">
                      <strong>Revenue Impact:</strong> Track additional revenue generated by Cart Uplift
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>Conversion Metrics:</strong> Monitor cart abandonment reduction and upsell success
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>Product Performance:</strong> See which recommendations drive the most sales
                    </Text>
                    <Text variant="bodyMd" as="p">
                      <strong>Customer Insights:</strong> Understand shopping behavior and preferences
                    </Text>
                  </BlockStack>
                  
                  <div className="spacing-gap"></div>
                  
                  <Text variant="bodyMd" as="p" tone="subdued">
                    💡 <strong>Tip:</strong> Use dashboard insights to optimize your cart settings and maximize ROI.
                  </Text>
                </BlockStack>
              </div>
              <div className="card-button-wrapper">
                <div className="cartuplift-action-buttons">
                  <Link to="/app/dashboard">
                    <Button 
                      variant="primary"
                      size="large"
                    >
                      View Dashboard
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </Grid.Cell>
        </Grid>
      </BlockStack>
    </Page>
  );
}
