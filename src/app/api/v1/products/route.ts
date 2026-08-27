import productsActions from "@/features/products/actions";
import { requireAdmin } from "@/features/auth/middlewares";
import { CreateProductSchema, ProductPaginationSchema } from "@/features/products/types";
import { created, handleError, ok } from "@/lib/http";

export const runtime = "nodejs";

export const GET = async (request: Request) => {
    try {
        const url = new URL(request.url);
        const query = ProductPaginationSchema.parse(
            Object.fromEntries(url.searchParams)
        );
        const { page, pageSize } = query;
        const products = await productsActions.getProducts({ page, pageSize });
        return ok(products);
    } catch (err) {
        return handleError(err);
    }
};

export const POST = async (request: Request) => {
    try {
        await requireAdmin(request.headers);
        const productData = CreateProductSchema.parse(await request.json());
        const product = await productsActions.createProduct(productData);
        return created(product);
    } catch (err) {
        return handleError(err);
    }
};
