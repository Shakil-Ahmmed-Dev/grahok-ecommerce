import { requireAdmin } from "@/features/auth/middlewares";
import productsActions from "@/features/products/actions";
import { ProductSlugSchema, UpdateProductVariantSchema, VariantIdSchema } from "@/features/products/types";
import { handleError, ok } from "@/lib/http";

export const PUT = async (
    request: Request,
    { params }: { params: Promise<{ slug: string; variantId: string }> }
) => {
    try {
        const { slug, variantId } = await params;
        await requireAdmin(request.headers);
        const parsedSlug = ProductSlugSchema.parse(slug);
        const parsedVariantId = VariantIdSchema.parse(variantId);
        const variantInput = UpdateProductVariantSchema.parse(await request.json());
        const variant = await productsActions.updateVariant(parsedSlug, parsedVariantId, variantInput);
        return ok({ data: variant });
    } catch (err) {
        return handleError(err);
    }
};

export const DELETE = async (
    request: Request,
    { params }: { params: Promise<{ slug: string; variantId: string }> }
) => {
    try {
        const { slug, variantId } = await params;
        await requireAdmin(request.headers);
        const parsedSlug = ProductSlugSchema.parse(slug);
        const parsedVariantId = VariantIdSchema.parse(variantId);
        await productsActions.deleteVariant(parsedSlug, parsedVariantId);
        return ok({ success: true, message: "Variant deleted successfully" });
    } catch (err) {
        return handleError(err);
    }
};
