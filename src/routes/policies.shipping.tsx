import { createFileRoute } from "@tanstack/react-router";
import { ContentPage, contentTitles } from "@/components/storefront/content-page";
import { pageHead } from "@/utils/page-head";
export const Route = createFileRoute("/policies/shipping")({
  component: Page,
  head: () =>
    pageHead(
      `${contentTitles["shipping"]} | The Gold Crown`,
      "Shipping information for The Gold Crown imitation jewellery, Ahmedabad. Pre-launch information and verified contact links.",
      "/policies/shipping",
    ),
});
function Page() {
  return <ContentPage kind="shipping" />;
}
