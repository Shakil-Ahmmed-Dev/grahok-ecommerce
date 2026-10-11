import productsActions from "@/features/products/actions";
import { SuggestQuerySchema } from "@/features/products/types";
import { handleError, ok } from "@/lib/http";

export const GET = async (request: Request) => {
    try {
        const url = new URL(request.url);
        const q = url.searchParams.get("q") ?? url.searchParams.get("search") ?? "";
        const limit = url.searchParams.get("limit") ?? undefined;
        const query = SuggestQuerySchema.parse({ q, limit });
        const suggestions = await productsActions.suggestProducts(query);
        return ok(suggestions);
    } catch (err) {
        return handleError(err);
    }
};
