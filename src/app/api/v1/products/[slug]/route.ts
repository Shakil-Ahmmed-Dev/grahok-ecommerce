import productsActions from "@/features/products/actions";
import { requireAdmin } from "@/features/auth/middlewares";
import { ProductSlugSchema, UpdateProductSchema } from "@/features/products/types";
import { handleError, ok } from "@/lib/http";

export const GET = async (
    _request: Request,
    { params }: { params: Promise<{ slug: string }> }
) => {
    try {
        const { slug } = await params;
        const parsedSlug = ProductSlugSchema.parse(slug);
        const product = await productsActions.getProductBySlug(parsedSlug);
        return ok(product);
    } catch (err) {
        return handleError(err);
    }
};

export const PATCH = async (
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) => {
    try {
        const { slug } = await params;
        await requireAdmin(request.headers);
        const parsedSlug = ProductSlugSchema.parse(slug);
        const updateProductOutput = UpdateProductSchema.shape.data.parse(await request.json());
        const product = await productsActions.updateProductBySlug(parsedSlug, updateProductOutput);
        return ok(product);
    } catch (err) {
        return handleError(err);
    }
};

export const DELETE = async (
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) => {
    try {
        const { slug } = await params;
        await requireAdmin(request.headers);
        const parsedSlug = ProductSlugSchema.parse(slug);
        const product = await productsActions.deleteProductBySlug(parsedSlug);
        return ok(product);
    } catch (err) {
        return handleError(err);
    }
};
