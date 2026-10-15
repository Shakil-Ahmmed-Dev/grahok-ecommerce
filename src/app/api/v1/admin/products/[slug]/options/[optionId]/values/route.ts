import { requireAdmin } from "@/features/auth/middlewares";
import productsActions from "@/features/products/actions";
import { CreateOptionValueSchema, ProductSlugSchema } from "@/features/products/types";
import { created, handleError } from "@/lib/http";

export const POST = async (
    request: Request,
    { params }: { params: Promise<{ slug: string; optionId: string }> }
) => {
    try {
        const { slug, optionId } = await params;
        await requireAdmin(request.headers);
        const parsedSlug = ProductSlugSchema.parse(slug);
        const body = await request.json();
        const input = CreateOptionValueSchema.parse(body);
        const value = await productsActions.createOptionValue(parsedSlug, optionId, input);
        return created({ data: value });
    } catch (err) {
        return handleError(err);
    }
};
