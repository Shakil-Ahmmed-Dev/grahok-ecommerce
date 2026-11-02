import Link from "next/link";
import { ArrowRight, Sparkles, ShieldCheck, Truck, Headphones, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/catalog/product-card";
import { Empty } from "@/components/ui/empty";
import categoriesActions from "@/features/categories/actions";
import productsActions from "@/features/products/actions";

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
    <div className="flex flex-col gap-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-radial from-orange-50/50 via-background to-background border-b border-border/60 py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/60 bg-orange-50/60 px-3 py-1 text-xs font-semibold text-orange-800 w-fit">
              <Sparkles className="size-3.5 text-[var(--saffron)]" />
              <span>Modern Bengal Craft & Commerce</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
              Curated everyday goods, delivered to your door.
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Discover thoughtfully designed essentials, tactile textiles, artisanal craft,
              and contemporary utilities. Fast nationwide doorstep delivery with 100% encrypted
              order protection.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button asChild size="lg" className="h-12 px-8 text-sm font-semibold">
                <Link href="/products">
                  Explore Catalog
                  <ArrowRight className="size-4 ml-1.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-8 text-sm">
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
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Shop by Category
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Explore curated departments built for functional elegance.
              </p>
            </div>
            <Link
              href="/products"
              className="hidden sm:flex items-center gap-1 text-sm font-semibold text-primary hover:text-[var(--saffron)] transition-colors"
            >
              <span>View all</span>
              <ChevronRight className="size-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {topCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 hover:border-foreground/30 hover:shadow-sm transition-all duration-200"
              >
                <div>
                  <h3 className="font-semibold text-sm text-foreground group-hover:text-[var(--saffron)] transition-colors">
                    {cat.name}
                  </h3>
                  {cat.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {cat.description}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex items-center text-xs font-medium text-muted-foreground group-hover:text-foreground">
                  <span>Browse</span>
                  <ArrowRight className="size-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured / Trending Products */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Trending Essentials
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Popular picks handcrafted and tested for durability and everyday utility.
            </p>
          </div>
          <Link
            href="/products"
            className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-[var(--saffron)] transition-colors"
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

      {/* Quality Promise Banner */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-muted/40 p-8 sm:p-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
            <div className="flex flex-col items-center md:items-start gap-3">
              <div className="size-10 rounded-lg bg-background border flex items-center justify-center">
                <Truck className="size-5 text-[var(--saffron)]" />
              </div>
              <h3 className="font-semibold text-foreground">Nationwide Reach</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Direct doorstep fulfillment across all 64 districts with end-to-end tracking.
              </p>
            </div>

            <div className="flex flex-col items-center md:items-start gap-3">
              <div className="size-10 rounded-lg bg-background border flex items-center justify-center">
                <ShieldCheck className="size-5 text-[var(--saffron)]" />
              </div>
              <h3 className="font-semibold text-foreground">Verified Authentic</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every single item undergoes strict quality inspection before dispatch.
              </p>
            </div>

            <div className="flex flex-col items-center md:items-start gap-3">
              <div className="size-10 rounded-lg bg-background border flex items-center justify-center">
                <Headphones className="size-5 text-[var(--saffron)]" />
              </div>
              <h3 className="font-semibold text-foreground">Dedicated Support</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Reach our customer care team anytime for orders, exchanges, and inquiries.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
