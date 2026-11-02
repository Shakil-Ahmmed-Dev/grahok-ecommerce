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

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function findCategoryBySlug(
  tree: Array<{ id: string; name: string; slug: string; children?: any[] }>,
  slug: string
): { id: string; name: string; slug: string } | null {
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

  // Selected category info for title (recursive lookup for nested subcategories)
  const activeCategory = categorySlug
    ? findCategoryBySlug(categories, categorySlug)
    : null;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <ChevronRight className="size-3.5" />
        <Link
          href="/products"
          className={!activeCategory && !searchQuery ? "font-semibold text-foreground" : "hover:text-foreground transition-colors"}
        >
          Catalog
        </Link>
        {activeCategory && (
          <>
            <ChevronRight className="size-3.5" />
            <span className="font-semibold text-foreground">{activeCategory.name}</span>
          </>
        )}
        {searchQuery && (
          <>
            <ChevronRight className="size-3.5" />
            <span className="font-semibold text-foreground">Search: &ldquo;{searchQuery}&rdquo;</span>
          </>
        )}
      </nav>

      <div className="flex flex-col lg:flex-row gap-8">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {activeCategory ? activeCategory.name : searchQuery ? `Search Results for "${searchQuery}"` : "All Products"}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Showing <strong className="text-foreground tabular-nums">{products.length}</strong> of{" "}
                <strong className="text-foreground tabular-nums">{meta.total ?? products.length}</strong> products
              </p>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              <SortSelect currentSortBy={sortBy} currentSortOrder={sortOrder} />
            </div>
          </div>

          {/* Product Grid / Empty State */}
          {products.length === 0 ? (
            <div className="py-12">
              <Empty
                icon={<PackageSearch className="size-6" />}
                title="No products matched your criteria"
                description="Try broadening your search, resetting price ranges, or clearing category filters."
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
