import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  Select,
  Text,
  Banner,
  BlockStack,
  List,
  Button,
  InlineStack,
  Badge,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettings } from "../models/settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const settings = await getSettings(shop);
  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  
  const formData = await request.formData();
  const settings = Object.fromEntries(formData);
  
  // Convert string values to appropriate types
  const processedSettings = {
    ...settings,
    enableApp: settings.enableApp === 'true',
    enableStickyCart: settings.enableStickyCart === 'true',
    showOnlyOnCartPage: settings.showOnlyOnCartPage === 'true',
    enableFreeShipping: settings.enableFreeShipping === 'true',
    freeShippingThreshold: Number(settings.freeShippingThreshold) || 100,
    enableRecommendations: settings.enableRecommendations === 'true',
    enableAddons: settings.enableAddons === 'true',
    enableDiscountCode: settings.enableDiscountCode === 'true',
    enableNotes: settings.enableNotes === 'true',
    enableExpressCheckout: settings.enableExpressCheckout === 'true',
    enableAnalytics: settings.enableAnalytics === 'true',
    maxRecommendations: Number(settings.maxRecommendations) || 6,
  };
  
  try {
    await saveSettings(shop, processedSettings);
    return json({ success: true, message: "Settings saved successfully!" });
  } catch (error) {
    console.error("Error saving settings:", error);
    return json({ success: false, message: "Failed to save settings" }, { status: 500 });
  }
};

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  
  const [formSettings, setFormSettings] = useState(settings);

  const handleSubmit = () => {
    const formData = new FormData();
    Object.entries(formSettings).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
    fetcher.submit(formData, { method: "post" });
  };

  const updateSetting = (key: string, value: any) => {
    setFormSettings(prev => ({ ...prev, [key]: value }));
  };

  const cartPositionOptions = [
    { label: "Bottom Right", value: "bottom-right" },
    { label: "Bottom Left", value: "bottom-left" },
    { label: "Top Right", value: "top-right" },
    { label: "Top Left", value: "top-left" },
  ];

  const cartIconOptions = [
    { label: "Shopping Cart", value: "cart" },
    { label: "Shopping Bag", value: "bag" },
    { label: "Basket", value: "basket" },
  ];

  const recommendationLayoutOptions = [
    { label: "Horizontal Row (Card Style)", value: "horizontal" },
    { label: "Vertical Stack", value: "vertical" },
    { label: "Grid Layout", value: "grid" },
  ];

  return (
    <Page
      title="UpCart Settings & Live Preview"
      primaryAction={{
        content: "Save Settings",
        onAction: handleSubmit,
        loading: fetcher.state === "submitting",
      }}
    >
      {fetcher.state === "idle" && fetcher.data && (fetcher.data as any)?.success && (
        <Banner tone="success">
          Settings saved successfully!
        </Banner>
      )}
      
      <Layout>
        {/* Settings Column - Left Side */}
        <Layout.Section>
          <BlockStack gap="500">
            
            {/* Core App Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Core Settings</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable UpCart"
                    checked={formSettings.enableApp}
                    onChange={(value) => updateSetting("enableApp", value)}
                    helpText="Master toggle for the entire cart functionality"
                  />
                  
                  <Checkbox
                    label="Enable Sticky Cart Button"
                    checked={formSettings.enableStickyCart}
                    onChange={(value) => updateSetting("enableStickyCart", value)}
                    helpText="Show floating cart button on all pages"
                  />
                  
                  <Checkbox
                    label="Show only on cart page"
                    checked={formSettings.showOnlyOnCartPage}
                    onChange={(value) => updateSetting("showOnlyOnCartPage", value)}
                    helpText="If enabled, the cart drawer will only appear on the cart page"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Quick Test Actions */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">⚡ Quick Test Actions</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Test your cart drawer functionality quickly with these actions:
                </Text>
                <FormLayout>
                  <InlineStack gap="300">
                    <Button 
                      variant="secondary" 
                      onClick={() => window.open(window.location.origin, '_blank')}
                    >
                      🏪 Open Storefront
                    </Button>
                    <Button 
                      variant="secondary"
                      onClick={() => {
                        if (typeof window !== 'undefined' && window.cartUpliftDrawer) {
                          window.cartUpliftDrawer.openDrawer();
                        } else {
                          alert('Visit your storefront to test the cart drawer');
                        }
                      }}
                    >
                      🛒 Test Cart Open
                    </Button>
                    <Button 
                      variant="secondary"
                      url="/app/dashboard"
                    >
                      📊 View Analytics
                    </Button>
                  </InlineStack>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    💡 Make sure the app embed is enabled in your theme editor first.
                  </Text>
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Free Shipping Settings */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Free Shipping Configuration</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Free Shipping Bar"
                    checked={formSettings.enableFreeShipping}
                    onChange={(value) => updateSetting("enableFreeShipping", value)}
                    helpText="Show progress bar and messages for free shipping threshold"
                  />
                  
                  <TextField
                    label="Free Shipping Threshold ($)"
                    type="number"
                    value={String(formSettings.freeShippingThreshold)}
                    onChange={(value) => updateSetting("freeShippingThreshold", parseInt(value) || 100)}
                    helpText="Minimum order amount for free shipping"
                    disabled={!formSettings.enableFreeShipping}
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Shipping Message"
                    value={formSettings.freeShippingText}
                    onChange={(value) => updateSetting("freeShippingText", value)}
                    helpText="Use {amount} as placeholder for remaining amount"
                    multiline={2}
                    disabled={!formSettings.enableFreeShipping}
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Free Shipping Success Message"
                    value={formSettings.freeShippingAchievedText}
                    onChange={(value) => updateSetting("freeShippingAchievedText", value)}
                    multiline={2}
                    disabled={!formSettings.enableFreeShipping}
                    autoComplete="off"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Cart Position & Appearance */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Cart Position & Styling</Text>
                <FormLayout>
                  <Select
                    label="Cart Position"
                    options={cartPositionOptions}
                    value={formSettings.cartPosition}
                    onChange={(value) => updateSetting("cartPosition", value)}
                  />
                  
                  <Select
                    label="Cart Icon Style"
                    options={cartIconOptions}
                    value={formSettings.cartIcon}
                    onChange={(value) => updateSetting("cartIcon", value)}
                  />
                  
                  <Divider />
                  
                  <TextField
                    label="Background Color"
                    value={formSettings.backgroundColor}
                    onChange={(value) => updateSetting("backgroundColor", value)}
                    helpText="Cart drawer background color (hex format)"
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Text Color"
                    value={formSettings.textColor}
                    onChange={(value) => updateSetting("textColor", value)}
                    helpText="Main text color in cart (hex format)"
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Button Color"
                    value={formSettings.buttonColor}
                    onChange={(value) => updateSetting("buttonColor", value)}
                    helpText="Primary button and accent color (hex format)"
                    autoComplete="off"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Product Recommendations */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Product Recommendations</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Product Recommendations"
                    checked={formSettings.enableRecommendations}
                    onChange={(value) => updateSetting("enableRecommendations", value)}
                    helpText="Show recommended products in cart drawer"
                  />
                  
                  <Select
                    label="Recommendation Layout"
                    options={recommendationLayoutOptions}
                    value={formSettings.recommendationLayout}
                    onChange={(value) => updateSetting("recommendationLayout", value)}
                    disabled={!formSettings.enableRecommendations}
                  />
                  
                  <TextField
                    label="Max Recommendations"
                    type="number"
                    value={String(formSettings.maxRecommendations)}
                    onChange={(value) => updateSetting("maxRecommendations", parseInt(value) || 6)}
                    helpText="Maximum number of products to show (2-8)"
                    disabled={!formSettings.enableRecommendations}
                    autoComplete="off"
                  />
                  
                  <TextField
                    label="Recommendations Title"
                    value={formSettings.recommendationsTitle}
                    onChange={(value) => updateSetting("recommendationsTitle", value)}
                    helpText="Title shown above recommendations"
                    disabled={!formSettings.enableRecommendations}
                    autoComplete="off"
                  />
                </FormLayout>
              </BlockStack>
            </Card>

            {/* Additional Features */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Additional Features</Text>
                <FormLayout>
                  <Checkbox
                    label="Enable Discount Code Field"
                    checked={formSettings.enableDiscountCode}
                    onChange={(value) => updateSetting("enableDiscountCode", value)}
                    helpText="Allow customers to enter discount codes in cart"
                  />
                  
                  <Checkbox
                    label="Enable Order Notes"
                    checked={formSettings.enableNotes}
                    onChange={(value) => updateSetting("enableNotes", value)}
                    helpText="Allow customers to add notes to their order"
                  />
                  
                  <Checkbox
                    label="Enable Express Checkout"
                    checked={formSettings.enableExpressCheckout}
                    onChange={(value) => updateSetting("enableExpressCheckout", value)}
                    helpText="Show express checkout buttons (Apple Pay, Shop Pay, etc.)"
                  />
                  
                  <Checkbox
                    label="Enable Analytics"
                    checked={formSettings.enableAnalytics}
                    onChange={(value) => updateSetting("enableAnalytics", value)}
                    helpText="Track cart interactions and performance metrics"
                  />
                </FormLayout>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
        
        <Layout.Section variant="oneThird">
          <BlockStack gap="500">
            {/* Live Cart Preview - Now prominently positioned on the right */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h3">🛒 Live Cart Preview</Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  See your changes in real-time as you configure settings on the left
                </Text>
                
                {/* Cart Drawer Preview */}
                <div style={{ 
                  border: '2px solid #E5E5E5', 
                  borderRadius: '12px', 
                  backgroundColor: '#FFFFFF', 
                  padding: '20px', 
                  minHeight: '600px',
                  position: 'relative',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  {/* Cart Header */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: '20px',
                    paddingBottom: '16px',
                    borderBottom: '2px solid #F0F0F0'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Shopping Cart</h3>
                    <button style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>×</button>
                  </div>

                  {/* Free Shipping Progress */}
                  {formSettings.enableFreeShipping && (
                    <div style={{ 
                      backgroundColor: formSettings.buttonColor || '#007C5B', 
                      color: 'white', 
                      padding: '16px', 
                      borderRadius: '8px', 
                      marginBottom: '20px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '14px', marginBottom: '10px' }}>
                        🚚 You're ${Math.max(0, formSettings.freeShippingThreshold - 105).toFixed(2)} away from free shipping!
                      </div>
                      <div style={{ 
                        backgroundColor: 'rgba(255,255,255,0.3)', 
                        height: '8px', 
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          backgroundColor: 'white', 
                          height: '100%', 
                          width: `${Math.min(100, (105 / formSettings.freeShippingThreshold) * 100)}%`,
                          borderRadius: '4px',
                          transition: 'width 0.3s ease'
                        }}></div>
                      </div>
                    </div>
                  )}

                  {/* Cart Items */}
                  <div style={{ marginBottom: '24px' }}>
                    {/* Sample Product 1 */}
                    <div style={{ 
                      display: 'flex', 
                      gap: '16px', 
                      padding: '16px 0', 
                      borderBottom: '1px solid #E5E5E5' 
                    }}>
                      <img 
                        src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&h=100&fit=crop&crop=center" 
                        alt="Wireless Headphones" 
                        style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>Premium Wireless Headphones</div>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Color: Matte Black</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: formSettings.buttonColor || '#007C5B' }}>$79.99</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button style={{ width: '28px', height: '28px', border: '1px solid #ccc', background: 'white', borderRadius: '4px' }}>-</button>
                        <span style={{ fontSize: '16px', fontWeight: '500', minWidth: '20px', textAlign: 'center' }}>1</span>
                        <button style={{ width: '28px', height: '28px', border: '1px solid #ccc', background: 'white', borderRadius: '4px' }}>+</button>
                      </div>
                    </div>

                    {/* Sample Product 2 */}
                    <div style={{ 
                      display: 'flex', 
                      gap: '16px', 
                      padding: '16px 0', 
                      borderBottom: '1px solid #E5E5E5' 
                    }}>
                      <img 
                        src="https://images.unsplash.com/photo-1556656793-08538906a9f8?w=100&h=100&fit=crop&crop=center" 
                        alt="Phone Case" 
                        style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>Protective Phone Case</div>
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Size: iPhone 15 Pro</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: formSettings.buttonColor || '#007C5B' }}>$24.99</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button style={{ width: '28px', height: '28px', border: '1px solid #ccc', background: 'white', borderRadius: '4px' }}>-</button>
                        <span style={{ fontSize: '16px', fontWeight: '500', minWidth: '20px', textAlign: 'center' }}>1</span>
                        <button style={{ width: '28px', height: '28px', border: '1px solid #ccc', background: 'white', borderRadius: '4px' }}>+</button>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations Section */}
                  {formSettings.enableRecommendations && (
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#333' }}>
                        ✨ {formSettings.recommendationsTitle}
                      </h4>
                      
                      {/* Debug Info */}
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#666', 
                        fontStyle: 'italic',
                        marginBottom: '16px',
                        padding: '8px',
                        backgroundColor: '#F0F8FF',
                        borderRadius: '4px',
                        border: '1px solid #E1F5FE'
                      }}>
                        Current layout: <strong>{formSettings.recommendationLayout}</strong>
                        {formSettings.recommendationLayout === 'horizontal' && ' (Cards side by side with scrolling)'}
                        {formSettings.recommendationLayout === 'vertical' && ' (Cards stacked vertically)'}
                        {formSettings.recommendationLayout === 'grid' && ' (2x2 grid layout)'}
                      </div>
                      
                      <div style={{ 
                        display: formSettings.recommendationLayout === 'horizontal' ? 'flex' : 
                                formSettings.recommendationLayout === 'grid' ? 'grid' : 'block',
                        gridTemplateColumns: formSettings.recommendationLayout === 'grid' ? 'repeat(2, 1fr)' : 'unset',
                        gap: formSettings.recommendationLayout === 'horizontal' ? '12px' : '16px',
                        overflowX: formSettings.recommendationLayout === 'horizontal' ? 'auto' : 'visible',
                        paddingBottom: formSettings.recommendationLayout === 'horizontal' ? '8px' : '0',
                        border: formSettings.recommendationLayout === 'horizontal' ? '2px dashed #007C5B' : '2px dashed #999',
                        borderRadius: '8px',
                        padding: '12px',
                        backgroundColor: formSettings.recommendationLayout === 'horizontal' ? '#F0FFF4' : '#F9F9F9'
                      }}>
                        {/* Recommendation Product 1 */}
                        <div style={{ 
                          border: '1px solid #E5E5E5', 
                          borderRadius: '8px', 
                          padding: '16px',
                          minWidth: formSettings.recommendationLayout === 'horizontal' ? '200px' : 'auto',
                          maxWidth: formSettings.recommendationLayout === 'horizontal' ? '200px' : 'none',
                          width: formSettings.recommendationLayout === 'grid' ? '100%' : 
                                formSettings.recommendationLayout === 'horizontal' ? '200px' : 'auto',
                          marginBottom: formSettings.recommendationLayout === 'vertical' ? '16px' : '0',
                          backgroundColor: '#FAFAFA',
                          flexShrink: formSettings.recommendationLayout === 'horizontal' ? 0 : 1
                        }}>
                          <img 
                            src="https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=150&h=100&fit=crop&crop=center" 
                            alt="Bluetooth Speaker" 
                            style={{ 
                              width: '100%', 
                              height: formSettings.recommendationLayout === 'horizontal' ? '120px' : '100px', 
                              objectFit: 'cover', 
                              borderRadius: '6px', 
                              marginBottom: '12px' 
                            }}
                          />
                          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>Bluetooth Speaker</div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: formSettings.buttonColor || '#007C5B', marginBottom: '8px' }}>$39.99</div>
                          <button style={{ 
                            width: '100%', 
                            padding: '8px', 
                            backgroundColor: formSettings.buttonColor || '#007C5B', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}>
                            Add to Cart
                          </button>
                        </div>

                        {/* Recommendation Product 2 */}
                        <div style={{ 
                          border: '1px solid #E5E5E5', 
                          borderRadius: '8px', 
                          padding: '16px',
                          minWidth: formSettings.recommendationLayout === 'horizontal' ? '200px' : 'auto',
                          maxWidth: formSettings.recommendationLayout === 'horizontal' ? '200px' : 'none',
                          width: formSettings.recommendationLayout === 'grid' ? '100%' : 
                                formSettings.recommendationLayout === 'horizontal' ? '200px' : 'auto',
                          marginBottom: formSettings.recommendationLayout === 'vertical' ? '16px' : '0',
                          backgroundColor: '#FAFAFA',
                          flexShrink: formSettings.recommendationLayout === 'horizontal' ? 0 : 1
                        }}>
                          <img 
                            src="https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=150&h=100&fit=crop&crop=center" 
                            alt="Wireless Charger" 
                            style={{ 
                              width: '100%', 
                              height: formSettings.recommendationLayout === 'horizontal' ? '120px' : '100px', 
                              objectFit: 'cover', 
                              borderRadius: '6px', 
                              marginBottom: '12px' 
                            }}
                          />
                          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>Wireless Charger</div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: formSettings.buttonColor || '#007C5B', marginBottom: '8px' }}>$29.99</div>
                          <button style={{ 
                            width: '100%', 
                            padding: '8px', 
                            backgroundColor: formSettings.buttonColor || '#007C5B', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}>
                            Add to Cart
                          </button>
                        </div>

                        {/* Third Recommendation Product - Only for horizontal/grid to show difference */}
                        {(formSettings.recommendationLayout === 'horizontal' || formSettings.recommendationLayout === 'grid') && (
                          <div style={{ 
                            border: '1px solid #E5E5E5', 
                            borderRadius: '8px', 
                            padding: '16px',
                            minWidth: formSettings.recommendationLayout === 'horizontal' ? '200px' : 'auto',
                            maxWidth: formSettings.recommendationLayout === 'horizontal' ? '200px' : 'none',
                            width: formSettings.recommendationLayout === 'grid' ? '100%' : 
                                  formSettings.recommendationLayout === 'horizontal' ? '200px' : 'auto',
                            backgroundColor: '#FAFAFA',
                            flexShrink: formSettings.recommendationLayout === 'horizontal' ? 0 : 1
                          }}>
                            <img 
                              src="https://images.unsplash.com/photo-1583394838336-acd977736f90?w=150&h=100&fit=crop&crop=center" 
                              alt="Smartwatch" 
                              style={{ 
                                width: '100%', 
                                height: formSettings.recommendationLayout === 'horizontal' ? '120px' : '100px', 
                                objectFit: 'cover', 
                                borderRadius: '6px', 
                                marginBottom: '12px' 
                              }}
                            />
                            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>Smartwatch</div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: formSettings.buttonColor || '#007C5B', marginBottom: '8px' }}>$199.99</div>
                            <button style={{ 
                              width: '100%', 
                              padding: '8px', 
                              backgroundColor: formSettings.buttonColor || '#007C5B', 
                              color: 'white', 
                              border: 'none', 
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: 'pointer'
                            }}>
                              Add to Cart
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cart Total */}
                  <div style={{ 
                    paddingTop: '20px', 
                    borderTop: '2px solid #E5E5E5' 
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      fontSize: '20px', 
                      fontWeight: '600',
                      marginBottom: '20px',
                      color: '#333'
                    }}>
                      <span>Total:</span>
                      <span>${(79.99 + 24.99).toFixed(2)}</span>
                    </div>
                    
                    <button style={{ 
                      width: '100%', 
                      padding: '18px', 
                      backgroundColor: formSettings.buttonColor || '#007C5B', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '8px',
                      fontSize: '18px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Checkout • ${(79.99 + 24.99).toFixed(2)}
                    </button>
                  </div>
                </div>

                <Text variant="bodyMd" as="p" tone="subdued">
                  💡 This preview updates in real-time as you change settings on the left.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
