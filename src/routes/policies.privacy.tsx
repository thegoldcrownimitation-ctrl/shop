import { createFileRoute } from "@tanstack/react-router";
import { ContentPage, contentTitles } from "@/components/storefront/content-page";
import { pageHead } from "@/utils/page-head";
export const Route = createFileRoute("/policies/privacy")({
  component: Page,
  head: () =>
    pageHead(
      `${contentTitles["privacy"]} | The Gold Crown`,
      "Privacy information for The Gold Crown imitation jewellery, Ahmedabad. Pre-launch information and verified contact links.",
      "/policies/privacy",
    ),
});
function Page() {
  return <ContentPage kind="privacy" />;
}
