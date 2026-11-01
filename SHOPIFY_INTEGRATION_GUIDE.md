# Shopify Integration & Testing Guide
**The Gold Crown — Headless Storefront**

This website is fully integrated with the official **Shopify Storefront API** (`2025-01`) and **Shopify Customer Account API**.

---

## 1. Quick Setup: Connecting Your Live Store

When you are ready to connect your live store, follow these 3 steps:

### Step 1: Generate Storefront API Token in Shopify Admin
1. Go to your **Shopify Admin** (`https://admin.shopify.com/store/thegoldcrownimitation`).
2. In the left sidebar, click **Sales channels** → **Headless** (or search "Headless" in the search bar).
3. Click **Add storefront** (or select your existing storefront).
4. Under **Storefront API permissions**, ensure the following scopes are enabled:
   - ✅ **Products**: `unauthenticated_read_product_listings`, `unauthenticated_read_product_inventory`, `unauthenticated_read_product_tags`
   - ✅ **Collections**: `unauthenticated_read_collection_listings`
   - ✅ **Cart & Checkout**: `unauthenticated_write_checkouts`, `unauthenticated_read_checkouts`
   - ✅ **Customers**: `unauthenticated_write_customers`, `unauthenticated_read_customers`
5. Click **Save** and copy the **Public Access Token**.

### Step 2: Update the `.env` File
In the root directory of this project, open `.env` and set your credentials:

```bash
# Your store domain
VITE_SHOPIFY_STORE_DOMAIN=thegoldcrownimitation.myshopify.com

# Your Public Storefront Access Token
VITE_SHOPIFY_STOREFRONT_TOKEN=your_public_token_here
```

### Step 3: Ensure Your Shopify Plan is Active
Ensure your store has an active Shopify subscription plan (not frozen or payment pending). The API will immediately serve real products, prices, and live carts!

---

## 2. Architecture & Features Implemented

| Feature Area | API Integration | Fallback / Offline Behavior |
| :--- | :--- | :--- |
| **Product Listings** | Storefront API `products` GraphQL with auto-pagination | Falls back to local curated catalogue in `src/data/store.ts` |
| **Collections** | Storefront API `collection(handle: $handle)` query | Categorises demo products by category/festive slug |
| **Product Detail** | Storefront API `productByHandle` with variants, images, options | Renders full details with variant pills, gallery & zoom modal |
| **Live Predictive Search** | Storefront API `predictiveSearch` / product search query | Instant search across catalogue with trending search tags |
| **Cart & Quantities** | Storefront API `cartCreate`, `cartLinesAdd`, `cartLinesUpdate`, `cartLinesRemove` | In-memory & persisted demo cart with exact UI parity |
| **Slide-Out Cart Drawer** | Connected to `CartContext` with real Shopify totals | Shows free delivery progress bar, quantities & quick checkout |
| **Shopify Checkout** | Direct navigation to Shopify-hosted `checkoutUrl` | Seamless transition to secure Shopify payment processing |
| **Discounts & Coupons** | Storefront API `cartDiscountCodesUpdate` | Instant coupon validation in bag |
| **Customer Auth** | Storefront API `customerAccessTokenCreate`, `customerCreate`, `customerRecover` | Interactive Sign In / Register / Recover forms with live validation |
| **Customer Dashboard** | Storefront API `customer(customerAccessToken: $token)` query | Dashboard with order stats, addresses, order tracking & demo preview |
| **Order History & Tracking** | Storefront API `customer.orders` with carrier tracking URLs | Displays order cards, line item photos, and BlueDart / carrier tracking links |
| **Address Management** | Storefront API `customerAddressCreate`, `Update`, `Delete`, `Default` | Complete modal address manager for shipping destinations |
| **Cart Buyer Identity** | Storefront API `cartBuyerIdentityUpdate` | Links customer session to cart for pre-filled checkout |
| **Wishlist & Favorites** | Client-side persistent localStorage hook (`useWishlist`) | Heart buttons across cards, detail page, and header badge |
| **Recently Viewed** | Client-side tracking hook (`useRecentlyViewed`) | Displays "Recently Viewed" pieces on product pages |
| **Newsletter** | Storefront newsletter component | Styled maroon & gold subscription form on homepage |

---

## 3. How to Test Each Feature

### A. Testing Without Live Access (Local Testing Mode)
You can test the entire customer journey right now:
1. **Browse Jewellery**: Visit `http://localhost:8080/shop` and filter by category (Necklace Sets, Earrings, Bangles, etc.) or price.
2. **Predictive Search**: Click the magnifying glass in the header. Try typing *"Necklace"* or click *"Kundan"*.
3. **Product Detail & Variants**: Click any product (e.g. *Gulabi Necklace Set*), select options, and click **Zoom** on the photo.
4. **Add to Bag & Cart Drawer**: Click **Add to Bag**. The slide-out cart drawer smoothly appears with the free delivery progress bar. Adjust quantity or remove items.
5. **Customer Account**: Click the account icon in the header or go to `http://localhost:8080/account`. Click **Preview Account Dashboard Demo** to test the full customer portal, order history with tracking numbers, and address management.

### B. Testing With Live Shopify Access
Once your `.env` has valid credentials and your store is active:
1. Open the website: products will be fetched dynamically from your Shopify store.
2. Add an item to your bag: a real Shopify cart will be created in your store.
3. Click **Proceed to Checkout**: you will be redirected to your official Shopify-hosted checkout (`https://thegoldcrownimitation.myshopify.com/...`) with all items and discounts applied.
4. Sign in or register in the **Account** tab: uses official Shopify customer accounts and displays real placed orders.
