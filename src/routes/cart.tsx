import { createFileRoute } from "@tanstack/react-router";
import { CartPage } from "@/components/storefront/cart-page";
import { pageHead } from "@/utils/page-head";
export const Route = createFileRoute("/cart")({
  component: Page,
  head: () =>
    pageHead(
      "Your Shopping Bag | The Gold Crown",
      "Your Shopping Bag at The Gold Crown, Chandkheda, Ahmedabad. Explore our imitation jewellery demo collection.",
      "/cart",
    ),
});
function Page() {
  return <CartPage />;
}
