/**
 * Shopify Storefront — product queries & response mappers
 *
 * Fetches every product (up to 250 per page, auto-paginates) from the
 * connected Headless storefront and normalises the shape to the app's
 * own `Product` interface so the rest of the UI needs no changes.
 */

import { shopifyFetch } from "@/lib/shopify";
import type { Product, ShopifyProductDetail, ShopifyCollection } from "@/data/store";

// ─── GraphQL Fragments ─────────────────────────────────────────────────────────

const PRODUCT_CORE_FIELDS = /* GraphQL */ `
  fragment ProductCoreFields on Product {
    id
    title
    handle
    productType
    tags
    createdAt
    description
    descriptionHtml
    availableForSale
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
      maxVariantPrice {
        amount
        currencyCode
      }
    }
    compareAtPriceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    images(first: 10) {
      nodes {
        url
        altText
        width
        height
      }
    }
    variants(first: 50) {
      nodes {
        id
        title
        availableForSale
        quantityAvailable
        selectedOptions {
          name
          value
        }
        price {
          amount
          currencyCode
        }
        compareAtPrice {
          amount
          currencyCode
        }
        image {
          url
          altText
        }
      }
    }
    options {
      name
      values
    }
    seo {
      title
      description
    }
  }
`;

// ─── Queries ──────────────────────────────────────────────────────────────────

const PRODUCTS_QUERY = /* GraphQL */ `
  ${PRODUCT_CORE_FIELDS}
  query GetAllProducts($cursor: String) {
    products(first: 250, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ...ProductCoreFields
      }
    }
  }
`;

const PRODUCT_BY_HANDLE_QUERY = /* GraphQL */ `
  ${PRODUCT_CORE_FIELDS}
  query GetProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      ...ProductCoreFields
    }
  }
`;

const COLLECTION_QUERY = /* GraphQL */ `
  ${PRODUCT_CORE_FIELDS}
  query GetCollection($handle: String!, $cursor: String) {
    collection(handle: $handle) {
      id
      title
      handle
      description
      image {
        url
        altText
      }
      products(first: 250, after: $cursor, sortKey: CREATED_AT, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          ...ProductCoreFields
        }
      }
    }
  }
`;

const COLLECTIONS_QUERY = /* GraphQL */ `
  query GetCollections {
    collections(first: 20, sortKey: TITLE) {
      nodes {
        id
        title
        handle
        description
        image {
          url
          altText
        }
        productsCount {
          count
        }
      }
    }
  }
`;

const PREDICTIVE_SEARCH_QUERY = /* GraphQL */ `
  ${PRODUCT_CORE_FIELDS}
  query PredictiveSearch($query: String!) {
    predictiveSearch(query: $query, types: [PRODUCT]) {
      products {
        ...ProductCoreFields
      }
    }
  }
`;

const PRODUCT_RECOMMENDATIONS_QUERY = /* GraphQL */ `
  ${PRODUCT_CORE_FIELDS}
  query ProductRecommendations($productId: ID!) {
    productRecommendations(productId: $productId) {
      ...ProductCoreFields
    }
  }
`;

// ─── Raw Shopify types ─────────────────────────────────────────────────────────

export interface ShopifyProductNode {
  id: string;
  title: string;
  handle: string;
  productType: string;
  tags: string[];
  createdAt: string;
  description: string;
  descriptionHtml: string;
  availableForSale: boolean;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
  compareAtPriceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
  images: { nodes: { url: string; altText: string | null; width?: number; height?: number }[] };
  variants: {
    nodes: {
      id: string;
      title: string;
      availableForSale: boolean;
      quantityAvailable: number | null;
      selectedOptions: { name: string; value: string }[];
      price: { amount: string; currencyCode: string };
      compareAtPrice: { amount: string; currencyCode: string } | null;
      image: { url: string; altText: string | null } | null;
    }[];
  };
  options: { name: string; values: string[] }[];
  seo: { title: string | null; description: string | null };
}

interface ProductsQueryResponse {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: ShopifyProductNode[];
  };
}

interface ProductByHandleResponse {
  productByHandle: ShopifyProductNode | null;
}

interface CollectionQueryResponse {
  collection: {
    id: string;
    title: string;
    handle: string;
    description: string;
    image: { url: string; altText: string | null } | null;
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: ShopifyProductNode[];
    };
  } | null;
}

interface CollectionsQueryResponse {
  collections: {
    nodes: {
      id: string;
      title: string;
      handle: string;
      description: string;
      image: { url: string; altText: string | null } | null;
      productsCount: { count: number };
    }[];
  };
}

interface PredictiveSearchResponse {
  predictiveSearch: {
    products: ShopifyProductNode[];
  };
}

interface ProductRecommendationsResponse {
  productRecommendations: ShopifyProductNode[];
}

// ─── Mapper ────────────────────────────────────────────────────────────────────

/**
 * Normalises a Shopify product node to the app's Product shape.
 */
export function mapShopifyProduct(node: ShopifyProductNode): Product {
  const rawType = node.productType?.trim() ?? "";
  const category = rawType
    ? rawType
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    : "uncategorised";

  const tags = node.tags.map((t) => t.toLowerCase());
  const festive = tags.some((t) => t.includes("festive") || t.includes("bridal"));

  const price = parseFloat(node.priceRange.minVariantPrice.amount) || 0;
  const compareAtPrice = parseFloat(node.compareAtPriceRange?.minVariantPrice?.amount) || 0;

  const images = node.images.nodes.map((img) => img.url);
  const image = images[0] ?? "";

  const variants = node.variants.nodes.map((v) => ({
    id: v.id,
    title: v.title,
    availableForSale: v.availableForSale,
    quantityAvailable: v.quantityAvailable ?? null,
    selectedOptions: v.selectedOptions,
    price: parseFloat(v.price.amount) || 0,
    compareAtPrice: v.compareAtPrice ? parseFloat(v.compareAtPrice.amount) || 0 : null,
    image: v.image?.url ?? null,
  }));

  const variantTitles = node.variants.nodes.length > 0
    ? node.variants.nodes.map((v) => v.title)
    : ["Default"];

  // Build full detail object
  const detail: ShopifyProductDetail = {
    shopifyId: node.id,
    description: node.description,
    descriptionHtml: node.descriptionHtml,
    availableForSale: node.availableForSale,
    images,
    variants,
    options: node.options,
    currencyCode: node.priceRange.minVariantPrice.currencyCode,
    compareAtPrice: compareAtPrice > price ? compareAtPrice : null,
    maxPrice: parseFloat(node.priceRange.maxVariantPrice.amount) || 0,
  };

  return {
    id: node.id.split("/").at(-1) ?? node.id,
    shopifyId: node.id,
    slug: node.handle,
    name: node.title,
    category,
    price,
    image,
    date: (node.createdAt.split("T")[0]) ?? node.createdAt,
    variants: variantTitles,
    festive,
    detail,
    availableForSale: node.availableForSale,
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches all products from the Shopify Storefront API, paginating automatically.
 */
export async function fetchAllShopifyProducts(): Promise<Product[]> {
  const allProducts: Product[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res: ProductsQueryResponse = await shopifyFetch<ProductsQueryResponse>(PRODUCTS_QUERY, { cursor });
    const nodes: ShopifyProductNode[] = res.products.nodes;
    const pi: ProductsQueryResponse["products"]["pageInfo"] = res.products.pageInfo;
    allProducts.push(...nodes.map(mapShopifyProduct));
    hasNextPage = pi.hasNextPage;
    cursor = pi.endCursor;
  }

  return allProducts;
}

/**
 * Fetches a single product by its handle (slug).
 */
export async function fetchProductByHandle(handle: string): Promise<Product | null> {
  const response = await shopifyFetch<ProductByHandleResponse>(PRODUCT_BY_HANDLE_QUERY, { handle });
  if (!response.productByHandle) return null;
  return mapShopifyProduct(response.productByHandle);
}

/**
 * Fetches all products in a specific Shopify collection by handle.
 */
export async function fetchCollectionProducts(handle: string): Promise<{ products: Product[]; title: string; description: string } | null> {
  const allProducts: Product[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let collectionMeta: { title: string; description: string } | null = null;

  while (hasNextPage) {
    const colRes: CollectionQueryResponse = await shopifyFetch<CollectionQueryResponse>(COLLECTION_QUERY, { handle, cursor });
    if (!colRes.collection) return null;

    if (!collectionMeta) {
      collectionMeta = {
        title: colRes.collection.title,
        description: colRes.collection.description,
      };
    }

    allProducts.push(...colRes.collection.products.nodes.map(mapShopifyProduct));
    hasNextPage = colRes.collection.products.pageInfo.hasNextPage;
    cursor = colRes.collection.products.pageInfo.endCursor;
  }

  return {
    products: allProducts,
    title: collectionMeta?.title ?? handle,
    description: collectionMeta?.description ?? "",
  };
}

/**
 * Fetches all collections from Shopify.
 */
export async function fetchCollections(): Promise<ShopifyCollection[]> {
  const response = await shopifyFetch<CollectionsQueryResponse>(COLLECTIONS_QUERY);
  return response.collections.nodes.map((c) => ({
    id: c.id,
    title: c.title,
    handle: c.handle,
    description: c.description,
    image: c.image?.url ?? null,
    productsCount: c.productsCount.count,
  }));
}

/**
 * Predictive / full-text search across products.
 */
export async function searchShopifyProducts(query: string): Promise<Product[]> {
  if (!query.trim()) return [];
  const response = await shopifyFetch<PredictiveSearchResponse>(PREDICTIVE_SEARCH_QUERY, { query });
  return response.predictiveSearch.products.map(mapShopifyProduct);
}

/**
 * Fetches product recommendations for a given Shopify product GID.
 */
export async function fetchProductRecommendations(productId: string): Promise<Product[]> {
  const response = await shopifyFetch<ProductRecommendationsResponse>(PRODUCT_RECOMMENDATIONS_QUERY, { productId });
  return response.productRecommendations.map(mapShopifyProduct);
}
