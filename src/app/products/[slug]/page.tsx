import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect, RedirectType } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { ProductGallery } from "@/components/product/product-gallery";
import { VariantSelector } from "@/components/product/variant-selector";
import { ProductCard } from "@/components/catalog/product-card";
import productsActions from "@/features/products/actions";
import { PermanentRedirectError } from "@/lib/error";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await productsActions.getProductBySlug(slug);
    return {
      title: product.name,
      description:
        product.shortDescription ||
        `Buy ${product.name} at Grahok. Fast nationwide doorstep delivery with 100% secure checkout.`,
      openGraph: {
        title: `${product.name} | GRAHOK`,
        description: product.shortDescription || undefined,
        images: product.featuredImageUrl ? [{ url: product.featuredImageUrl }] : [],
      },
    };
  } catch {
    return {
      title: "Product Not Found",
    };
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  let product;
  let relatedProducts = [];

  try {
    const [fetchedProduct, fetchedRelated] = await Promise.all([
      productsActions.getProductBySlug(slug),
      productsActions.getRelatedProducts(slug, 4).catch(() => []),
    ]);
    product = fetchedProduct;
    relatedProducts = fetchedRelated || [];
  } catch (err: unknown) {
    if (err instanceof PermanentRedirectError) {
      redirect(`/products/${err.canonicalSlug}`, RedirectType.replace);
    }
    notFound();
  }

  const primaryCategory = product.categories?.[0];

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <ChevronRight className="size-3.5" />
        <Link href="/products" className="hover:text-foreground transition-colors">
          Catalog
        </Link>
        {primaryCategory && (
          <>
            <ChevronRight className="size-3.5" />
            <Link
              href={`/categories/${primaryCategory.slug}`}
              className="hover:text-foreground transition-colors"
            >
              {primaryCategory.name}
            </Link>
          </>
        )}
        <ChevronRight className="size-3.5" />
        <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-none">
          {product.name}
        </span>
      </nav>

      {/* Main Grid: Gallery + Buy Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        {/* Left Column: Media Gallery */}
        <div className="lg:col-span-7">
          <ProductGallery
            title={product.name}
            featuredImageUrl={product.featuredImageUrl}
            images={product.images}
          />
        </div>

        {/* Right Column: Sticky Buy Box */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div>
            {primaryCategory && (
              <Link
                href={`/categories/${primaryCategory.slug}`}
                className="text-xs font-semibold uppercase tracking-wider text-[var(--saffron)] hover:underline inline-block mb-1.5"
              >
                {primaryCategory.name}
              </Link>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-snug">
              {product.name}
            </h1>
            {product.shortDescription && (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {product.shortDescription}
              </p>
            )}
          </div>

          <VariantSelector product={product} />
        </div>
      </div>

      {/* Product Details & Specifications */}
      {product.description && (
        <div className="mt-16 pt-12 border-t border-border">
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">
              Product Overview & Specifications
            </h2>
            <div className="prose prose-zinc dark:prose-invert text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {product.description}
            </div>
          </div>
        </div>
      )}

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="mt-20 pt-12 border-t border-border">
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6">
            You May Also Like
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((relProduct) => (
              <ProductCard key={relProduct.id} product={relProduct} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
