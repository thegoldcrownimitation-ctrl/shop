import necklace from "@/assets/necklace.jpg";
import earrings from "@/assets/earrings.jpg";
import bangles from "@/assets/bangles.jpg";
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
  price: number;
  image: string;
  date: string;
  variants: string[]; // legacy: variant titles for simple display
  festive: boolean;
  detail?: ShopifyProductDetail; // rich data only populated from Shopify
  availableForSale?: boolean;
}

// ─── Categories ───────────────────────────────────────────────────────────────

export const categories = [
  { slug: "necklace-sets", name: "Necklace Sets", image: necklace },
  { slug: "earrings", name: "Earrings", image: earrings },
  { slug: "bangles-bracelets", name: "Bangles & Bracelets", image: bangles },
  { slug: "rings", name: "Rings", image: null },
  { slug: "bridal-festive", name: "Bridal & Festive", image: campaign },
];

// ─── Demo products (fallback when Shopify is not connected) ───────────────────

export const products: Product[] = [
  {
    id: "n1",
    slug: "gulabi-necklace-set",
    name: "Gulabi Necklace Set",
    category: "necklace-sets",
    price: 2450,
    image: necklace,
    date: "2026-10-10",
    variants: ["Display sample"],
    festive: true,
  },
  {
    id: "e1",
    slug: "mayura-jhumka-earrings",
    name: "Mayura Jhumka Earrings",
    category: "earrings",
    price: 1250,
    image: earrings,
    date: "2026-10-09",
    variants: ["Display sample"],
    festive: true,
  },
  {
    id: "b1",
    slug: "rang-bangle-pair",
    name: "Rang Bangle Pair",
    category: "bangles-bracelets",
    price: 1850,
    image: bangles,
    date: "2026-10-08",
    variants: ["Sample 2.4", "Sample 2.6"],
    festive: true,
  },
  {
    id: "n2",
    slug: "rajwada-necklace-set",
    name: "Rajwada Necklace Set",
    category: "necklace-sets",
    price: 3250,
    image: campaign,
    date: "2026-10-07",
    variants: ["Display sample"],
    festive: true,
  },
];

// ─── Formatters ───────────────────────────────────────────────────────────────

export const money = (value: number, currencyCode = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(value);
