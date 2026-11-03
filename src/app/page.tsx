import Link from "next/link";
import { ArrowRight, Sparkles, ChevronRight, Award, Compass, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/catalog/product-card";
import { Empty } from "@/components/ui/empty";
import categoriesActions from "@/features/categories/actions";
import productsActions from "@/features/products/actions";

// Curated merchandising descriptions replacing seed placeholder strings
const CATEGORY_MERCHANDISING: Record<string, string> = {
  apparel: "Tactile textiles, organic garments & utilitarian apparel",
  electronics: "Acoustic audio, power utilities & everyday tech",
  furniture: "Ergonomic desk seating, craft surfaces & home living",
  "home-kitchen": "Hand-poured fragrances, durable cookware & kitchen goods",
  "toys-games": "Mindful puzzles, tabletop games & leisure essentials",
};

export default async function HomePage() {
  const [categories, productsResult] = await Promise.all([
    categoriesActions.getCategoriesTree().catch(() => []),
    productsActions
      .getProducts({
        page: 1,
        pageSize: 8,
        sortBy: "publishedAt",
        sortOrder: "desc",
      })
      .catch(() => ({
        data: [],
        meta: { page: 1, pageSize: 8, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      })),
  ]);

  const trendingProducts = productsResult.data || [];
  const topCategories = categories.slice(0, 6);

  return (
    <div className="flex flex-col gap-16 pb-20">
      {/* Hero Section - Warm Cream Canvas with Starbucks Brand Green */}
      <section className="relative overflow-hidden bg-[var(--brand-cream)] border-b border-[var(--border)] py-18 sm:py-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-mint)] bg-[var(--brand-mint)]/40 px-3.5 py-1 text-xs font-semibold text-[var(--brand-green)] w-fit shadow-2xs">
              <Sparkles className="size-3.5 text-[var(--brand-accent)]" />
              <span>Modern Curated Commerce & Craft</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-[-0.01em] text-[var(--brand-green)] leading-[1.08]">
              Curated everyday goods, delivered to your door.
            </h1>

            <p className="text-base sm:text-lg text-[rgba(0,0,0,0.65)] leading-relaxed max-w-2xl">
              Thoughtfully sourced essentials, tactile textiles, artisanal home craft,
              and contemporary utilities. Fast nationwide doorstep delivery with 100% encrypted
              order protection.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-3">
              <Button asChild size="lg" className="h-12 px-7 text-sm font-semibold">
                <Link href="/products">
                  <span>Explore Catalog</span>
                  <ArrowRight className="size-4 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-7 text-sm font-semibold">
                <Link href="/products?sortBy=publishedAt&sortOrder=desc">
                  New Arrivals
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Curated Categories */}
      {topCategories.length > 0 && (
        <section className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[var(--brand-green)]">
                Shop by Department
              </h2>
              <p className="text-sm text-[rgba(0,0,0,0.58)] mt-1">
                Explore curated departments built for functional beauty and long-lasting utility.
              </p>
            </div>
            <Link
              href="/products"
              className="hidden sm:flex items-center gap-1 text-sm font-semibold text-[var(--brand-accent)] hover:underline transition-colors"
            >
              <span>View all</span>
              <ChevronRight className="size-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {topCategories.map((cat) => {
              const description = CATEGORY_MERCHANDISING[cat.slug] || cat.description;
              return (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  className="group relative flex flex-col justify-between rounded-xl border border-[var(--border)] bg-white p-5 sm:p-6 shadow-starbucks-card hover:shadow-md transition-all duration-200"
                >
                  <div>
                    <h3 className="font-bold text-base text-[rgba(0,0,0,0.87)] group-hover:text-[var(--brand-accent)] transition-colors">
                      {cat.name}
                    </h3>
                    {description && (
                      <p className="text-xs text-[rgba(0,0,0,0.58)] mt-1.5 line-clamp-2 leading-relaxed">
                        {description}
                      </p>
                    )}
                  </div>
                  <div className="mt-5 flex items-center text-xs font-semibold text-[var(--brand-accent)]">
                    <span>Browse department</span>
                    <ArrowRight className="size-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured / Trending Products */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--brand-green)]">
              Trending Essentials
            </h2>
            <p className="text-sm text-[rgba(0,0,0,0.58)] mt-1">
              Popular picks handcrafted and tested for durability, simplicity, and everyday performance.
            </p>
          </div>
          <Link
            href="/products"
            className="flex items-center gap-1 text-sm font-semibold text-[var(--brand-accent)] hover:underline transition-colors"
          >
            <span>See all products</span>
            <ChevronRight className="size-4" />
          </Link>
        </div>

        {trendingProducts.length === 0 ? (
          <Empty
            title="Catalog Restocking Soon"
            description="Our curators are preparing new product batches. Check back shortly or browse upcoming collections."
            action={
              <Button asChild variant="outline">
                <Link href="/products">Browse All</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {trendingProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Signature House Green Feature Band (.agents/DESIGN.md Section 4 & 5) */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-[var(--brand-house)] text-white p-8 sm:p-14 overflow-hidden relative shadow-lg">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 flex flex-col gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-gold)]">
                The Flagship Standard
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.01em] text-white leading-tight">
                Crafted for comfort. Built for life.
              </h2>
              <p className="text-sm sm:text-base text-white/75 leading-relaxed max-w-xl">
                Every piece in our catalog undergoes rigorous material inspections and tactile testing.
                From single-origin beans and artisanal candles to ergonomic seating, we believe
                the objects in your everyday routine should inspire quiet joy and effortless reliability.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-3">
                <Button asChild variant="inverted" size="lg" className="h-12 px-7 text-sm font-semibold">
                  <Link href="/products">
                    <span>Explore Flagship Menu</span>
                    <ArrowRight className="size-4 ml-1.5" />
                  </Link>
                </Button>
                <Button asChild variant="invertedOutline" size="lg" className="h-12 px-7 text-sm font-semibold">
                  <Link href="/products?inStock=true">
                    <span>In-Stock Ready</span>
                  </Link>
                </Button>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-white/15 pt-6 lg:pt-0 lg:pl-10">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[var(--brand-mint)]">
                  <Award className="size-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-white">Inspected Provenance</h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    100% authentic batches from verified creators and ethical fabricators.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[var(--brand-mint)]">
                  <Compass className="size-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-white">Sustainable Materials</h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    Recyclable packaging, natural fibers, and minimal footprint logistics.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[var(--brand-mint)]">
                  <HeartHandshake className="size-5 text-[var(--brand-mint)]" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-white">Guaranteed Satisfaction</h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    7-day effortless returns and dedicated care specialists.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
