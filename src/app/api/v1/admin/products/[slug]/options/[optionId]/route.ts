import { requireAdmin } from "@/features/auth/middlewares";
import productsActions from "@/features/products/actions";
import { ProductSlugSchema, UpdateProductOptionSchema } from "@/features/products/types";
import { handleError, ok } from "@/lib/http";

export const PUT = async (
    request: Request,
    { params }: { params: Promise<{ slug: string; optionId: string }> }
) => {
    try {
        const { slug, optionId } = await params;
        await requireAdmin(request.headers);
        const parsedSlug = ProductSlugSchema.parse(slug);
        const body = await request.json();
        const input = UpdateProductOptionSchema.parse(body);
        const updated = await productsActions.updateProductOption(parsedSlug, optionId, input);
        return ok({ data: updated });
    } catch (err) {
        return handleError(err);
    }
};

export const DELETE = async (
    request: Request,
    { params }: { params: Promise<{ slug: string; optionId: string }> }
) => {
    try {
        const { slug, optionId } = await params;
        await requireAdmin(request.headers);
        const parsedSlug = ProductSlugSchema.parse(slug);
        await productsActions.deleteProductOption(parsedSlug, optionId);
        return ok({ success: true, message: "Product option deleted successfully" });
    } catch (err) {
        return handleError(err);
    }
};
