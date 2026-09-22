import productsActions from "@/features/products/actions";
import { ProductSlugSchema } from "@/features/products/types";
import { handleError, ok } from "@/lib/http";

export const GET = async (
    _request: Request,
    { params }: { params: Promise<{ slug: string }> }
) => {
    try {
        const { slug } = await params;
        const parsedSlug = ProductSlugSchema.parse(slug);
        const product = await productsActions.getProductBySlug(parsedSlug);
        return ok(product);
    } catch (err) {
        return handleError(err);
    }
};
