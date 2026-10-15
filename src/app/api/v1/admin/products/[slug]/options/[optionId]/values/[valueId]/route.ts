import { requireAdmin } from "@/features/auth/middlewares";
import productsActions from "@/features/products/actions";
import { ProductSlugSchema, UpdateOptionValueSchema } from "@/features/products/types";
import { handleError, ok } from "@/lib/http";

export const PUT = async (
    request: Request,
    { params }: { params: Promise<{ slug: string; optionId: string; valueId: string }> }
) => {
    try {
        const { slug, optionId, valueId } = await params;
        await requireAdmin(request.headers);
        const parsedSlug = ProductSlugSchema.parse(slug);
        const body = await request.json();
        const input = UpdateOptionValueSchema.parse(body);
        const updated = await productsActions.updateOptionValue(parsedSlug, optionId, valueId, input);
        return ok({ data: updated });
    } catch (err) {
        return handleError(err);
    }
};

export const DELETE = async (
    request: Request,
    { params }: { params: Promise<{ slug: string; optionId: string; valueId: string }> }
) => {
    try {
        const { slug, optionId, valueId } = await params;
        await requireAdmin(request.headers);
        const parsedSlug = ProductSlugSchema.parse(slug);
        await productsActions.deleteOptionValue(parsedSlug, optionId, valueId);
        return ok({ success: true, message: "Option value deleted successfully" });
    } catch (err) {
        return handleError(err);
    }
};
