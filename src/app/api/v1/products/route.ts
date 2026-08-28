import productsActions from "@/features/products/actions";
import { requireAdmin } from "@/features/auth/middlewares";
import { CreateProductSchema, ProductQuerySchema } from "@/features/products/types";
import { parseProductQuery } from "@/features/products/query";
import { created, handleError, ok } from "@/lib/http";

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
