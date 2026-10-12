import productsActions from "@/features/products/actions";
import { ProductSlugSchema, RelatedProductsQuerySchema } from "@/features/products/types";
import { handleError, ok } from "@/lib/http";
import type { NextRequest } from "next/server";

export const GET = async (
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) => {
    try {
        const { slug } = await params;
        const parsedSlug = ProductSlugSchema.parse(slug);

        const url = new URL(request.url);
        const queryParams = {
            limit: url.searchParams.get("limit") ?? undefined,
        };
        const parsedQuery = RelatedProductsQuerySchema.parse(queryParams);

        const relatedProducts = await productsActions.getRelatedProducts(
            parsedSlug,
            parsedQuery.limit
        );

        return ok({ data: relatedProducts });
    } catch (err) {
        return handleError(err);
    }
};
