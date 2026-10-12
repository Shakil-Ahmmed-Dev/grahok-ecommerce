import categoriesActions from "@/features/categories/actions";
import { requireAdmin } from "@/features/auth/middlewares";
import { CategorySlugSchema, UpdateCategorySchema } from "@/features/categories/types";
import { handleError, ok } from "@/lib/http";

export const GET = async (
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) => {
    try {
        await requireAdmin(request.headers);
        const { slug } = await params;
        const parsedSlug = CategorySlugSchema.parse(slug);
        const category = await categoriesActions.getCategoryBySlug(parsedSlug);
        return ok(category);
    } catch (err) {
        return handleError(err);
    }
};

export const PATCH = async (
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) => {
    try {
        await requireAdmin(request.headers);
        const { slug } = await params;
        const parsedSlug = CategorySlugSchema.parse(slug);
        const updateData = UpdateCategorySchema.shape.data.parse(await request.json());
        const updatedCategory = await categoriesActions.updateCategoryBySlug(parsedSlug, updateData);
        return ok(updatedCategory);
    } catch (err) {
        return handleError(err);
    }
};

export const DELETE = async (
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) => {
    try {
        await requireAdmin(request.headers);
        const { slug } = await params;
        const parsedSlug = CategorySlugSchema.parse(slug);
        const deletedCategory = await categoriesActions.deleteCategoryBySlug(parsedSlug);
        return ok(deletedCategory);
    } catch (err) {
        return handleError(err);
    }
};
