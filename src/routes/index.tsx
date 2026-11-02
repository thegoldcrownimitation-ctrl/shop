import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Crown, Gem, Sparkles, Instagram, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { campaign, categories, products as demoProducts, brand, type Product } from "@/data/store";
import { commerce } from "@/services/commerce";
import { isShopifyConfigured } from "@/lib/shopify";
import { ProductCard } from "@/components/storefront/product-card";
import { Newsletter } from "@/components/storefront/newsletter";
import { pageHead } from "@/utils/page-head";

export const Route = createFileRoute("/")(  {
  component: HomePage,
  head: () =>
    pageHead(
      "The Gold Crown | Imitation Jewellery, Ahmedabad",
      "Discover The Gold Crown: imitation jewellery, necklace sets, earrings and festive pieces. Where Every Look Deserves a Crown.",
      "/",
    ),
});

function Heading({
  eyebrow,
  title,
  newArrivals = false,
}: {
  eyebrow: string;
  title: string;
  newArrivals?: boolean;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <Link className="text-link" to="/shop">
        Explore all <ArrowUpRight size={15} />
      </Link>
    </div>
  );
}

function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(isShopifyConfigured);

  useEffect(() => {
    if (!isShopifyConfigured) return;
    setLoading(true);
    commerce
      .listProducts()
      .then((all) => {
        setFeaturedProducts(all.slice(0, 8));
      })
      .catch(() => setFeaturedProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const spotlight = featuredProducts.slice(0, 4);
  const newArrivals = featuredProducts.slice(0, 3);
  const editorial = featuredProducts.slice(0, 3);

  return (
    <>
      <section className="hero">
        <img
          src={campaign}
          alt="Gold-tone necklace and earrings on teal velvet — The Gold Crown festive jewellery"
          width={1536}
          height={1024}
          fetchPriority="high"
        />
        <div className="hero-inner page-width">
          <p className="eyebrow">THE FESTIVE EDIT · THE GOLD CROWN</p>
          <div className="hero-brand">The Gold Crown</div>
          <h1>
            Elegance in
            <br />
            <em>Every Detail.</em>
          </h1>
          <p className="hero-copy">
            A celebration of timeless beauty, little traditions,
            <br className="hidden sm:block" /> and the moments that make you shine.
          </p>
          <Button asChild className="hero-button">
            <Link to="/shop">
              Shop the Collection <ArrowRight size={17} />
            </Link>
          </Button>
        </div>
        <div className="hero-bottom">
          <span>WHERE EVERY LOOK DESERVES A CROWN.</span>
          <span>THE FESTIVE COLLECTION — 2026</span>
        </div>
      </section>
      <div className="brand-ribbon">
        <Sparkles size={15} />
        <span>EVERYDAY ELEGANCE</span>
        <span>·</span>
        <span>FESTIVE FAVOURITES</span>
        <span>·</span>
        <span>YOUR SIGNATURE SPARKLE</span>
        <Sparkles size={15} />
      </div>
      <section className="section page-width">
        <Heading eyebrow="Find your kind of beautiful" title="A Crown for Every Occasion" />
        <div className="category-grid">
          {categories.map((c) => (
            <Link
              key={c.slug}
              className="category-item"
              to="/collections/$slug"
              params={{ slug: c.slug }}
            >
              <div className="image-wrap">
                {c.image ? (
                  <img
                    src={c.image}
                    alt={`${c.name} collection`}
                    width={1024}
                    height={1280}
                    loading="lazy"
                  />
                ) : (
                  <div className="category-placeholder">
                    <Gem size={38} />
                    <span>Coming soon</span>
                  </div>
                )}
              </div>
              <h3>{c.name}</h3>
            </Link>
          ))}
        </div>
      </section>
      <section className="soft-section">
        <div className="section page-width">
          <Heading eyebrow="The pieces we love" title="The Spotlight Edit" />
          {loading ? (
            <div className="empty-state" style={{ padding: "40px 0" }}>
              <Loader2 size={28} className="animate-spin" />
              <p>Loading our latest jewellery…</p>
            </div>
          ) : (
            <div className="product-grid">
              {spotlight.map((p) => (
                <ProductCard product={p} key={p.id} />
              ))}
            </div>
          )}
        </div>
      </section>
      <section className="section page-width">
        <Heading eyebrow="A fresh little sparkle" title="New to the Crown" newArrivals />
        {!loading && (
          <div className="product-grid">
            {newArrivals.map((p) => (
              <ProductCard product={p} key={p.id} />
            ))}
          </div>
        )}
      </section>
      <section className="signature">
        <img
          src={campaign}
          alt="The Gold Crown festive jewellery campaign"
          width={1536}
          height={1024}
          loading="lazy"
        />
        <div className="signature-content page-width">
          <p className="eyebrow">THE SIGNATURE COLLECTION</p>
          <h2>
            For moments
            <br />
            that become
            <br />
            <em>memories.</em>
          </h2>
          <p>Jewellery that belongs at the heart of your celebrations.</p>
          <Button className="hero-button" asChild>
            <Link to="/shop">
              Discover All Pieces <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
      <section className="section page-width">
        <div className="promise-grid">
          <div>
            <Gem size={29} strokeWidth={1} />
            <h3>Curated Imitation Jewellery</h3>
            <p>A considered selection of styles for your everyday and special occasions.</p>
          </div>
          <div>
            <Crown size={29} strokeWidth={1} />
            <h3>A Crown for Every Look</h3>
            <p>From a simple finishing touch to the centrepiece of your celebration.</p>
          </div>
          <div>
            <Sparkles size={29} strokeWidth={1} />
            <h3>Rooted in Ahmedabad</h3>
            <p>Discover The Gold Crown in Chandkheda, Ahmedabad, Gujarat.</p>
          </div>
        </div>
      </section>
      <section className="soft-section">
        <div className="section page-width">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE GOLD CROWN JOURNAL</p>
              <h2>A Little Inspiration, A Lot of Sparkle</h2>
            </div>
            <a className="text-link" href={brand.instagram} target="_blank" rel="noreferrer">
              <Instagram size={15} />
              <span className="hidden sm:inline">@thegoldcrownimitation</span>
              <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="editorial-grid">
            {editorial.map((p) => (
              <a
                href={brand.instagram}
                key={p.id}
                target="_blank"
                rel="noreferrer"
                aria-label="Visit The Gold Crown on Instagram"
              >
                <img
                  src={p.image}
                  alt={`${p.name} — editorial image`}
                  width={1024}
                  height={1280}
                  loading="lazy"
                />
              </a>
            ))}
          </div>
          <p className="gallery-note">
            See our real jewellery and latest updates on Instagram.
          </p>
        </div>
      </section>
      <Newsletter />
      <section className="story-band">
        <div className="page-width">
          <p className="eyebrow text-primary">OUR STORY, YOUR SPARKLE</p>
          <h2>
            Not just jewellery.
            <br />
            <em>A little piece of who you are.</em>
          </h2>
          <p>
            At The Gold Crown, we believe every look deserves its own moment. Explore our world of
            imitation jewellery, rooted in Ahmedabad and inspired by the joy of dressing up.
          </p>
          <Link to="/about" className="text-link">
            Meet The Gold Crown <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
