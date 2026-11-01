import { createFileRoute } from "@tanstack/react-router";
import { ContentPage, contentTitles } from "@/components/storefront/content-page";
import { pageHead } from "@/utils/page-head";
export const Route = createFileRoute("/about")({
  component: Page,
  head: () =>
    pageHead(
      `${contentTitles["about"]} | The Gold Crown`,
      "About information for The Gold Crown imitation jewellery, Ahmedabad. Pre-launch information and verified contact links.",
      "/about",
    ),
});
function Page() {
  return <ContentPage kind="about" />;
}
