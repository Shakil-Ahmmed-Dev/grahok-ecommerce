import Link from "next/link";
import { ChevronRight, PackageSearch } from "lucide-react";
import { ProductCard } from "@/components/catalog/product-card";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { SortSelect } from "@/components/catalog/sort-select";
import { Pagination } from "@/components/catalog/pagination";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import productsActions from "@/features/products/actions";
import categoriesActions from "@/features/categories/actions";
import type { TCategoryTreeNode } from "@/features/categories/types";

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function findCategoryBySlug(
  tree: TCategoryTreeNode[],
  slug: string
): TCategoryTreeNode | null {
  for (const cat of tree) {
    if (cat.slug === slug) return cat;
    if (cat.children?.length) {
      const found = findCategoryBySlug(cat.children, slug);
      if (found) return found;
    }
  }
  return null;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const search = await searchParams;

  const searchQuery =
    (typeof search.search === "string" ? search.search.trim() : undefined) ||
    (typeof search.q === "string" ? search.q.trim() : undefined);
  const categorySlug = typeof search.category === "string" ? search.category.trim() : undefined;
  const minPrice = typeof search.minPrice === "string" ? search.minPrice.trim() : undefined;
  const maxPrice = typeof search.maxPrice === "string" ? search.maxPrice.trim() : undefined;
  const inStock = typeof search.inStock === "string" ? search.inStock.trim() : undefined;
  const sortBy =
    typeof search.sortBy === "string"
      ? (search.sortBy as "createdAt" | "publishedAt" | "sellPrice" | "name")
      : "publishedAt";
  const sortOrder =
    typeof search.sortOrder === "string" && (search.sortOrder === "asc" || search.sortOrder === "desc")
      ? search.sortOrder
      : "desc";
  const page = typeof search.page === "string" ? Math.max(1, parseInt(search.page, 10) || 1) : 1;

  const [categories, productsResult] = await Promise.all([
    categoriesActions.getCategoriesTree().catch(() => []),
    productsActions
      .getProducts({
        page,
        pageSize: 12,
        search: searchQuery || undefined,
        category: categorySlug || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        inStock: inStock === "true" ? true : undefined,
        sortBy,
        sortOrder,
        includeFacets: true,
      })
      .catch((err) => {
        console.error("Failed to load products:", err);
        return {
          data: [],
          meta: {
            page: 1,
            pageSize: 12,
            total: 0,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
          facets: {
            categories: [],
            tags: [],
            options: [],
            priceRange: { min: 0, max: 0 },
          },
        };
      }),
  ]);

  const products = productsResult.data || [];
  const meta = productsResult.meta;
  const facets = productsResult.facets;

  const activeCategory = categorySlug
    ? findCategoryBySlug(categories, categorySlug)
    : null;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Breadcrumb Trail (.agents/DESIGN.md Section 4 Breadcrumb) */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[rgba(0,0,0,0.58)] mb-8">
        <Link href="/" className="hover:text-[var(--brand-accent)] transition-colors">
          Home
        </Link>
        <ChevronRight className="size-3 text-[rgba(0,0,0,0.4)]" />
        <Link
          href="/products"
          className={!activeCategory && !searchQuery ? "font-bold text-[var(--brand-green)]" : "hover:text-[var(--brand-accent)] transition-colors"}
        >
          Catalog
        </Link>
        {activeCategory && (
          <>
            <ChevronRight className="size-3 text-[rgba(0,0,0,0.4)]" />
            <span className="font-bold text-[var(--brand-green)]">{activeCategory.name}</span>
          </>
        )}
        {searchQuery && (
          <>
            <ChevronRight className="size-3 text-[rgba(0,0,0,0.4)]" />
            <span className="font-bold text-[var(--brand-green)]">Search: &ldquo;{searchQuery}&rdquo;</span>
          </>
        )}
      </nav>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
        {/* Faceted Filters Sidebar */}
        <CatalogFilters
          categories={categories}
          facets={facets}
          selectedCategory={categorySlug}
          minPrice={minPrice}
          maxPrice={maxPrice}
          inStock={inStock}
        />

        {/* Catalog Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border)]">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.01em] text-[var(--brand-green)]">
                {activeCategory ? activeCategory.name : searchQuery ? `Search Results for "${searchQuery}"` : "All Catalog Products"}
              </h1>
              <p className="text-xs text-[rgba(0,0,0,0.58)] mt-1.5">
                Showing <strong className="text-[rgba(0,0,0,0.87)] tabular-nums">{products.length}</strong> of{" "}
                <strong className="text-[rgba(0,0,0,0.87)] tabular-nums">{meta.total ?? products.length}</strong> crafted essentials
              </p>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              <SortSelect currentSortBy={sortBy} currentSortOrder={sortOrder} />
            </div>
          </div>

          {/* Product Grid / Empty State */}
          {products.length === 0 ? (
            <div className="py-16">
              <Empty
                icon={<PackageSearch className="size-8 text-[var(--brand-green)]" />}
                title="No products matched your criteria"
                description="Try broadening your search term, resetting price filters, or exploring other departments."
                action={
                  <Button asChild variant="outline">
                    <Link href="/products">Reset All Filters</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              <Pagination
                page={meta.page ?? 1}
                totalPages={meta.totalPages ?? 1}
                hasNextPage={meta.hasNextPage}
                hasPrevPage={meta.hasPrevPage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
