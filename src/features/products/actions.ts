import { GetProductsPublicSchema, GetProductsSchema, type TCreateProductOutput, type TGetProducts, type TGetProductsPublic, type TProductModel, type TUpdateProductOutput } from "./types";
import { NotFoundError } from "@/lib/error";
import { db } from "@/lib/drizzle";
import { productsTable } from "@/lib/drizzle/schemas/public";
import { eq } from "drizzle-orm";

const getProducts = async (pagination: {
    page: number;
    pageSize: number;
}): Promise<TGetProductsPublic> => {
    const products = await db.query.productsTable.findMany({
        where: (product, { eq }) => {
            return eq(product.isActive, true);
        },
        orderBy: (product, { desc }) => {
            return [desc(product.createdAt)];
        },
        offset: (pagination.page - 1) * pagination.pageSize,
        limit: pagination.pageSize,
        columns: {
            purchasePrice: false,
            isActive: false,
            createdAt: false,
            updatedAt: false,
        }
    });
    return GetProductsPublicSchema.parse(products);
};

const getAdminProducts = async (pagination: {
    page: number;
    pageSize: number;
}): Promise<TGetProducts> => {
    const products = await db.query.productsTable.findMany({
        orderBy: (product, { desc }) => {
            return [desc(product.createdAt)];
        },
        offset: (pagination.page - 1) * pagination.pageSize,
        limit: pagination.pageSize,
    });
    return GetProductsSchema.parse(products);
};

const createProduct = async (data: TCreateProductOutput): Promise<TProductModel> => {
    const [product] = await db.insert(productsTable).values(data).returning();
    return product;
};

const updateProduct = async (id: TUpdateProductOutput["id"], data: TUpdateProductOutput["data"]): Promise<TProductModel> => {
    const existingProduct = await db.query.productsTable.findFirst({
        where: (product, { eq }) => {
            return eq(product.id, id);
        },
    });
    if (existingProduct) {
        const [product] = await db.update(productsTable)
            .set(data)
            .where(eq(productsTable.id, id))
            .returning();

        return product;
    }
    throw new NotFoundError("Product not found");
};

const productsActions = {
    getProducts,
    getAdminProducts,
    createProduct,
    updateProduct,
};

export default productsActions;
