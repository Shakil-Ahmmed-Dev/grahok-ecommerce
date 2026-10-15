import { requireAdmin } from "@/features/auth/middlewares";
import productsActions from "@/features/products/actions";
import { GenerateMatrixInputSchema, ProductSlugSchema } from "@/features/products/types";
import { created, handleError, ok } from "@/lib/http";

export const POST = async (
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) => {
    try {
        const { slug } = await params;
        await requireAdmin(request.headers);
        const parsedSlug = ProductSlugSchema.parse(slug);
        const body = await request.json();
        const input = GenerateMatrixInputSchema.parse(body);
        const result = await productsActions.generateVariantMatrix(parsedSlug, input);

        if (input.preview) {
            return ok({ data: result });
        }
        return created({ data: result });
    } catch (err) {
        return handleError(err);
    }
};
