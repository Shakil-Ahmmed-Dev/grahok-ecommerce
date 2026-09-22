import productsActions from "@/features/products/actions";
import { ProductQuerySchema } from "@/features/products/types";
import { parseProductQuery } from "@/features/products/query";
import { handleError, ok } from "@/lib/http";

export const GET = async (request: Request) => {
    try {
        const url = new URL(request.url);
        const query = parseProductQuery(url, ProductQuerySchema);
        const products = await productsActions.getProducts(query);
        return ok(products);
    } catch (err) {
        return handleError(err);
    }
};
