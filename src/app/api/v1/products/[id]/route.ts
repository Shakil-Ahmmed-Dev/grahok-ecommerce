import productsActions from "@/features/products/actions";
import { requireAdmin } from "@/features/auth/middlewares";
import { UpdateProductSchema } from "@/features/products/types";
import { handleError, ok } from "@/lib/http";

export const runtime = "nodejs";

export const PATCH = async (
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) => {
    try {
        const { id } = await params;
        await requireAdmin(request.headers);
        const parsedId = UpdateProductSchema.shape.id.parse(id);
        const updateProductOutput = UpdateProductSchema.shape.data.parse(await request.json());
        const product = await productsActions.updateProduct(parsedId, updateProductOutput);
        return ok(product);
    } catch (err) {
        return handleError(err);
    }
};
