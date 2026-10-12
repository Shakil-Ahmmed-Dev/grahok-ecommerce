import categoriesActions from "@/features/categories/actions";
import { CategorySlugSchema } from "@/features/categories/types";
import { handleError, ok } from "@/lib/http";

export const GET = async (
    _request: Request,
    { params }: { params: Promise<{ slug: string }> }
) => {
    try {
        const { slug } = await params;
        const parsedSlug = CategorySlugSchema.parse(slug);
        const category = await categoriesActions.getCategoryBySlug(parsedSlug);
        return ok(category);
    } catch (err) {
        return handleError(err);
    }
};
