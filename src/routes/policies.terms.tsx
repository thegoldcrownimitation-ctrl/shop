import { createFileRoute } from "@tanstack/react-router";
import { ContentPage, contentTitles } from "@/components/storefront/content-page";
import { pageHead } from "@/utils/page-head";
export const Route = createFileRoute("/policies/terms")({
  component: Page,
  head: () =>
    pageHead(
      `${contentTitles["terms"]} | The Gold Crown`,
      "Terms information for The Gold Crown imitation jewellery, Ahmedabad. Pre-launch information and verified contact links.",
      "/policies/terms",
    ),
});
function Page() {
  return <ContentPage kind="terms" />;
}
