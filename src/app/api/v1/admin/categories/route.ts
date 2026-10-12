import categoriesActions from "@/features/categories/actions";
import { requireAdmin } from "@/features/auth/middlewares";
import { CreateCategorySchema } from "@/features/categories/types";
import { created, handleError, ok } from "@/lib/http";

export const GET = async (request: Request) => {
    try {
        await requireAdmin(request.headers);
        const categories = await categoriesActions.getCategoriesList();
        return ok(categories);
    } catch (err) {
        return handleError(err);
    }
};

export const POST = async (request: Request) => {
    try {
        await requireAdmin(request.headers);
        const categoryData = CreateCategorySchema.parse(await request.json());
        const category = await categoriesActions.createCategory(categoryData);
        return created(category);
    } catch (err) {
        return handleError(err);
    }
};
