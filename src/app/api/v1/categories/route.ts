import categoriesActions from "@/features/categories/actions";
import { handleError, ok } from "@/lib/http";

export const GET = async (request: Request) => {
    try {
        const url = new URL(request.url);
        const format = url.searchParams.get("format");
        if (format === "flat") {
            const list = await categoriesActions.getCategoriesList();
            return ok(list);
        }
        const tree = await categoriesActions.getCategoriesTree();
        return ok(tree);
    } catch (err) {
        return handleError(err);
    }
};
