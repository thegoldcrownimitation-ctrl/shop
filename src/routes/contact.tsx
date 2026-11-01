import { createFileRoute } from "@tanstack/react-router";
import { ContentPage, contentTitles } from "@/components/storefront/content-page";
import { pageHead } from "@/utils/page-head";
export const Route = createFileRoute("/contact")({
  component: Page,
  head: () =>
    pageHead(
      `${contentTitles["contact"]} | The Gold Crown`,
      "Contact information for The Gold Crown imitation jewellery, Ahmedabad. Pre-launch information and verified contact links.",
      "/contact",
    ),
});
function Page() {
  return <ContentPage kind="contact" />;
}
