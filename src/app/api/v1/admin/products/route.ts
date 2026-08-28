import productsActions from "@/features/products/actions";
import { requireAdmin } from "@/features/auth/middlewares";
import { AdminProductQuerySchema } from "@/features/products/types";
import { parseProductQuery } from "@/features/products/query";
import { handleError, ok } from "@/lib/http";

export const GET = async (request: Request) => {
    try {
        await requireAdmin(request.headers);
        const url = new URL(request.url);
        const query = parseProductQuery(url, AdminProductQuerySchema);
        const products = await productsActions.getAdminProducts(query);
        return ok(products);
    } catch (err) {
        return handleError(err);
    }
};
