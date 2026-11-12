import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ArrowRight, Layers, LayoutGrid } from "lucide-react";
import categoriesActions from "@/features/categories/actions";
import { getProductFacets } from "@/features/products/query";
import { ProductImage } from "@/components/ui/product-image";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Categories & Departments | Grahok",
  description:
    "Explore our complete directory of curated everyday goods, textiles, and artisanal wares organized by department.",
};

export default async function CategoriesIndexPage() {
  const [categoriesTree, facets] = await Promise.all([
    categoriesActions.getCategoriesTree().catch(() => []),
    getProductFacets(undefined).catch(() => ({
      categories: [],
      tags: [],
      options: [],
      priceRange: { min: 0, max: 0 },
    })),
  ]);

  // Build lookup for category product counts
  const countMap = new Map<string, number>();
  for (const cat of facets.categories || []) {
    if (cat.slug) {
      countMap.set(cat.slug, cat.count);
    }
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-[rgba(0,0,0,0.58)] mb-8"
      >
        <Link href="/" className="hover:text-[var(--brand-accent)] transition-colors">
          Home
        </Link>
        <ChevronRight className="size-3 text-[rgba(0,0,0,0.4)]" />
        <span className="font-bold text-[var(--brand-green)]">Categories</span>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 mb-10 border-b border-[var(--border)]">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-accent)]">
            Curated Collections
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--brand-green)] mt-1">
            Shop by Department
          </h1>
          <p className="text-sm text-[rgba(0,0,0,0.65)] mt-2 max-w-2xl leading-relaxed">
            Browse our complete roster of thoughtfully crafted everyday necessities, specialty wares,
            and home collections.
          </p>
        </div>

        <Button asChild variant="outline" size="sm" className="self-start sm:self-auto text-xs">
          <Link href="/products" className="flex items-center gap-1.5">
            <LayoutGrid className="size-3.5" />
            <span>Browse Full Catalog</span>
          </Link>
        </Button>
      </div>

      {/* Categories Grid */}
      {categoriesTree.length === 0 ? (
        <Empty
          icon={<Layers className="size-8 text-[var(--brand-accent)]" />}
          title="No Categories Available"
          description="Our collections are currently being refreshed. Please check back shortly or explore the full product catalog."
          action={
            <Button asChild size="sm">
              <Link href="/products">View All Products</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {categoriesTree.map((cat) => {
            const count = countMap.get(cat.slug) || 0;
            const hasChildren = cat.children && cat.children.length > 0;

            return (
              <div
                key={cat.id}
                className="group flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-white overflow-hidden shadow-starbucks-card hover:shadow-starbucks-card-hover hover:border-[var(--brand-green)]/30 transition-all duration-300"
              >
                <div>
                  {/* Category Card Cover */}
                  <Link
                    href={`/categories/${cat.slug}`}
                    className="relative block aspect-16/9 w-full bg-[var(--brand-ceramic)] overflow-hidden"
                  >
                    <ProductImage
                      src={cat.imageUrl}
                      alt={cat.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white">
                      <span className="font-extrabold text-lg tracking-tight drop-shadow-xs">
                        {cat.name}
                      </span>
                      {count > 0 && (
                        <span className="text-[11px] font-semibold bg-white/90 text-[var(--brand-green)] px-2 py-0.5 rounded-full shadow-2xs backdrop-blur-xs">
                          {count} {count === 1 ? "item" : "items"}
                        </span>
                      )}
                    </div>
                  </Link>

                  {/* Body Content */}
                  <div className="p-5 flex flex-col gap-3">
                    <p className="text-xs text-[rgba(0,0,0,0.65)] leading-relaxed line-clamp-2">
                      {cat.description ||
                        `Explore curated ${cat.name.toLowerCase()} selected for durable design, utility, and everyday elegance.`}
                    </p>

                    {/* Subcategories (if any) */}
                    {hasChildren && (
                      <div className="pt-2 flex flex-wrap gap-1.5">
                        {cat.children.map((sub) => {
                          const subCount = countMap.get(sub.slug);
                          return (
                            <Link
                              key={sub.id}
                              href={`/categories/${sub.slug}`}
                              className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-cream)] px-2.5 py-1 text-[11px] font-medium text-[var(--brand-green)] hover:bg-[var(--brand-mint)]/40 hover:text-[var(--brand-accent)] transition-colors"
                            >
                              <span>{sub.name}</span>
                              {subCount != null && subCount > 0 && (
                                <span className="text-[10px] text-[rgba(0,0,0,0.45)]">
                                  ({subCount})
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer action */}
                <div className="px-5 pb-5 pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-xs font-semibold text-[var(--brand-accent)] group-hover:text-[var(--brand-green)] transition-colors">
                  <Link
                    href={`/categories/${cat.slug}`}
                    className="inline-flex items-center gap-1.5 hover:underline"
                  >
                    <span>View {cat.name} Collection</span>
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
