import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, PackageSearch } from "lucide-react";
import { ProductCard } from "@/components/catalog/product-card";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { SortSelect } from "@/components/catalog/sort-select";
import { Pagination } from "@/components/catalog/pagination";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import categoriesActions from "@/features/categories/actions";
import productsActions from "@/features/products/actions";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { slug } = await params;
  const search = await searchParams;

  let category;
  try {
    category = await categoriesActions.getCategoryBySlug(slug);
  } catch {
    notFound();
  }

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
        category: slug,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        inStock: inStock === "true" ? true : undefined,
        sortBy,
        sortOrder,
        includeFacets: true,
      })
      .catch(() => ({
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
      })),
  ]);

  const products = productsResult.data || [];
  const meta = productsResult.meta;
  const facets = productsResult.facets;

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[rgba(0,0,0,0.58)] mb-8">
        <Link href="/" className="hover:text-[var(--brand-accent)] transition-colors">
          Home
        </Link>
        <ChevronRight className="size-3 text-[rgba(0,0,0,0.4)]" />
        <Link href="/products" className="hover:text-[var(--brand-accent)] transition-colors">
          Catalog
        </Link>
        {category.breadcrumbs?.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1.5">
            <ChevronRight className="size-3 text-[rgba(0,0,0,0.4)]" />
            <Link
              href={`/categories/${crumb.slug}`}
              className={crumb.slug === slug ? "font-bold text-[var(--brand-green)]" : "hover:text-[var(--brand-accent)] transition-colors"}
            >
              {crumb.name}
            </Link>
          </span>
        ))}
      </nav>

      {/* Category Banner Card */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-6 sm:p-10 mb-10 shadow-starbucks-card">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-accent)]">
          Department
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--brand-green)] mt-1">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-2 text-sm text-[rgba(0,0,0,0.65)] max-w-2xl leading-relaxed">
            {category.description}
          </p>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
        {/* Faceted Filters Sidebar */}
        <CatalogFilters
          categories={categories}
          facets={facets}
          selectedCategory={slug}
          minPrice={minPrice}
          maxPrice={maxPrice}
          inStock={inStock}
        />

        {/* Category Main Grid */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between pb-6 border-b border-[var(--border)]">
            <p className="text-xs text-[rgba(0,0,0,0.58)]">
              Showing <strong className="text-[rgba(0,0,0,0.87)] tabular-nums">{products.length}</strong> of{" "}
              <strong className="text-[rgba(0,0,0,0.87)] tabular-nums">{meta.total ?? products.length}</strong> department items
            </p>
            <SortSelect currentSortBy={sortBy} currentSortOrder={sortOrder} />
          </div>

          {products.length === 0 ? (
            <div className="py-16">
              <Empty
                icon={<PackageSearch className="size-8 text-[var(--brand-green)]" />}
                title={`No products currently found in ${category.name}`}
                description="Check back soon as new small-batch inventory is frequently added, or browse our other collections."
                action={
                  <Button asChild variant="outline">
                    <Link href="/products">Browse All Catalog</Link>
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
