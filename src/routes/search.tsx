import { createFileRoute } from "@tanstack/react-router";
import { Catalogue } from "@/components/storefront/catalogue";
import { pageHead } from "@/utils/page-head";
export const Route = createFileRoute("/search")({
  component: Page,
  head: () =>
    pageHead(
      "Search Jewellery | The Gold Crown",
      "Search Jewellery at The Gold Crown, Chandkheda, Ahmedabad. Explore our imitation jewellery demo collection.",
      "/search",
    ),
});
function Page() {
  return <Catalogue searchPage />;
}
