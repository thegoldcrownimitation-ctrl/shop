import { createFileRoute } from "@tanstack/react-router";
import { ProductDetail } from "@/components/storefront/product-detail";
import { pageHead } from "@/utils/page-head";

export const Route = createFileRoute("/products/$slug")({
  component: Page,
  head: ({ params }) =>
    pageHead(
      `${params.slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} | The Gold Crown`,
      "Discover this beautiful piece from The Gold Crown imitation jewellery collection, Chandkheda, Ahmedabad.",
      `/products/${params.slug}`,
    ),
});

function Page() {
  const { slug } = Route.useParams();
  return <ProductDetail key={slug} slug={slug} />;
}
