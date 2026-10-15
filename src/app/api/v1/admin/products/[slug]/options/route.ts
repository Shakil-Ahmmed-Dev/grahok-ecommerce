import { requireAdmin } from "@/features/auth/middlewares";
import productsActions from "@/features/products/actions";
import { CreateProductOptionSchema, ProductSlugSchema } from "@/features/products/types";
import { created, handleError } from "@/lib/http";

export const POST = async (
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) => {
    try {
        const { slug } = await params;
        await requireAdmin(request.headers);
        const parsedSlug = ProductSlugSchema.parse(slug);
        const body = await request.json();
        const input = CreateProductOptionSchema.parse(body);
        const option = await productsActions.createProductOption(parsedSlug, input);
        return created({ data: option });
    } catch (err) {
        return handleError(err);
    }
};
