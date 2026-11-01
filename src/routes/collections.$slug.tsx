import { createFileRoute } from "@tanstack/react-router";
import { Catalogue } from "@/components/storefront/catalogue";
import { categories } from "@/data/store";
import { pageHead } from "@/utils/page-head";

export const Route = createFileRoute("/collections/$slug")({
  component: Page,
  head: ({ params }) =>
    pageHead(
      `${categories.find((c) => c.slug === params.slug)?.name ?? (params.slug === "new-arrivals" ? "New Arrivals" : "Jewellery Collection")} | The Gold Crown`,
      "Explore The Gold Crown imitation jewellery collection. Necklace sets, earrings, bangles and festive jewellery from Chandkheda, Ahmedabad.",
      `/collections/${params.slug}`,
    ),
});

function Page() {
  const { slug } = Route.useParams();
  return <Catalogue key={slug} collection={slug} />;
}
