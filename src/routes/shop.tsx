import { createFileRoute } from "@tanstack/react-router";
import { Catalogue } from "@/components/storefront/catalogue";
import { pageHead } from "@/utils/page-head";
export const Route = createFileRoute("/shop")({
  component: Page,
  head: () =>
    pageHead(
      "Shop All Jewellery | The Gold Crown",
      "Shop All Jewellery at The Gold Crown, Chandkheda, Ahmedabad. Explore our imitation jewellery demo collection.",
      "/shop",
    ),
});
function Page() {
  return <Catalogue />;
}
