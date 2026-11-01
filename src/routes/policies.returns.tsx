import { createFileRoute } from "@tanstack/react-router";
import { ContentPage, contentTitles } from "@/components/storefront/content-page";
import { pageHead } from "@/utils/page-head";
export const Route = createFileRoute("/policies/returns")({
  component: Page,
  head: () =>
    pageHead(
      `${contentTitles["returns"]} | The Gold Crown`,
      "Returns information for The Gold Crown imitation jewellery, Ahmedabad. Pre-launch information and verified contact links.",
      "/policies/returns",
    ),
});
function Page() {
  return <ContentPage kind="returns" />;
}
