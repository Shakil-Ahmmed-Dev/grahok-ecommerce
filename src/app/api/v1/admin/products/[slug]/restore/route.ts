import productsActions from "@/features/products/actions";
import { requireAdmin } from "@/features/auth/middlewares";
import { ProductSlugSchema } from "@/features/products/types";
import { handleError, ok } from "@/lib/http";

export const POST = async (
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) => {
    try {
        const { slug } = await params;
        await requireAdmin(request.headers);
        const parsedSlug = ProductSlugSchema.parse(slug);
        const product = await productsActions.restoreProductBySlug(parsedSlug);
        return ok(product);
    } catch (err) {
        return handleError(err);
    }
};
