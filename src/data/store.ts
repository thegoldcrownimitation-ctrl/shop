import campaign from "@/assets/campaign.jpg";
export { campaign };

export const brand = {
  name: "The Gold Crown",
  tagline: "Where Every Look Deserves a Crown.",
  instagram: "https://www.instagram.com/thegoldcrownimitation/",
  announcement: "A little tradition. A little sparkle. A crown for every look.",
  address:
    "Front side of Kalol Highway, opposite Satyamev Hospital, Hiramoti Society, Chandkheda, Ahmedabad, Gujarat 382424",
};

// ─── Shopify-enriched product variant type ────────────────────────────────────

export interface ProductVariant {
  id: string; // Shopify GID e.g. gid://shopify/ProductVariant/...
  title: string;
  availableForSale: boolean;
  quantityAvailable: number | null;
  selectedOptions: { name: string; value: string }[];
  price: number;
  compareAtPrice: number | null;
  image: string | null;
}

export interface ShopifyProductDetail {
  shopifyId: string;
  description: string;
  descriptionHtml: string;
  availableForSale: boolean;
  images: string[];
  variants: ProductVariant[];
  options: { name: string; values: string[] }[];
  currencyCode: string;
  compareAtPrice: number | null;
  maxPrice: number;
}

export interface ShopifyCollection {
  id: string;
  title: string;
  handle: string;
  description: string;
  image: string | null;
  productsCount: number;
}

// ─── Core Product interface ────────────────────────────────────────────────────

export interface Product {
  id: string;
  shopifyId?: string; // full GID e.g. gid://shopify/Product/...
  slug: string;
  name: string;
  category: string;
  collections?: string[];
  price: number;
  compareAtPrice?: number | null;
  image: string;
  date: string;
  variants: string[]; // variant titles for simple display
  festive: boolean;
  detail?: ShopifyProductDetail; // rich data populated from Shopify
  availableForSale?: boolean;
}

// ─── Real Store Collections ───────────────────────────────────────────────────

export const categories = [
  {
    slug: "necklaces",
    name: "Necklaces",
    image: "https://cdn.shopify.com/s/files/1/1024/6239/0644/collections/a-diamond-necklace-and-earrings-on-display-photo.jpg?v=1789724313",
  },
  {
    slug: "earrings",
    name: "Earrings",
    image: "https://cdn.shopify.com/s/files/1/1024/6239/0644/collections/images.jpg?v=1789724255",
  },
  {
    slug: "bracelets",
    name: "Bracelets",
    image: "https://cdn.shopify.com/s/files/1/1024/6239/0644/collections/SV-203-0003.webp?v=1789724297",
  },
  {
    slug: "bangles",
    name: "Bangles",
    image: "https://cdn.shopify.com/s/files/1/1024/6239/0644/collections/5e8be5eddeb41d2900856e91eb51ab07.jpg?v=1790066051",
  },
  {
    slug: "ring",
    name: "Rings",
    image: "https://cdn.shopify.com/s/files/1/1024/6239/0644/collections/360_F_964560682_1uhlInnvWIsxnVbJo99O7p82rDg2muNY.jpg?v=1789724278",
  },
  {
    slug: "bridal-festive",
    name: "Bridal & Festive",
    image: campaign,
  },
];

// No static dummy products! Store starts empty until fetched dynamically from Shopify.
export const products: Product[] = [];

// ─── Formatters ───────────────────────────────────────────────────────────────

export const money = (value: number, currencyCode = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
