import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Checkbox,
  Select,
  Text,
  Banner,
  BlockStack,
  Button,
  InlineStack,
  Divider,
} from "@shopify/polaris";
import { DeleteIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getSettings, saveSettings } from "../models/settings.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const settings = await getSettings(shop);
  
  // Fetch products for the product selector
  const productsResponse = await admin.graphql(`
    query GetProducts($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            title
            handle
            images(first: 1) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            variants(first: 5) {
              edges {
                node {
                  id
                  title
                  price
                  available
                }
              }
            }
          }
        }
      }
    }
  `, {
    variables: {
      first: 50, // Load first 50 products for the selector
    },
  });

  const productsData = await productsResponse.json();
  const products = productsData.data?.products?.edges?.map((edge: any) => ({
    id: edge.node.id.replace('gid://shopify/Product/', ''),
    title: edge.node.title,
    handle: edge.node.handle,
    image: edge.node.images.edges[0]?.node?.url || null,
    variants: edge.node.variants.edges.map((variantEdge: any) => ({
      id: variantEdge.node.id.replace('gid://shopify/ProductVariant/', ''),
      title: variantEdge.node.title,
      price: variantEdge.node.price,
      available: variantEdge.node.available,
    }))
  })) || [];

  return json({ settings, products });
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
    complementDetectionMode: settings.complementDetectionMode || 'automatic',
    // Parse the visual rule builder data back to JSON for storage
    manualComplementRules: settings.manualComplementRules || '[]',
    autoOpenCart: settings.autoOpenCart === 'true',
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
  const { settings, products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  
  const [formSettings, setFormSettings] = useState(settings);
  const [selectedTab, setSelectedTab] = useState(0);
  const [manualRules, setManualRules] = useState(() => {
    try {
      return JSON.parse((settings as any).manualComplementRules || '[]');
    } catch {
      return [];
    }
  });

  // Product selector state
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [currentRuleIndex, setCurrentRuleIndex] = useState(-1);
  const [isSelectingComplements, setIsSelectingComplements] = useState(false);

  const handleSubmit = () => {
    const formData = new FormData();
    Object.entries(formSettings).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
    // Add the visual rules as JSON string
    formData.append('manualComplementRules', JSON.stringify(manualRules));
    fetcher.submit(formData, { method: "post" });
  };

  const updateSetting = (key: string, value: any) => {
    setFormSettings(prev => ({ ...prev, [key]: value }));
  };

  // Filter products based on search term
  const filteredProducts = products.filter((product: any) =>
    product.title.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  // Add new rule
  const addNewRule = () => {
    setCurrentRuleIndex(manualRules.length);
    setIsSelectingComplements(false);
    setShowProductSelector(true);
    setProductSearchTerm('');
  };

  // Add complement to existing rule
  const addComplement = (ruleIndex: number) => {
    setCurrentRuleIndex(ruleIndex);
    setIsSelectingComplements(true);
    setShowProductSelector(true);
    setProductSearchTerm('');
  };

  // Handle product selection
  const handleProductSelect = (product: any) => {
    if (isSelectingComplements) {
      // Adding complement to existing rule
      const updatedRules = [...manualRules];
      if (!updatedRules[currentRuleIndex].complements.find((c: any) => c.id === product.id)) {
        updatedRules[currentRuleIndex].complements.push({
          id: product.id,
          title: product.title,
          image: product.image
        });
        setManualRules(updatedRules);
      }
    } else {
      // Creating new rule
      const newRule = {
        id: Date.now(),
        product: {
          id: product.id,
          title: product.title,
          image: product.image
        },
        complements: []
      };
      setManualRules([...manualRules, newRule]);
    }
    setShowProductSelector(false);
  };

  // Remove rule
  const removeRule = (ruleIndex: number) => {
    setManualRules(manualRules.filter((_: any, index: number) => index !== ruleIndex));
  };

  // Remove complement
  const removeComplement = (ruleIndex: number, complementIndex: number) => {
    const updatedRules = [...manualRules];
    updatedRules[ruleIndex].complements = updatedRules[ruleIndex].complements.filter(
      (_: any, index: number) => index !== complementIndex
    );
    setManualRules(updatedRules);
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

  const complementDetectionModeOptions = [
    { label: "🤖 Automatic (AI-Powered) - 87% accuracy", value: "automatic" },
    { label: "📝 Manual Rules Only", value: "manual" },
    { label: "🎯 Hybrid (Auto + Overrides) ✓ Recommended", value: "hybrid" },
  ];

  const tabs = [
    {
      id: 'cart-display',
      content: '🎨 Cart Display Settings',
    },
    {
      id: 'recommendations',
      content: '🤖 Smart Recommendations',
    },
  ];

  return (
    <Page
      title="UpCart Settings"
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

      {/* Custom CSS for tabs */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .cart-uplift-tabs {
            border-bottom: 1px solid #E1E5E9;
            margin-bottom: 24px;
          }
          .cart-uplift-tab-buttons {
            display: flex;
            gap: 0;
          }
          .cart-uplift-tab-button {
            padding: 16px 24px;
            border: none;
            background: transparent;
            border-bottom: 2px solid transparent;
            cursor: pointer;
            font-size: 14px;
            font-weight: 400;
            color: #6D7175;
            transition: all 0.2s;
          }
          .cart-uplift-tab-button:hover {
            background: #F6F6F7;
          }
          .cart-uplift-tab-button.active {
            background: #F6F6F7;
            border-bottom-color: #5C5F62;
            font-weight: 600;
            color: #202223;
          }
          .visual-rule-card {
            border: 1px solid #E1E5E9;
            border-radius: 8px;
            padding: 16px;
            background-color: #FAFBFB;
            margin-bottom: 16px;
          }
          .product-card {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background-color: #fff;
            border-radius: 6px;
            border: 1px solid #E1E5E9;
            margin-top: 8px;
          }
          .complement-tag {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background-color: #fff;
            border: 1px solid #E1E5E9;
            border-radius: 20px;
            font-size: 14px;
            margin: 4px;
          }
          .product-selector-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .product-selector-content {
            background-color: white;
            border-radius: 12px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          }
          .product-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 12px;
            padding: 16px;
            max-height: 400px;
            overflow-y: auto;
          }
          .product-grid-item {
            border: 1px solid #E1E5E9;
            border-radius: 8px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.2s;
            background-color: #fff;
          }
          .product-grid-item:hover {
            border-color: #5C5F62;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }
        `
      }} />

      <Card>
        <div className="cart-uplift-tabs">
          <div className="cart-uplift-tab-buttons">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(index)}
                className={`cart-uplift-tab-button ${selectedTab === index ? 'active' : ''}`}
              >
                {tab.content}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          {selectedTab === 0 && (
            <BlockStack gap="500">
              {/* App Enable/Disable */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2">🛒 Cart Drawer Control</Text>
                  <Checkbox
                    label="Enable UpCart Drawer"
                    checked={formSettings.enableApp}
                    onChange={(checked) => updateSetting("enableApp", checked)}
                    helpText="Turn on/off the cart drawer functionality"
                  />
                  
                  {formSettings.enableApp && (
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        if (typeof window !== 'undefined' && (window as any).cartUpliftDrawer) {
                          (window as any).cartUpliftDrawer.openDrawer();
                        } else {
                          alert('Visit your storefront to test the cart drawer');
                        }
                      }}
                    >
                      🔍 Test Cart Drawer
                    </Button>
                  )}
                </BlockStack>
              </Card>

              {/* Cart Position & Styling */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2">🎨 Cart Appearance</Text>
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
                    
                    <TextField
                      label="Button Color"
                      value={formSettings.buttonColor}
                      onChange={(value) => updateSetting("buttonColor", value)}
                      helpText="Hex color code (e.g., #FF6B6B)"
                      autoComplete="off"
                    />
                    
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
                      helpText="Main text color (hex format)"
                      autoComplete="off"
                    />
                  </FormLayout>
                </BlockStack>
              </Card>

              {/* Cart Features */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2">⚡ Cart Features</Text>
                  <FormLayout>
                    <Checkbox
                      label="Enable Sticky Cart"
                      checked={formSettings.enableStickyCart}
                      onChange={(checked) => updateSetting("enableStickyCart", checked)}
                      helpText="Show floating cart icon on all pages"
                    />
                    
                    <Checkbox
                      label="Auto-open Cart After Add"
                      checked={(formSettings as any).autoOpenCart}
                      onChange={(checked) => updateSetting("autoOpenCart", checked)}
                      helpText="Automatically open cart when products are added"
                    />
                    
                    <Checkbox
                      label="Enable Discount Codes"
                      checked={formSettings.enableDiscountCode}
                      onChange={(checked) => updateSetting("enableDiscountCode", checked)}
                    />
                    
                    <Checkbox
                      label="Enable Order Notes"
                      checked={formSettings.enableNotes}
                      onChange={(checked) => updateSetting("enableNotes", checked)}
                    />
                    
                    <Checkbox
                      label="Enable Express Checkout"
                      checked={formSettings.enableExpressCheckout}
                      onChange={(checked) => updateSetting("enableExpressCheckout", checked)}
                      helpText="Show PayPal, Shop Pay buttons"
                    />
                  </FormLayout>
                </BlockStack>
              </Card>

              {/* Free Shipping */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2">🚚 Free Shipping Progress</Text>
                  <FormLayout>
                    <Checkbox
                      label="Enable Free Shipping Progress Bar"
                      checked={formSettings.enableFreeShipping}
                      onChange={(checked) => updateSetting("enableFreeShipping", checked)}
                      helpText="Show progress towards free shipping threshold"
                    />
                    
                    <TextField
                      label="Free Shipping Threshold"
                      type="number"
                      value={formSettings.freeShippingThreshold}
                      onChange={(value) => updateSetting("freeShippingThreshold", value)}
                      helpText="Minimum order value for free shipping"
                      disabled={!formSettings.enableFreeShipping}
                      autoComplete="off"
                    />
                    
                    <TextField
                      label="Free Shipping Progress Message"
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

              {/* Recommendation Display */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2">📱 Recommendation Display</Text>
                  <FormLayout>
                    <Checkbox
                      label="Enable Product Recommendations"
                      checked={formSettings.enableRecommendations}
                      onChange={(checked) => updateSetting("enableRecommendations", checked)}
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
                      label="Recommendations Title"
                      value={formSettings.recommendationsTitle}
                      onChange={(value) => updateSetting("recommendationsTitle", value)}
                      disabled={!formSettings.enableRecommendations}
                      autoComplete="off"
                    />
                    
                    <TextField
                      label="Max Recommendations"
                      type="number"
                      value={formSettings.maxRecommendations}
                      onChange={(value) => updateSetting("maxRecommendations", value)}
                      helpText="Maximum number of products to show (1-10)"
                      disabled={!formSettings.enableRecommendations}
                      autoComplete="off"
                    />
                  </FormLayout>
                </BlockStack>
              </Card>
            </BlockStack>
          )}

          {selectedTab === 1 && (
            <BlockStack gap="500">
              {/* AI Detection Mode */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h2">🤖 Smart Recommendation Engine</Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Our AI analyzes 300+ product patterns to automatically suggest relevant complements with 87% accuracy
                  </Text>
                  
                  <Select
                    label="Detection Mode"
                    options={complementDetectionModeOptions}
                    value={(formSettings as any).complementDetectionMode || 'automatic'}
                    onChange={(value) => updateSetting("complementDetectionMode", value)}
                  />

                  {((formSettings as any).complementDetectionMode || 'automatic') === 'automatic' && (
                    <BlockStack gap="300">
                      <Text variant="headingMd" as="h3">🎯 AI Detection Preview</Text>
                      <div style={{ 
                        background: '#F6F6F7', 
                        padding: '16px', 
                        borderRadius: '8px',
                        border: '1px solid #E1E5E9'
                      }}>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          <strong>Examples of AI-detected complements:</strong>
                        </Text>
                        <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '8px', paddingLeft: '20px' }}>
                          <div>• Running Shoes → Socks, Insoles, Running Shorts</div>
                          <div>• Laptop → Case, Mouse, Screen Protector</div>
                          <div>• Winter Coat → Gloves, Scarf, Hat</div>
                          <div>• Smartphone → Case, Screen Protector, Charger</div>
                        </div>
                      </div>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>

              {/* Manual Rules - Visual Product Selector */}
              {(((formSettings as any).complementDetectionMode || 'automatic') === 'manual' || 
                ((formSettings as any).complementDetectionMode || 'automatic') === 'hybrid') && (
                <Card>
                  <BlockStack gap="400">
                    <Text variant="headingLg" as="h2">📝 Manual Override Rules</Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      Create custom product complement rules. Click products to build your own recommendation logic - no coding required!
                    </Text>

                    {/* Add New Rule Button */}
                    <Button onClick={addNewRule} variant="primary">
                      + Add New Rule
                    </Button>

                    {/* Existing Rules */}
                    {manualRules.length > 0 && (
                      <BlockStack gap="400">
                        {manualRules.map((rule: any, ruleIndex: number) => (
                          <div key={rule.id} className="visual-rule-card">
                            <BlockStack gap="300">
                              <InlineStack gap="300" align="space-between">
                                <Text variant="headingMd" as="h4">
                                  Rule {ruleIndex + 1}
                                </Text>
                                <Button
                                  variant="tertiary"
                                  tone="critical"
                                  onClick={() => removeRule(ruleIndex)}
                                  icon={DeleteIcon}
                                >
                                  Remove Rule
                                </Button>
                              </InlineStack>

                              {/* Main Product */}
                              <div>
                                <Text variant="headingSm" as="h5" tone="subdued">
                                  When customer adds:
                                </Text>
                                <div className="product-card">
                                  {rule.product.image ? (
                                    <img 
                                      src={rule.product.image} 
                                      alt={rule.product.title}
                                      style={{ 
                                        width: '40px', 
                                        height: '40px', 
                                        objectFit: 'cover', 
                                        borderRadius: '4px' 
                                      }}
                                    />
                                  ) : (
                                    <div style={{
                                      width: '40px',
                                      height: '40px',
                                      backgroundColor: '#F6F6F7',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '12px',
                                      color: '#8C9196'
                                    }}>
                                      📦
                                    </div>
                                  )}
                                  <Text variant="bodyMd" as="p">
                                    {rule.product.title}
                                  </Text>
                                </div>
                              </div>

                              {/* Complements */}
                              <div>
                                <InlineStack gap="200" align="space-between">
                                  <Text variant="headingSm" as="h5" tone="subdued">
                                    Suggest these complements:
                                  </Text>
                                  <Button
                                    variant="secondary"
                                    size="slim"
                                    onClick={() => addComplement(ruleIndex)}
                                  >
                                    + Add Product
                                  </Button>
                                </InlineStack>

                                {rule.complements.length > 0 ? (
                                  <div style={{ 
                                    display: 'flex', 
                                    flexWrap: 'wrap', 
                                    gap: '8px', 
                                    marginTop: '8px' 
                                  }}>
                                    {rule.complements.map((complement: any, compIndex: number) => (
                                      <div key={complement.id} className="complement-tag">
                                        {complement.image ? (
                                          <img 
                                            src={complement.image} 
                                            alt={complement.title}
                                            style={{ 
                                              width: '24px', 
                                              height: '24px', 
                                              objectFit: 'cover', 
                                              borderRadius: '50%' 
                                            }}
                                          />
                                        ) : (
                                          <div style={{
                                            width: '24px',
                                            height: '24px',
                                            backgroundColor: '#F6F6F7',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '10px'
                                          }}>
                                            📦
                                          </div>
                                        )}
                                        <span>{complement.title}</span>
                                        <button
                                          onClick={() => removeComplement(ruleIndex, compIndex)}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#DC2626',
                                            padding: '2px',
                                            marginLeft: '4px'
                                          }}
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{
                                    padding: '24px',
                                    textAlign: 'center',
                                    color: '#8C9196',
                                    backgroundColor: '#fff',
                                    border: '2px dashed #E1E5E9',
                                    borderRadius: '8px',
                                    marginTop: '8px'
                                  }}>
                                    Click "Add Product" to select complement products
                                  </div>
                                )}
                              </div>
                            </BlockStack>
                          </div>
                        ))}
                      </BlockStack>
                    )}

                    {manualRules.length === 0 && (
                      <div style={{
                        padding: '48px',
                        textAlign: 'center',
                        backgroundColor: '#FAFBFB',
                        border: '2px dashed #E1E5E9',
                        borderRadius: '12px'
                      }}>
                        <Text variant="headingMd" as="h3">
                          📝 No Manual Rules Yet
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          Create custom rules to control which products appear as recommendations
                        </Text>
                        <div style={{ marginTop: '16px' }}>
                          <Button onClick={addNewRule} variant="primary">
                            Create Your First Rule
                          </Button>
                        </div>
                      </div>
                    )}
                  </BlockStack>
                </Card>
              )}
            </BlockStack>
          )}
        </div>
      </Card>

      {/* Product Selector Modal */}
      {showProductSelector && (
        <div className="product-selector-modal" onClick={() => setShowProductSelector(false)}>
          <div className="product-selector-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid #E1E5E9' }}>
              <Text variant="headingLg" as="h2">
                {isSelectingComplements ? 'Select Complement Products' : 'Select Main Product'}
              </Text>
              <div style={{ marginTop: '12px' }}>
                <TextField
                  placeholder="Search products..."
                  value={productSearchTerm}
                  onChange={setProductSearchTerm}
                  autoComplete="off"
                />
              </div>
            </div>
            
            <div className="product-grid">
              {filteredProducts.slice(0, 20).map((product: any) => (
                <div
                  key={product.id}
                  onClick={() => handleProductSelect(product)}
                  className="product-grid-item"
                >
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.title}
                      style={{
                        width: '100%',
                        height: '120px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        marginBottom: '8px'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '120px',
                      backgroundColor: '#F6F6F7',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px'
                    }}>
                      📦
                    </div>
                  )}
                  <Text variant="bodyMd" as="p" truncate>
                    {product.title}
                  </Text>
                </div>
              ))}
              
              {filteredProducts.length === 0 && (
                <div style={{ 
                  gridColumn: '1 / -1',
                  textAlign: 'center', 
                  padding: '48px', 
                  color: '#8C9196' 
                }}>
                  No products found matching "{productSearchTerm}"
                </div>
              )}
            </div>

            <div style={{ 
              padding: '16px 24px', 
              borderTop: '1px solid #E1E5E9',
              textAlign: 'right'
            }}>
              <Button onClick={() => setShowProductSelector(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
