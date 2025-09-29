import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, useRevalidator } from "@remix-run/react";
import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  DataTable,
  Modal,
  TextField,
  Select,
  FormLayout,
  ButtonGroup,
  Banner,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Checkbox,
  EmptyState,
  Spinner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { PlusIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

interface Bundle {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  discountType: string;
  discountValue: number;
  minProducts: number;
  totalPurchases: number;
  totalRevenue: number;
  createdAt: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const loadProducts = url.searchParams.get("loadProducts") === "true";

  try {
  const bundles = await (prisma as any).bundle.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: "desc" },
    });

    let products: any[] = [];

    if (loadProducts) {
      const productQuery = `
        query getProducts($first: Int!) {
          products(first: $first) {
            edges {
              node {
                id
                title
                handle
                featuredImage { url }
                variants(first: 1) { edges { node { id price } } }
              }
            }
          }
        }
      `;

      const productResponse = await admin.graphql(productQuery, {
        variables: { first: 50 },
      });

      if (!productResponse.ok) {
        const text = await productResponse.text();
        console.warn("Admin GraphQL products error:", productResponse.status, text);
        return json({ success: false, bundles, products: [], error: `Products request failed (${productResponse.status})` }, { status: 502 });
      }
      const productData = await productResponse.json();
      const gqlErrors = (productData as any)?.errors;
      if (gqlErrors) {
        console.warn("Admin GraphQL products errors:", gqlErrors);
        return json({ success: false, bundles, products: [], error: "Products request returned errors" }, { status: 502 });
      }
      if (productData.data?.products?.edges) {
        products = productData.data.products.edges.map((edge: any) => edge.node);
      }
    }

    return json({ success: true, bundles, products });
  } catch (error) {
    console.error("Bundle loader error:", error);
    return json({ success: false, bundles: [], products: [], error: "Failed to load bundles" }, { status: 500 });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("action");

  try {
    if (actionType === "create-bundle") {
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const type = formData.get("type") as string;
      const discountType = formData.get("discountType") as string;
      const discountValue = parseFloat(formData.get("discountValue") as string);
      const minProducts = parseInt(formData.get("minProducts") as string) || 2;
      const productIds = (formData.get("productIds") as string) || "[]";

      if (!name || !type || discountValue < 0) {
        return json({ success: false, error: "Invalid bundle data" }, { status: 400 });
      }

  const bundle = await (prisma as any).bundle.create({
        data: {
          shop: session.shop,
          name,
          description,
          type,
          discountType,
          discountValue,
          minProducts,
          productIds,
          status: "draft",
        },
      });

      return json({ success: true, bundle });
    }

    if (actionType === "toggle-status") {
      const bundleId = formData.get("bundleId") as string;
      const status = formData.get("status") as string;

  const bundle = await (prisma as any).bundle.update({
        where: { id: bundleId, shop: session.shop },
        data: { status },
      });

      return json({ success: true, bundle });
    }

    if (actionType === "delete-bundle") {
      const bundleId = formData.get("bundleId") as string;

  await (prisma as any).bundle.delete({
        where: { id: bundleId, shop: session.shop },
      });

      return json({ success: true, message: "Bundle deleted successfully" });
    }

    return json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Bundle action error:", error);
    return json({ success: false, error: "Failed to perform action" }, { status: 500 });
  }
};

export default function BundleManagement() {
  const { bundles = [], products = [] } = useLoaderData<typeof loader>();
  const productFetcher = useFetcher();
  const mutateFetcher = useFetcher();
  const { revalidate } = useRevalidator();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productList, setProductList] = useState<any[]>(products);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);

  const [bundleForm, setBundleForm] = useState({
    name: "",
    description: "",
    type: "manual",
    discountType: "percentage",
    discountValue: 10,
    minProducts: 2,
    selectedProducts: [] as string[],
  });

  const bundleTypeOptions = [
    { label: "Manual Bundle (Select specific products)", value: "manual" },
    { label: "Category Bundle (All products from categories)", value: "category" },
    { label: "AI Suggested Bundle (Smart recommendations)", value: "ai_suggested" },
  ];

  const discountTypeOptions = [
    { label: "Percentage Off", value: "percentage" },
    { label: "Fixed Amount Off", value: "fixed" },
  ];

  const bundleTableRows = bundles.map((bundle: Bundle) => [
    bundle.name,
    bundle.type === "manual" ? "Manual" : bundle.type === "category" ? "Category" : "AI Suggested",
    <Badge tone={bundle.status === "active" ? "success" : bundle.status === "paused" ? "warning" : "info"} key={bundle.id}>
      {bundle.status === "active" ? "Active" : bundle.status === "paused" ? "Paused" : "Draft"}
    </Badge>,
    bundle.discountType === "percentage" ? `${bundle.discountValue}% off` : `$${bundle.discountValue} off`,
    (bundle.totalPurchases as any)?.toLocaleString?.() || "0",
    `$${(bundle.totalRevenue || 0).toFixed(2)}`,
    <ButtonGroup key={bundle.id}>
      <Button
        size="micro"
        variant={bundle.status === "active" ? "secondary" : "primary"}
        onClick={() => {
          const formData = new FormData();
          formData.append("action", "toggle-status");
          formData.append("bundleId", bundle.id);
          formData.append("status", bundle.status === "active" ? "paused" : "active");
          mutateFetcher.submit(formData, { method: "post" });
        }}
      >
        {bundle.status === "active" ? "Pause" : "Activate"}
      </Button>
      <Button
        size="micro"
        tone="critical"
        onClick={() => {
          if (confirm("Are you sure you want to delete this bundle?")) {
            const formData = new FormData();
            formData.append("action", "delete-bundle");
            formData.append("bundleId", bundle.id);
            mutateFetcher.submit(formData, { method: "post" });
          }
        }}
      >
        Delete
      </Button>
    </ButtonGroup>,
  ]);

  const loadProducts = () => {
    if (!loadingProducts && productList.length === 0 && productFetcher.state === "idle") {
      setProductLoadError(null);
      setLoadingProducts(true);
      productFetcher.load("/admin/bundle-management-simple?loadProducts=true");
    }
  };

  // Auto-load products when opening the modal with Manual type selected
  useEffect(() => {
    if (showCreateModal && bundleForm.type === "manual" && productList.length === 0) {
      loadProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreateModal, bundleForm.type]);

  useEffect(() => {
    if (productFetcher.state === "idle") {
      const data: any = productFetcher.data;
      // End of a load cycle – stop spinner
      if (loadingProducts) setLoadingProducts(false);
      if (data && typeof data === "object") {
        if (data.success && Array.isArray(data.products)) {
          setProductList(data.products);
          setProductLoadError(null);
        } else {
          setProductLoadError(data.error || "Failed to load products");
        }
      } else if (loadingProducts) {
        // No data returned (likely non-200); show a generic error
        setProductLoadError("Failed to load products");
      }
    }
  }, [productFetcher.state, productFetcher.data, loadingProducts]);

  useEffect(() => {
    if (mutateFetcher.state === "idle" && mutateFetcher.data) {
      const data: any = mutateFetcher.data;
      if (data?.success) {
        setShowCreateModal(false);
        setBundleForm({
          name: "",
          description: "",
          type: "manual",
          discountType: "percentage",
          discountValue: 10,
          minProducts: 2,
          selectedProducts: [],
        });
        revalidate();
      }
    }
  }, [mutateFetcher.state, mutateFetcher.data, revalidate]);

  const handleSubmit = () => {
    if (!bundleForm.name.trim()) {
      alert("Please enter a bundle name");
      return;
    }

    const formData = new FormData();
    formData.append("action", "create-bundle");
    formData.append("name", bundleForm.name);
    formData.append("description", bundleForm.description);
    formData.append("type", bundleForm.type);
    formData.append("discountType", bundleForm.discountType);
    formData.append("discountValue", bundleForm.discountValue.toString());
    formData.append("minProducts", bundleForm.minProducts.toString());
    formData.append("productIds", JSON.stringify(bundleForm.selectedProducts));

    mutateFetcher.submit(formData, { method: "post" });
  };

  return (
    <Page
      title="Bundle Management"
      subtitle="Create and manage product bundles with AI recommendations and custom discounts"
      primaryAction={
        <Button
          variant="primary"
          icon={PlusIcon}
          onClick={() => {
            setBundleForm({
              name: "",
              description: "",
              type: "manual",
              discountType: "percentage",
              discountValue: 10,
              minProducts: 2,
              selectedProducts: [],
            });
            setShowCreateModal(true);
          }}
        >
          Create Bundle
        </Button>
      }
    >
      <TitleBar title="Bundle Management" />

      <Layout>
        <Layout.Section>
          {bundles.length === 0 ? (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Get Started with Bundles
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Create your first bundle to start increasing average order value through strategic product combinations.
                </Text>
                <Banner>
                  <Text as="p" variant="bodyMd">
                    <strong>Bundle Types:</strong>
                    <br />• <strong>Manual:</strong> Handpick specific products
                    <br />• <strong>Category:</strong> Auto-bundle from categories
                    <br />• <strong>AI Suggested:</strong> Smart recommendations with approval workflow
                  </Text>
                </Banner>
              </BlockStack>
            </Card>
          ) : (
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    All Bundles
                  </Text>
                  <Badge tone="info">{`${bundles.length} Bundle${bundles.length === 1 ? "" : "s"}`}</Badge>
                </InlineStack>

                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "numeric", "numeric", "text"]}
                  headings={["Bundle Name", "Type", "Status", "Discount", "Purchases", "Revenue", "Actions"]}
                  rows={bundleTableRows}
                />
              </BlockStack>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                🎯 Bundle Strategy
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Bundles work seamlessly with your theme embed to show customers relevant product combinations at the perfect moment.
              </Text>
              <BlockStack gap="200">
                <Banner tone="info">
                  <Text as="p" variant="bodySm">
                    <strong>Backend:</strong> Complex logic, product selection, discount rules, approval workflows
                  </Text>
                </Banner>
                <Banner tone="success">
                  <Text as="p" variant="bodySm">
                    <strong>Theme Embed:</strong> Smart display, customer interaction, cart integration
                  </Text>
                </Banner>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                💡 Best Practices
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                • Start with 10-15% discounts
                <br />• Use AI bundles for cross-sell discovery
                <br />• Test manual bundles for key products
                <br />• Monitor performance in Dashboard
                <br />• A/B test different discount rates
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
        }}
        title="Create New Bundle"
        primaryAction={{
          content: "Create Bundle",
          disabled: !bundleForm.name.trim() || mutateFetcher.state !== "idle",
          onAction: handleSubmit,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setShowCreateModal(false);
            },
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Bundle Name"
              value={bundleForm.name}
              onChange={(value) => setBundleForm({ ...bundleForm, name: value })}
              placeholder="e.g., Summer Beach Essentials"
              autoComplete="off"
              helpText="This name will be shown to customers"
            />

            <TextField
              label="Description (Optional)"
              value={bundleForm.description}
              onChange={(value) => setBundleForm({ ...bundleForm, description: value })}
              placeholder="Brief description of the bundle"
              multiline={2}
              autoComplete="off"
            />

            <Select
              label="Bundle Type"
              options={bundleTypeOptions}
              value={bundleForm.type}
              onChange={(value) => {
                setBundleForm({ ...bundleForm, type: value });
                if (value === "manual" && productList.length === 0) {
                  loadProducts();
                }
              }}
              helpText="Choose how products are selected for this bundle"
            />

            {bundleForm.type === "manual" && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">
                    Select Products for Bundle
                  </Text>
                  {loadingProducts || productFetcher.state !== "idle" ? (
                    <BlockStack align="center" gap="300">
                      <Spinner size="large" />
                      <Text as="p">Loading products...</Text>
                    </BlockStack>
                  ) : productLoadError ? (
                    <Banner tone="critical" title="Failed to load products">
                      <p>{productLoadError}</p>
                    </Banner>
                  ) : productList.length === 0 ? (
                    <EmptyState
                      heading="No products found"
                      action={{
                        content: "Load Products",
                        onAction: loadProducts,
                      }}
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Click to load your store's products for bundle selection.</p>
                    </EmptyState>
                  ) : (
                    <ResourceList
                      items={productList.slice(0, 25)}
                      renderItem={(product: any) => (
                        <ResourceItem
                          id={product.id}
                          onClick={() => {
                            const isSelected = bundleForm.selectedProducts.includes(product.id);
                            if (isSelected) {
                              setBundleForm({
                                ...bundleForm,
                                selectedProducts: bundleForm.selectedProducts.filter((id) => id !== product.id),
                              });
                            } else {
                              setBundleForm({
                                ...bundleForm,
                                selectedProducts: [...bundleForm.selectedProducts, product.id],
                              });
                            }
                          }}
                        >
                          <InlineStack gap="300">
                            <Checkbox label="" checked={bundleForm.selectedProducts.includes(product.id)} onChange={() => {}} />
                            <Thumbnail source={product.featuredImage?.url || ""} alt={product.title} size="small" />
                            <BlockStack gap="100">
                              <Text as="h3" variant="bodyMd">
                                {product.title}
                              </Text>
                              <Text as="p" variant="bodySm" tone="subdued">
                                ${product.variants.edges[0]?.node.price || "0.00"}
                              </Text>
                            </BlockStack>
                          </InlineStack>
                        </ResourceItem>
                      )}
                    />
                  )}

                  {bundleForm.selectedProducts.length > 0 && (
                    <Banner tone="success">
                      <Text as="p" variant="bodyMd">
                        {bundleForm.selectedProducts.length} product{bundleForm.selectedProducts.length === 1 ? "" : "s"} selected for this bundle
                      </Text>
                    </Banner>
                  )}
                </BlockStack>
              </Card>
            )}

            <InlineStack gap="400">
              <Select
                label="Discount Type"
                options={discountTypeOptions}
                value={bundleForm.discountType}
                onChange={(value) => setBundleForm({ ...bundleForm, discountType: value })}
              />
              <TextField
                label={bundleForm.discountType === "percentage" ? "Discount %" : "Discount $"}
                type="number"
                value={bundleForm.discountValue.toString()}
                onChange={(value) => setBundleForm({ ...bundleForm, discountValue: parseFloat(value) || 0 })}
                suffix={bundleForm.discountType === "percentage" ? "%" : "$"}
                autoComplete="off"
              />
            </InlineStack>

            <TextField
              label="Minimum Products"
              type="number"
              value={bundleForm.minProducts.toString()}
              onChange={(value) => setBundleForm({ ...bundleForm, minProducts: parseInt(value) || 2 })}
              helpText="Minimum number of products required for bundle discount"
              autoComplete="off"
            />

            <Banner tone="info">
              <Text as="p" variant="bodyMd">
                {bundleForm.type === "manual" && bundleForm.selectedProducts.length > 0
                  ? `Ready to create bundle with ${bundleForm.selectedProducts.length} selected product${bundleForm.selectedProducts.length === 1 ? "" : "s"}.`
                  : bundleForm.type === "manual"
                  ? "Please select products above for your manual bundle."
                  : bundleForm.type === "category"
                  ? "Category bundles automatically include all products from selected collections."
                  : "AI bundles use machine learning to create intelligent product combinations."}
              </Text>
            </Banner>
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}