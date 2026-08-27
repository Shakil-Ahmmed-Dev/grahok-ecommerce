import productsActions from "@/features/products/actions";
import { requireAdmin } from "@/features/auth/middlewares";
import { ProductPaginationSchema } from "@/features/products/types";
import { handleError, ok } from "@/lib/http";

export const runtime = "nodejs";

export const GET = async (request: Request) => {
    try {
        await requireAdmin(request.headers);
        const url = new URL(request.url);
        const query = ProductPaginationSchema.parse(
            Object.fromEntries(url.searchParams)
        );
        const { page, pageSize } = query;
        const products = await productsActions.getAdminProducts({ page, pageSize });
        return ok(products);
    } catch (err) {
        return handleError(err);
    }
};
