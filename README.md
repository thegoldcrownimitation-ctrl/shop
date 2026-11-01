# The Gold Crown

Retail imitation jewellery storefront built with React 19, TypeScript, Vite, Tailwind CSS and Lucide. The Lovable workspace requires its TanStack Router/Start bootstrap; React Router and a separate SPA bootstrap were intentionally not introduced. This is not Next.js and uses no React Server Components.

## Run locally

```sh
bun install
bun run dev
# Validation locally (Lovable handles build/type validation automatically):
bun run test
bun run lint
bun run build
```

## Current status

All requested public routes exist, including `/collections/$slug` and `/products/$slug` (equivalent to the requested `:slug` URLs). Search, category and maximum-price filters, price/newest sorting, demo variants, cart quantities, removal, totals and empty states work. Cart state lasts for the current browsing session and resets on refresh. No orders, payment, inventory reservation, accounts or newsletter submissions are implemented. Shopify setup was declined; checkout remains disabled.

## Structure

- `src/data/store.ts`: typed demo products, categories, brand links, address, editable announcement.
- `src/services/commerce.ts`: documented asynchronous commerce adapter and cart validation.
- `src/components/storefront/`: reusable shell, catalogue, product cards/details, cart context and content views.
- `src/routes/`: TanStack file routes with unique page titles, descriptions and social metadata.
- `src/styles.css`: centralized semantic brand tokens and responsive design.

## Images and approval

The small logo is cropped from the supplied Instagram screenshot and hosted through the project asset service. Request a high-resolution approved logo before launch. The rest of the screenshot is NOT embedded. Campaign and product photos are generated visual-development assets, not real inventory. Demo product names, prices and size options are illustrative and clearly labelled in the UI. Replace all four generated images imported by `store.ts` with owner-approved product photographs (use asset pointer JSON and `.url` for uploaded media). Provide an image for Rings before adding its actual products; it currently shows an honest empty collection. No competitor images are used.

## Connecting genuine commerce

No credentials or commerce-related environment variables are currently required. Connect Shopify through the Lovable setup flow when ready. New development stores are free to build; claim within 30 days to keep the store. Claiming starts a separate 120-day trial; a paid plan is required after that trial to sell.

1. Populate Shopify with approved INR prices, inventory, product images, descriptions, sizes and specifications. Do not migrate sample data as real inventory.
2. Replace `commerce.listProducts` with Storefront API product/collection retrieval. Use stable provider product and variant IDs and handle loading, errors, pagination and unavailable variants. Connect route loaders and catalogue views to this adapter; currently they read synchronous demo data directly.
3. Replace context mutations with Shopify Cart API `cartCreate`, `cartLinesAdd`, `cartLinesUpdate` and `cartLinesRemove`. Use backend-validated totals and availability, not the demo calculations.
4. Implement `createCheckout` to return the genuine cart `checkoutUrl`, validate errors and use it for redirecting to Shopify-hosted checkout. Only enable the CTA after this works with real products. Do not accept card details in this application.
5. Only a token explicitly issued for public Storefront access may be exposed in browser configuration (for example `VITE_SHOPIFY_STORE_DOMAIN` and `VITE_SHOPIFY_STOREFRONT_PUBLIC_TOKEN`). Admin/private tokens belong in secure server secrets and must not use `VITE_` names. None are configured now. Consult the platform server-runtime and server-function rules before adding server handlers.
6. Configure taxes, payment verification, delivery areas, shipping rates, return rules and order communications in Shopify. Verify product selection → cart → real checkout → order receipt end to end before launch.

## Business content before launch

Verify the Instagram address, business contact details and legal seller information. Approve shipping, returns, privacy and terms; the current pages honestly explain what is unconfigured rather than inventing policies. Supply actual care instructions and specifications. Add WhatsApp only after supplying a verified number. Add newsletter/contact forms only with a working submission service and privacy approval.

## Deployment

The preview updates in Lovable. Publishing is a separate owner action, not performed here. Deep links are handled by Lovable hosting and require no manual SPA rewrite files. Approve catalogue, imagery, policies and commerce before publishing for retail sales. Never expose private credentials in code.
