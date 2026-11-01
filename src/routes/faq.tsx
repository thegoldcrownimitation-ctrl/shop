import { createFileRoute } from "@tanstack/react-router";
import { ContentPage, contentTitles } from "@/components/storefront/content-page";
import { pageHead } from "@/utils/page-head";
export const Route = createFileRoute("/faq")({
  component: Page,
  head: () =>
    pageHead(
      `${contentTitles["faq"]} | The Gold Crown`,
      "Faq information for The Gold Crown imitation jewellery, Ahmedabad. Pre-launch information and verified contact links.",
      "/faq",
    ),
});
function Page() {
  return <ContentPage kind="faq" />;
}
