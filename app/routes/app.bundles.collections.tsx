import { json } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { useEffect, useState } from "react";
import {
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Thumbnail,
  Checkbox,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    // First, get collections with their products
    const response = await admin.graphql(`
      query getCollectionsWithProducts {
        collections(first: 50) {
          edges {
            node {
              id
              title
              handle
              image {
                url
              }
              productsCount
              products(first: 50) {
                edges {
                  node {
                    id
                    title
                    handle
                    featuredImage {
                      url
                    }
                    priceRangeV2 {
                      minVariantPrice {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `);

    const responseJson = await response.json();
    
    if (responseJson.errors) {
      console.error("GraphQL errors:", responseJson.errors);
      return json({ 
        collections: [],
        products: [],
        error: "Failed to fetch collections and products" 
      });
    }

    // Extract collections and flatten all products
    const collections = responseJson.data?.collections?.edges?.map(edge => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      image: edge.node.image?.url,
      productsCount: edge.node.productsCount
    })) || [];

    const products = responseJson.data?.collections?.edges?.flatMap(edge => 
      edge.node.products.edges.map(productEdge => ({
        id: productEdge.node.id,
        title: productEdge.node.title,
        handle: productEdge.node.handle,
        image: productEdge.node.featuredImage?.url,
        price: productEdge.node.priceRangeV2?.minVariantPrice?.amount,
        currencyCode: productEdge.node.priceRangeV2?.minVariantPrice?.currencyCode,
        collectionId: edge.node.id,
        collectionTitle: edge.node.title
      }))
    ) || [];

    return json({ collections, products, error: null });
  } catch (error) {
    console.error("Error fetching collections:", error);
    return json({ 
      collections: [], 
      products: [],
      error: error.message 
    });
  }
};

export default function BundleCollections() {
  const fetcher = useFetcher();
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);

  useEffect(() => {
    if (fetcher.state === "idle" && !fetcher.data) {
      fetcher.load("/app/bundles/collections");
    }
  }, [fetcher]);

  useEffect(() => {
    // Send selection back to parent
    if (window.opener && (selectedProducts.length > 0 || selectedCollections.length > 0)) {
      window.opener.postMessage({
        type: "bundle-selection",
        selectedProducts,
        selectedCollections,
      }, "*");
    }
  }, [selectedProducts, selectedCollections]);

  const handleProductSelection = (productId, isSelected) => {
    setSelectedProducts(prev =>
      isSelected 
        ? [...prev, productId]
        : prev.filter(id => id !== productId)
    );
  };

  const handleCollectionSelection = (collectionId, isSelected) => {
    setSelectedCollections(prev =>
      isSelected 
        ? [...prev, collectionId]
        : prev.filter(id => id !== collectionId)
    );
  };

  if (fetcher.state === "loading") {
    return (
      <Card>
        <Text>Loading products and collections...</Text>
      </Card>
    );
  }

  const { collections = [], products = [], error } = fetcher.data || {};

  if (error) {
    return (
      <Card>
        <Text tone="critical">Error: {error}</Text>
      </Card>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <Card>
        <div style={{ padding: "20px" }}>
          <Text variant="headingMd" as="h2">
            Select Products for Bundle
          </Text>
          <Text variant="bodyMd" tone="subdued">
            Choose specific products or entire collections to include in this bundle.
          </Text>
        </div>
      </Card>

      {products.length > 0 && (
        <Card title="Products" sectioned>
          <ResourceList
            resourceName={{ singular: "product", plural: "products" }}
            items={products}
            renderItem={(product) => {
              const isSelected = selectedProducts.includes(product.id);
              
              return (
                <ResourceItem
                  id={product.id}
                  media={
                    <Thumbnail
                      source={product.image || ""}
                      alt={product.title}
                    />
                  }
                  onClick={() => handleProductSelection(product.id, !isSelected)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Checkbox
                      checked={isSelected}
                      onChange={(checked) => handleProductSelection(product.id, checked)}
                    />
                    <div>
                      <Text variant="bodyMd" fontWeight="bold">
                        {product.title}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        Collection: {product.collectionTitle}
                      </Text>
                      {product.price && (
                        <Text variant="bodySm">
                          {product.currencyCode} {product.price}
                        </Text>
                      )}
                    </div>
                  </div>
                </ResourceItem>
              );
            }}
          />
        </Card>
      )}

      {collections.length > 0 && (
        <Card title="Collections" sectioned>
          <ResourceList
            resourceName={{ singular: "collection", plural: "collections" }}
            items={collections}
            renderItem={(collection) => {
              const isSelected = selectedCollections.includes(collection.id);
              
              return (
                <ResourceItem
                  id={collection.id}
                  media={
                    <Thumbnail
                      source={collection.image || ""}
                      alt={collection.title}
                    />
                  }
                  onClick={() => handleCollectionSelection(collection.id, !isSelected)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Checkbox
                      checked={isSelected}
                      onChange={(checked) => handleCollectionSelection(collection.id, checked)}
                    />
                    <div>
                      <Text variant="bodyMd" fontWeight="bold">
                        {collection.title}
                      </Text>
                      <Text variant="bodySm" tone="subdued">
                        {collection.productsCount} products
                      </Text>
                    </div>
                  </div>
                </ResourceItem>
              );
            }}
          />
        </Card>
      )}

      <div style={{ marginTop: "20px", textAlign: "center" }}>
        <button
          onClick={() => window.close()}
          style={{
            padding: "10px 20px",
            background: "#008060",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Done Selecting
        </button>
      </div>
    </div>
  );
}
