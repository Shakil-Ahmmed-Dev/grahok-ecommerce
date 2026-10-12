import { requireAdmin } from "@/features/auth/middlewares";
import productsActions from "@/features/products/actions";
import { CreateProductVariantSchema, ProductSlugSchema } from "@/features/products/types";
import { created, handleError } from "@/lib/http";

export const POST = async (
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) => {
    try {
        const { slug } = await params;
        await requireAdmin(request.headers);
        const parsedSlug = ProductSlugSchema.parse(slug);
        const variantInput = CreateProductVariantSchema.parse(await request.json());
        const variant = await productsActions.addVariantToProduct(parsedSlug, variantInput);
        return created({ data: variant });
    } catch (err) {
        return handleError(err);
    }
};
