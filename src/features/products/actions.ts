import {
    AdminProductsListSchema,
    CreateOptionValueSchema,
    CreateProductOptionSchema,
    CreateProductVariantSchema,
    CreateVariantTypeSchema,
    GenerateMatrixInputSchema,
    GetProductPublicSchema,
    GetProductSchema,
    GetProductsPublicSchema,
    OptionValueItemSchema,
    ProductOptionItemSchema,
    ProductsListSchema,
    ProductSuggestionsSchema,
    ProductVariantSchema,
    UpdateOptionValueSchema,
    UpdateProductOptionSchema,
    UpdateProductVariantSchema,
    UpdateVariantTypeSchema,
    VariantTypeSchema,
    type TAdminProductQuery,
    type TAdminProductsList,
    type TCreateOptionValueInput,
    type TCreateProductOptionInput,
    type TCreateProductOutput,
    type TCreateProductVariantInput,
    type TCreateVariantTypeInput,
    type TGenerateMatrixInput,
    type TGetProduct,
    type TGetProductPublic,
    type TGetProductsPublic,
    type TInventoryType,
    type TOptionValueItem,
    type TPaginationMeta,
    type TProductModel,
    type TProductOptionItem,
    type TProductQuery,
    type TProductsList,
    type TProductSlug,
    type TProductSuggestions,
    type TProductVariant,
    type TSuggestQuery,
    type TUpdateOptionValueInput,
    type TUpdateProductOptionInput,
    type TUpdateProductOutput,
    type TUpdateProductVariantInput,
    type TUpdateVariantTypeInput,
    type TVariantType,
} from "./types";
import { BadRequestError, ConflictError, NotFoundError, PermanentRedirectError } from "@/lib/error";
import { db } from "@/lib/drizzle";
import {
    categoriesTable,
    productCategoriesTable,
    productOptionsTable,
    productOptionValuesTable,
    productsTable,
    productSlugRedirectsTable,
    productVariantsTable,
    variantTypesTable,
    variantTypeValuesTable,
} from "@/lib/drizzle/schemas/public";
import { and, desc, eq, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import {
    buildCursorCondition,
    buildFuzzyOrderBy,
    buildFuzzySearchCondition,
    buildProductConditions,
    buildProductOrderBy,
    buildProductSearchQuery,
    decodeCursor,
    encodeCursor,
    getProductFacets,
    resolveProductSort,
} from "./query";
import { ensureSlug, slugify } from "@/lib/slug";
import { calculateVariantStock, resolveEffectiveInventoryType } from "./inventory";
import { generateCartesianPermutations, normalizeVariantSignature } from "./matrix";
import z from "zod";

const buildPaginationMeta = (
    total: number | undefined,
    page: number | undefined,
    pageSize: number,
    hasNextPage: boolean,
    hasPrevPage: boolean,
    nextCursor?: string | null,
    prevCursor?: string | null
): TPaginationMeta => {
    const totalPages = total !== undefined ? (total === 0 ? 0 : Math.ceil(total / pageSize)) : undefined;
    return {
        ...(page !== undefined ? { page } : {}),
        pageSize,
        ...(total !== undefined ? { total, totalPages } : {}),
        hasNextPage,
        hasPrevPage,
        ...(nextCursor !== undefined ? { nextCursor } : {}),
        ...(prevCursor !== undefined ? { prevCursor } : {}),
    };
};

function mapProductCategories<T extends {
    stock?: string | number;
    poolStock?: string | number;
    inventoryType?: string;
    productCategories?: Array<{ isPrimary: boolean; category: { id: string; name: string; slug: string } }>;
    options?: Array<{
        id: string;
        productId?: string;
        variantTypeId?: string | null;
        name: string;
        position: number;
        values?: Array<{
            id: string;
            optionId?: string;
            value: string;
            position: number;
            swatchMeta?: string | null;
        }>;
    }>;
    variants?: Array<{
        id: string;
        productId: string;
        title: string;
        sku: string;
        optionValues?: Record<string, string> | null;
        signature?: string;
        inventoryType?: string | null;
        purchasePrice?: string | number;
        sellPrice: string | number;
        stock?: string | number | null;
        poolConsumptionRate?: string | number | null;
        isDefault: boolean;
        isActive: boolean;
        imageUrl: string | null;
        createdAt?: Date | string;
        updatedAt?: Date | string;
    }>;
}>(product: T) {
    const { productCategories, options, variants, ...rest } = product;
    const prodInvType = (product.inventoryType ?? "discrete") as TInventoryType;
    const masterPoolStock = Number(product.poolStock ?? 0);

    return {
        ...rest,
        stock: Number(product.stock ?? 0),
        poolStock: Number(product.poolStock ?? 0),
        categories: (productCategories ?? []).map((pc) => ({
            id: pc.category.id,
            name: pc.category.name,
            slug: pc.category.slug,
            isPrimary: pc.isPrimary,
        })),
        options: (options ?? []).map((opt) => ({
            id: opt.id,
            productId: opt.productId,
            variantTypeId: opt.variantTypeId ?? null,
            name: opt.name,
            position: Number(opt.position ?? 0),
            values: (opt.values ?? []).map((v) => ({
                id: v.id,
                optionId: v.optionId,
                value: v.value,
                position: Number(v.position ?? 0),
                swatchMeta: v.swatchMeta ?? null,
            })),
        })),
        variants: (variants ?? []).map((v) => {
            const rawStock = v.stock != null ? Number(v.stock) : 0;
            const effectiveInvType = resolveEffectiveInventoryType(
                v.inventoryType as TInventoryType | null | undefined,
                prodInvType
            );
            const stockResult = calculateVariantStock({
                masterPoolStock,
                inventoryType: effectiveInvType,
                variantStock: rawStock,
                poolConsumptionRate: v.poolConsumptionRate != null ? Number(v.poolConsumptionRate) : null,
            });

            return {
                ...v,
                optionValues: (v.optionValues && typeof v.optionValues === "object") ? v.optionValues : {},
                signature: v.signature || normalizeVariantSignature(v.optionValues),
                inventoryType: effectiveInvType,
                sellPrice: Number(v.sellPrice),
                stock: stockResult.stock,
                isUnlimited: stockResult.isUnlimited,
                ...(v.poolConsumptionRate != null ? { poolConsumptionRate: Number(v.poolConsumptionRate) } : {}),
                ...(v.purchasePrice !== undefined ? { purchasePrice: Number(v.purchasePrice) } : {}),
            };
        }),
    };
}

export const syncProductAggregateReadModel = async (
    executor: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
    productId: string
): Promise<void> => {
    const product = await executor.query.productsTable.findFirst({
        where: (p, { eq }) => eq(p.id, productId),
        columns: { id: true, inventoryType: true, stock: true, poolStock: true },
    });
    if (!product) return;

    const activeVariants = await executor.query.productVariantsTable.findMany({
        where: (v, { eq, and, isNull }) => and(
            eq(v.productId, productId),
            eq(v.isActive, true),
            isNull(v.deletedAt)
        ),
        columns: { sellPrice: true, stock: true, isDefault: true, inventoryType: true, poolConsumptionRate: true },
    });

    if (activeVariants.length === 0) return;

    const minSellPrice = Math.min(...activeVariants.map((v) => Number(v.sellPrice)));

    const updateFields: { sellPrice: number; stock?: number } = {
        sellPrice: minSellPrice,
    };

    if (product.inventoryType === "discrete") {
        const totalDiscreteStock = activeVariants.reduce((sum, v) => {
            const effectiveType = resolveEffectiveInventoryType(v.inventoryType, product.inventoryType);
            if (effectiveType === "discrete") {
                return sum + Number(v.stock);
            }
            return sum;
        }, 0);
        updateFields.stock = totalDiscreteStock;
    }

    await executor
        .update(productsTable)
        .set(updateFields)
        .where(eq(productsTable.id, productId));
};

export const createVariantType = async (input: TCreateVariantTypeInput): Promise<TVariantType> => {
    const parsed = CreateVariantTypeSchema.parse(input);

    const existing = await db.query.variantTypesTable.findFirst({
        where: (vt, { eq }) => eq(vt.code, parsed.code),
        columns: { id: true },
    });
    if (existing) {
        throw new ConflictError(`Variant type with code '${parsed.code}' already exists`);
    }

    const { values, ...typeData } = parsed;

    return await db.transaction(async (tx) => {
        const [insertedType] = await tx.insert(variantTypesTable).values({
            ...typeData,
        }).returning();

        let insertedValues: Array<{
            id: string;
            variantTypeId: string;
            value: string;
            position: number;
            swatchMeta: string | null;
            defaultConsumptionRate: number | null;
            createdAt: Date;
            updatedAt: Date;
        }> = [];

        if (values && values.length > 0) {
            insertedValues = await tx.insert(variantTypeValuesTable).values(
                values.map((v, idx) => ({
                    variantTypeId: insertedType.id,
                    value: v.value,
                    position: v.position ?? idx,
                    swatchMeta: v.swatchMeta ?? null,
                    defaultConsumptionRate: v.defaultConsumptionRate != null ? Number(v.defaultConsumptionRate) : null,
                }))
            ).returning();
        }

        return VariantTypeSchema.parse({
            ...insertedType,
            values: insertedValues,
        });
    });
};

export const getVariantTypes = async (): Promise<TVariantType[]> => {
    const types = await db.query.variantTypesTable.findMany({
        orderBy: (vt, { asc }) => [asc(vt.position), asc(vt.createdAt)],
        with: {
            values: {
                orderBy: (v, { asc }) => [asc(v.position), asc(v.createdAt)],
            },
        },
    });

    return z.array(VariantTypeSchema).parse(types);
};

export const getVariantTypeById = async (id: string): Promise<TVariantType> => {
    const variantType = await db.query.variantTypesTable.findFirst({
        where: (vt, { eq }) => eq(vt.id, id),
        with: {
            values: {
                orderBy: (v, { asc }) => [asc(v.position), asc(v.createdAt)],
            },
        },
    });

    if (!variantType) {
        throw new NotFoundError("Variant type not found");
    }

    return VariantTypeSchema.parse(variantType);
};

export const updateVariantType = async (id: string, input: TUpdateVariantTypeInput): Promise<TVariantType> => {
    const parsed = UpdateVariantTypeSchema.parse(input);

    const existing = await db.query.variantTypesTable.findFirst({
        where: (vt, { eq }) => eq(vt.id, id),
    });
    if (!existing) {
        throw new NotFoundError("Variant type not found");
    }

    if (parsed.code && parsed.code !== existing.code) {
        const codeTaken = await db.query.variantTypesTable.findFirst({
            where: (vt, { eq, and, ne }) => and(eq(vt.code, parsed.code!), ne(vt.id, id)),
            columns: { id: true },
        });
        if (codeTaken) {
            throw new ConflictError(`Variant type with code '${parsed.code}' already exists`);
        }
    }

    const { values, ...typeData } = parsed;

    return await db.transaction(async (tx) => {
        if (Object.keys(typeData).length > 0) {
            await tx.update(variantTypesTable)
                .set(typeData)
                .where(eq(variantTypesTable.id, id));
        }

        if (values !== undefined) {
            const incomingIds = values.map((v) => v.id).filter(Boolean) as string[];
            if (incomingIds.length > 0) {
                await tx.delete(variantTypeValuesTable).where(
                    and(
                        eq(variantTypeValuesTable.variantTypeId, id),
                        sql`${variantTypeValuesTable.id} NOT IN (${sql.join(incomingIds.map((idVal) => sql`${idVal}`), sql`, `)})`
                    )
                );
            } else {
                await tx.delete(variantTypeValuesTable).where(eq(variantTypeValuesTable.variantTypeId, id));
            }

            for (let idx = 0; idx < values.length; idx++) {
                const val = values[idx];
                if (val.id) {
                    await tx.update(variantTypeValuesTable).set({
                        value: val.value,
                        position: val.position ?? idx,
                        swatchMeta: val.swatchMeta ?? null,
                        defaultConsumptionRate: val.defaultConsumptionRate != null ? Number(val.defaultConsumptionRate) : null,
                    }).where(and(eq(variantTypeValuesTable.id, val.id), eq(variantTypeValuesTable.variantTypeId, id)));
                } else if (val.value) {
                    await tx.insert(variantTypeValuesTable).values({
                        variantTypeId: id,
                        value: val.value,
                        position: val.position ?? idx,
                        swatchMeta: val.swatchMeta ?? null,
                        defaultConsumptionRate: val.defaultConsumptionRate != null ? Number(val.defaultConsumptionRate) : null,
                    });
                }
            }
        }

        const updated = await tx.query.variantTypesTable.findFirst({
            where: (vt, { eq }) => eq(vt.id, id),
            with: {
                values: {
                    orderBy: (v, { asc }) => [asc(v.position), asc(v.createdAt)],
                },
            },
        });

        return VariantTypeSchema.parse(updated);
    });
};

export const deleteVariantType = async (id: string): Promise<{ success: boolean }> => {
    const existing = await db.query.variantTypesTable.findFirst({
        where: (vt, { eq }) => eq(vt.id, id),
        columns: { id: true },
    });
    if (!existing) {
        throw new NotFoundError("Variant type not found");
    }

    await db.delete(variantTypesTable).where(eq(variantTypesTable.id, id));
    return { success: true };
};

export const getProducts = async (query: TProductQuery): Promise<TProductsList> => {
    const searchQuery = buildProductSearchQuery(query.search);
    const effectiveSort = resolveProductSort(query);
    const orderBy = buildProductOrderBy(effectiveSort, query.sortOrder, searchQuery);

    let cursorCondition: SQL | null = null;
    let decodedCursor: { createdAt: Date; id: string } | null = null;
    if (query.cursor) {
        decodedCursor = decodeCursor(query.cursor);
        if (!decodedCursor) {
            throw new BadRequestError("Invalid cursor provided");
        }
        cursorCondition = buildCursorCondition(decodedCursor, query.sortOrder);
    }

    const baseConditions = buildProductConditions(query, "public", searchQuery);
    const queryConditions = buildProductConditions(query, "public", searchQuery, cursorCondition);

    const isCursorMode = Boolean(query.cursor);
    const limit = query.pageSize + 1;
    const offset = isCursorMode ? undefined : (query.page - 1) * query.pageSize;
    const shouldComputeFacets = query.includeFacets ?? (query.page === 1 && !isCursorMode && query.pageSize >= 10);

    let [rawProducts, total, facets] = await Promise.all([
        db.query.productsTable.findMany({
            where: queryConditions,
            orderBy,
            offset,
            limit,
            columns: {
                updatedAt: false,
                deletedAt: false,
                searchVector: false,
            },
            with: {
                productCategories: {
                    with: {
                        category: true,
                    },
                },
            },
        }),
        isCursorMode ? Promise.resolve(undefined) : db.$count(productsTable, baseConditions),
        shouldComputeFacets ? getProductFacets(baseConditions) : Promise.resolve(undefined),
    ]);

    if (query.search && rawProducts.length === 0 && (!total || total === 0)) {
        const fuzzyCondition = buildFuzzySearchCondition(query.search);
        if (fuzzyCondition) {
            const fuzzyBaseConditions = buildProductConditions(query, "public", null, null, fuzzyCondition);
            const fuzzyQueryConditions = buildProductConditions(query, "public", null, cursorCondition, fuzzyCondition);
            const fuzzyOrderBy = effectiveSort === "relevance"
                ? buildFuzzyOrderBy(query.search, query.sortOrder)
                : orderBy;

            const [fuzzyRawProducts, fuzzyTotal, fuzzyFacets] = await Promise.all([
                db.query.productsTable.findMany({
                    where: fuzzyQueryConditions,
                    orderBy: fuzzyOrderBy,
                    offset,
                    limit,
                    columns: {
                        updatedAt: false,
                        deletedAt: false,
                        searchVector: false,
                    },
                    with: {
                        productCategories: {
                            with: {
                                category: true,
                            },
                        },
                    },
                }),
                isCursorMode ? Promise.resolve(undefined) : db.$count(productsTable, fuzzyBaseConditions),
                shouldComputeFacets ? getProductFacets(fuzzyBaseConditions) : Promise.resolve(undefined),
            ]);

            if (fuzzyRawProducts.length > 0) {
                rawProducts = fuzzyRawProducts;
                total = fuzzyTotal;
                if (fuzzyFacets) {
                    facets = fuzzyFacets;
                }
            }
        }
    }

    const hasNextPage = rawProducts.length > query.pageSize;
    const products = hasNextPage ? rawProducts.slice(0, query.pageSize) : rawProducts;
    const hasPrevPage = isCursorMode ? true : query.page > 1;

    const lastProduct = products[products.length - 1];
    const nextCursor = hasNextPage && lastProduct
        ? encodeCursor(new Date(lastProduct.createdAt), lastProduct.id)
        : null;

    const meta = buildPaginationMeta(
        total,
        isCursorMode ? undefined : query.page,
        query.pageSize,
        hasNextPage,
        hasPrevPage,
        nextCursor
    );

    return ProductsListSchema.parse({
        data: products.map(mapProductCategories),
        meta,
        ...(facets ? { facets } : {}),
    });
};

export const getProductBySlug = async (slug: TProductSlug): Promise<TGetProductPublic> => {
    const product = await db.query.productsTable.findFirst({
        where: (product, { eq, and, or, lte, isNull }) => {
            return and(
                eq(product.slug, slug),
                isNull(product.deletedAt),
                or(
                    eq(product.status, "published"),
                    and(
                        eq(product.status, "scheduled"),
                        lte(product.publishedAt, new Date())
                    )
                )
            );
        },
        columns: {
            createdAt: false,
            updatedAt: false,
            deletedAt: false,
            searchVector: false,
        },
        with: {
            productCategories: {
                with: {
                    category: true,
                },
            },
            options: {
                orderBy: (opt, { asc }) => [asc(opt.position), asc(opt.createdAt)],
                with: {
                    values: {
                        orderBy: (val, { asc }) => [asc(val.position), asc(val.createdAt)],
                    },
                },
            },
            variants: {
                where: (variant, { eq, and, isNull }) => and(eq(variant.isActive, true), isNull(variant.deletedAt)),
                orderBy: (variant, { asc }) => [asc(variant.createdAt)],
            },
        },
    });

    if (!product) {
        const redirect = await db.query.productSlugRedirectsTable.findFirst({
            where: (r, { eq }) => eq(r.sourceSlug, slug),
        });

        if (redirect) {
            throw new PermanentRedirectError(
                redirect.targetSlug,
                `/api/v1/products/${redirect.targetSlug}`
            );
        }

        throw new NotFoundError("Product not found");
    }

    return GetProductPublicSchema.parse(mapProductCategories(product));
};

export const getAdminProducts = async (query: TAdminProductQuery): Promise<TAdminProductsList> => {
    const searchQuery = buildProductSearchQuery(query.search);
    const effectiveSort = resolveProductSort(query);
    const orderBy = buildProductOrderBy(effectiveSort, query.sortOrder, searchQuery);

    let cursorCondition: SQL | null = null;
    let decodedCursor: { createdAt: Date; id: string } | null = null;
    if (query.cursor) {
        decodedCursor = decodeCursor(query.cursor);
        if (!decodedCursor) {
            throw new BadRequestError("Invalid cursor provided");
        }
        cursorCondition = buildCursorCondition(decodedCursor, query.sortOrder);
    }

    const baseConditions = buildProductConditions(query, "admin", searchQuery);
    const queryConditions = buildProductConditions(query, "admin", searchQuery, cursorCondition);

    const isCursorMode = Boolean(query.cursor);
    const limit = query.pageSize + 1;
    const offset = isCursorMode ? undefined : (query.page - 1) * query.pageSize;
    const shouldComputeFacets = query.includeFacets ?? (query.page === 1 && !isCursorMode && query.pageSize >= 10);

    let [rawProducts, total, facets] = await Promise.all([
        db.query.productsTable.findMany({
            where: queryConditions,
            orderBy,
            offset,
            limit,
            columns: {
                searchVector: false,
            },
            with: {
                productCategories: {
                    with: {
                        category: true,
                    },
                },
            },
        }),
        isCursorMode ? Promise.resolve(undefined) : db.$count(productsTable, baseConditions),
        shouldComputeFacets ? getProductFacets(baseConditions) : Promise.resolve(undefined),
    ]);

    if (query.search && rawProducts.length === 0 && (!total || total === 0)) {
        const fuzzyCondition = buildFuzzySearchCondition(query.search);
        if (fuzzyCondition) {
            const fuzzyBaseConditions = buildProductConditions(query, "admin", null, null, fuzzyCondition);
            const fuzzyQueryConditions = buildProductConditions(query, "admin", null, cursorCondition, fuzzyCondition);
            const fuzzyOrderBy = effectiveSort === "relevance"
                ? buildFuzzyOrderBy(query.search, query.sortOrder)
                : orderBy;

            const [fuzzyRawProducts, fuzzyTotal, fuzzyFacets] = await Promise.all([
                db.query.productsTable.findMany({
                    where: fuzzyQueryConditions,
                    orderBy: fuzzyOrderBy,
                    offset,
                    limit,
                    columns: {
                        searchVector: false,
                    },
                    with: {
                        productCategories: {
                            with: {
                                category: true,
                            },
                        },
                    },
                }),
                isCursorMode ? Promise.resolve(undefined) : db.$count(productsTable, fuzzyBaseConditions),
                shouldComputeFacets ? getProductFacets(fuzzyBaseConditions) : Promise.resolve(undefined),
            ]);

            if (fuzzyRawProducts.length > 0) {
                rawProducts = fuzzyRawProducts;
                total = fuzzyTotal;
                if (fuzzyFacets) {
                    facets = fuzzyFacets;
                }
            }
        }
    }

    const hasNextPage = rawProducts.length > query.pageSize;
    const products = hasNextPage ? rawProducts.slice(0, query.pageSize) : rawProducts;
    const hasPrevPage = isCursorMode ? true : query.page > 1;

    const lastProduct = products[products.length - 1];
    const nextCursor = hasNextPage && lastProduct
        ? encodeCursor(new Date(lastProduct.createdAt), lastProduct.id)
        : null;

    const meta = buildPaginationMeta(
        total,
        isCursorMode ? undefined : query.page,
        query.pageSize,
        hasNextPage,
        hasPrevPage,
        nextCursor
    );

    return AdminProductsListSchema.parse({
        data: products.map(mapProductCategories),
        meta,
        ...(facets ? { facets } : {}),
    });
};

export const getAdminProductBySlug = async (slug: TProductSlug): Promise<TGetProduct> => {
    let targetSlug = slug;
    let product = await db.query.productsTable.findFirst({
        where: (product, { eq }) => {
            return eq(product.slug, targetSlug);
        },
        columns: {
            searchVector: false,
        },
        with: {
            productCategories: {
                with: {
                    category: true,
                },
            },
            options: {
                orderBy: (opt, { asc }) => [asc(opt.position), asc(opt.createdAt)],
                with: {
                    values: {
                        orderBy: (val, { asc }) => [asc(val.position), asc(val.createdAt)],
                    },
                },
            },
            variants: {
                orderBy: (variant, { asc }) => [asc(variant.createdAt)],
            },
        },
    });

    if (!product) {
        const redirect = await db.query.productSlugRedirectsTable.findFirst({
            where: (r, { eq }) => eq(r.sourceSlug, slug),
        });

        if (redirect) {
            targetSlug = redirect.targetSlug;
            product = await db.query.productsTable.findFirst({
                where: (p, { eq }) => eq(p.slug, targetSlug),
                columns: {
                    searchVector: false,
                },
                with: {
                    productCategories: {
                        with: {
                            category: true,
                        },
                    },
                    options: {
                        orderBy: (opt, { asc }) => [asc(opt.position), asc(opt.createdAt)],
                        with: {
                            values: {
                                orderBy: (val, { asc }) => [asc(val.position), asc(val.createdAt)],
                            },
                        },
                    },
                    variants: {
                        orderBy: (variant, { asc }) => [asc(variant.createdAt)],
                    },
                },
            });
        }
    }

    if (!product) {
        throw new NotFoundError("Product not found");
    }

    return GetProductSchema.parse(mapProductCategories(product));
};

export const createProduct = async (data: TCreateProductOutput): Promise<TProductModel> => {
    if (data.status === "scheduled" && !data.publishedAt) {
        throw new BadRequestError("publishedAt is required when status is 'scheduled'");
    }
    if (data.status === "published" && !data.publishedAt) {
        data.publishedAt = new Date();
    }

    const { purchasePrice, categoryIds, primaryCategoryId, options, variants, ...productInsertData } = data;

    const explicitSlug = data.slug;
    const baseSlug = explicitSlug
        ? slugify(explicitSlug)
        : ensureSlug(data.name);

    if (explicitSlug && !baseSlug) {
        throw new BadRequestError("Slug must contain at least one Latin letter or number");
    }

    let slug = baseSlug;
    for (let attempt = 1; attempt <= 10; attempt++) {
        const slugTaken = await db.query.productsTable.findFirst({
            where: (product, { eq }) => {
                return eq(product.slug, slug);
            },
            columns: {
                id: true,
            },
        });

        const redirectTaken = await db.query.productSlugRedirectsTable.findFirst({
            where: (r, { eq }) => eq(r.sourceSlug, slug),
            columns: { id: true },
        });

        if (!slugTaken && !redirectTaken) {
            break;
        }
        if (explicitSlug) {
            throw new ConflictError(
                slugTaken
                    ? "A product with this slug already exists"
                    : "This slug is reserved by a redirect for an existing product"
            );
        }
        slug = `${baseSlug}-${attempt + 1}`;
        if (attempt === 10) {
            throw new ConflictError("Could not generate a unique slug");
        }
    }

    const initialSellPrice = variants && variants.length > 0
        ? Math.min(...variants.map((v) => Number(v.sellPrice)))
        : (data.sellPrice ?? 0);
    const initialStock = variants && variants.length > 0 && productInsertData.inventoryType === "discrete"
        ? variants.reduce((sum, v) => {
            const effectiveType = resolveEffectiveInventoryType(v.inventoryType, productInsertData.inventoryType);
            return sum + (effectiveType === "discrete" ? Number(v.stock ?? 0) : 0);
        }, 0)
        : (data.stock ?? 0);

    const [product] = await db.insert(productsTable).values({
        ...productInsertData,
        sellPrice: initialSellPrice,
        stock: initialStock,
        slug,
    }).returning();

    if (categoryIds && categoryIds.length > 0) {
        await db.insert(productCategoriesTable).values(
            categoryIds.map((catId, index) => ({
                productId: product.id,
                categoryId: catId,
                isPrimary: primaryCategoryId ? catId === primaryCategoryId : index === 0,
            }))
        );
    }

    if (options && options.length > 0) {
        for (let optIdx = 0; optIdx < options.length; optIdx++) {
            const opt = options[optIdx];
            const [insertedOpt] = await db.insert(productOptionsTable).values({
                productId: product.id,
                name: opt.name,
                position: opt.position ?? optIdx,
                variantTypeId: opt.variantTypeId ?? null,
            }).returning();

            if (opt.values && opt.values.length > 0) {
                for (let valIdx = 0; valIdx < opt.values.length; valIdx++) {
                    const val = opt.values[valIdx];
                    await db.insert(productOptionValuesTable).values({
                        optionId: insertedOpt.id,
                        value: val.value,
                        position: val.position ?? valIdx,
                        swatchMeta: val.swatchMeta ?? null,
                    });
                }
            }
        }
    }

    if (variants && variants.length > 0) {
        for (let i = 0; i < variants.length; i++) {
            const v = variants[i];
            const signature = v.signature?.trim() || normalizeVariantSignature(v.optionValues);
            const title = v.title?.trim() || (v.optionValues && Object.keys(v.optionValues).length > 0 ? Object.values(v.optionValues).join(" / ") : "Default");
            const sku = v.sku?.trim() || (v.optionValues && Object.keys(v.optionValues).length > 0
                ? `${product.slug}-${Object.values(v.optionValues).map((val) => slugify(val).replace(/^-+|-+$/g, "")).join("-")}`
                : `${product.slug}-default`
            ).toLowerCase();
            const isDefault = v.isDefault ?? (i === 0);

            await db.insert(productVariantsTable).values({
                productId: product.id,
                title,
                sku,
                optionValues: v.optionValues ?? {},
                signature,
                inventoryType: v.inventoryType ?? null,
                purchasePrice: v.purchasePrice ?? 0,
                sellPrice: v.sellPrice,
                stock: v.stock ?? 0,
                poolConsumptionRate: v.poolConsumptionRate != null ? v.poolConsumptionRate : null,
                isDefault,
                isActive: v.isActive ?? true,
                imageUrl: v.imageUrl ?? null,
            });
        }
        await syncProductAggregateReadModel(db, product.id);
    } else {
        let defaultSku = `${product.slug}-default`.toLowerCase();
        let counter = 1;
        while (await db.query.productVariantsTable.findFirst({ where: (v, { eq }) => eq(v.sku, defaultSku) })) {
            defaultSku = `${product.slug}-default-${counter}`.toLowerCase();
            counter++;
        }

        await db.insert(productVariantsTable).values({
            productId: product.id,
            title: "Default",
            sku: defaultSku,
            optionValues: {},
            signature: "default",
            inventoryType: product.inventoryType ?? "discrete",
            purchasePrice: purchasePrice ?? 0,
            sellPrice: product.sellPrice,
            stock: product.stock ?? 0,
            poolConsumptionRate: null,
            isDefault: true,
            isActive: true,
            imageUrl: product.featuredImageUrl ?? null,
        });
    }

    return product;
};

export const updateProductBySlug = async (slug: TProductSlug, data: TUpdateProductOutput["data"]): Promise<TProductModel> => {
    let existingProduct = await db.query.productsTable.findFirst({
        where: (product, { eq, and, isNull }) => {
            return and(eq(product.slug, slug), isNull(product.deletedAt));
        },
    });

    if (!existingProduct) {
        const redirect = await db.query.productSlugRedirectsTable.findFirst({
            where: (r, { eq }) => eq(r.sourceSlug, slug),
        });
        if (redirect) {
            existingProduct = await db.query.productsTable.findFirst({
                where: (product, { eq, and, isNull }) => {
                    return and(eq(product.slug, redirect.targetSlug), isNull(product.deletedAt));
                },
            });
        }
    }

    if (existingProduct) {
        let updateData = { ...data };

        const targetStatus = updateData.status ?? existingProduct.status;
        const targetPublishedAt = updateData.publishedAt !== undefined ? updateData.publishedAt : existingProduct.publishedAt;
        if (targetStatus === "scheduled" && !targetPublishedAt) {
            throw new BadRequestError("publishedAt is required when status is 'scheduled'");
        }
        if (targetStatus === "published" && !targetPublishedAt) {
            updateData = { ...updateData, publishedAt: new Date() };
        }

        if (data.slug && data.slug !== existingProduct.slug) {
            const newSlug = slugify(data.slug);
            if (!newSlug) {
                throw new BadRequestError("Slug must contain at least one Latin letter or number");
            }

            const slugTaken = await db.query.productsTable.findFirst({
                where: (product, { eq, and, ne }) => {
                    return and(eq(product.slug, newSlug), ne(product.id, existingProduct.id));
                },
            });
            if (slugTaken) {
                throw new ConflictError("A product with this slug already exists");
            }

            const redirectTaken = await db.query.productSlugRedirectsTable.findFirst({
                where: (r, { eq, and, ne }) => and(eq(r.sourceSlug, newSlug), ne(r.productId, existingProduct.id)),
            });
            if (redirectTaken) {
                throw new ConflictError("This slug is reserved by a redirect for another product");
            }

            const wasEverPublished = existingProduct.publishedAt != null || existingProduct.status === "published";
            if (wasEverPublished) {
                await db.delete(productSlugRedirectsTable).where(
                    and(
                        eq(productSlugRedirectsTable.productId, existingProduct.id),
                        eq(productSlugRedirectsTable.sourceSlug, newSlug)
                    )
                );

                await db.insert(productSlugRedirectsTable).values({
                    productId: existingProduct.id,
                    sourceSlug: existingProduct.slug,
                    targetSlug: newSlug,
                }).onConflictDoUpdate({
                    target: productSlugRedirectsTable.sourceSlug,
                    set: { targetSlug: newSlug },
                });

                await db.update(productSlugRedirectsTable)
                    .set({ targetSlug: newSlug })
                    .where(eq(productSlugRedirectsTable.productId, existingProduct.id));
            }

            updateData = { ...updateData, slug: newSlug };
        }

        const { purchasePrice, categoryIds, primaryCategoryId, options, variants, ...productUpdateData } = updateData;

        if (categoryIds !== undefined) {
            await db.delete(productCategoriesTable).where(eq(productCategoriesTable.productId, existingProduct.id));
            if (categoryIds.length > 0) {
                await db.insert(productCategoriesTable).values(
                    categoryIds.map((catId, index) => ({
                        productId: existingProduct.id,
                        categoryId: catId,
                        isPrimary: primaryCategoryId ? catId === primaryCategoryId : index === 0,
                    }))
                );
            }
        }

        if (options !== undefined) {
            await db.delete(productOptionsTable).where(eq(productOptionsTable.productId, existingProduct.id));
            if (options.length > 0) {
                for (let optIdx = 0; optIdx < options.length; optIdx++) {
                    const opt = options[optIdx];
                    const [insertedOpt] = await db.insert(productOptionsTable).values({
                        productId: existingProduct.id,
                        name: opt.name,
                        position: opt.position ?? optIdx,
                        variantTypeId: opt.variantTypeId ?? null,
                    }).returning();

                    if (opt.values && opt.values.length > 0) {
                        for (let valIdx = 0; valIdx < opt.values.length; valIdx++) {
                            const val = opt.values[valIdx];
                            await db.insert(productOptionValuesTable).values({
                                optionId: insertedOpt.id,
                                value: val.value,
                                position: val.position ?? valIdx,
                                swatchMeta: val.swatchMeta ?? null,
                            });
                        }
                    }
                }
            }
        }

        if (variants !== undefined) {
            await db.delete(productVariantsTable).where(eq(productVariantsTable.productId, existingProduct.id));
            if (variants.length > 0) {
                const targetSlug = updateData.slug ?? existingProduct.slug;
                for (let i = 0; i < variants.length; i++) {
                    const v = variants[i];
                    const signature = v.signature?.trim() || normalizeVariantSignature(v.optionValues);
                    const title = v.title?.trim() || (v.optionValues && Object.keys(v.optionValues).length > 0 ? Object.values(v.optionValues).join(" / ") : "Default");
                    const sku = v.sku?.trim() || (v.optionValues && Object.keys(v.optionValues).length > 0
                        ? `${targetSlug}-${Object.values(v.optionValues).map((val) => slugify(val).replace(/^-+|-+$/g, "")).join("-")}`
                        : `${targetSlug}-default`
                    ).toLowerCase();
                    const isDefault = v.isDefault ?? (i === 0);

                    await db.insert(productVariantsTable).values({
                        productId: existingProduct.id,
                        title,
                        sku,
                        optionValues: v.optionValues ?? {},
                        signature,
                        inventoryType: v.inventoryType ?? null,
                        purchasePrice: v.purchasePrice ?? 0,
                        sellPrice: v.sellPrice,
                        stock: v.stock ?? 0,
                        poolConsumptionRate: v.poolConsumptionRate != null ? v.poolConsumptionRate : null,
                        isDefault,
                        isActive: v.isActive ?? true,
                        imageUrl: v.imageUrl ?? null,
                    });
                }
                await syncProductAggregateReadModel(db, existingProduct.id);
            } else {
                const targetSlug = updateData.slug ?? existingProduct.slug;
                let defaultSku = `${targetSlug}-default`.toLowerCase();
                let counter = 1;
                while (await db.query.productVariantsTable.findFirst({ where: (v, { eq }) => eq(v.sku, defaultSku) })) {
                    defaultSku = `${targetSlug}-default-${counter}`.toLowerCase();
                    counter++;
                }

                await db.insert(productVariantsTable).values({
                    productId: existingProduct.id,
                    title: "Default",
                    sku: defaultSku,
                    optionValues: {},
                    signature: "default",
                    inventoryType: updateData.inventoryType ?? existingProduct.inventoryType ?? "discrete",
                    purchasePrice: purchasePrice ?? 0,
                    sellPrice: updateData.sellPrice ?? existingProduct.sellPrice,
                    stock: updateData.stock ?? existingProduct.stock ?? 0,
                    poolConsumptionRate: null,
                    isDefault: true,
                    isActive: true,
                    imageUrl: updateData.featuredImageUrl ?? existingProduct.featuredImageUrl ?? null,
                });
            }
        } else {
            const existingVariants = await db.query.productVariantsTable.findMany({
                where: (v, { eq }) => eq(v.productId, existingProduct.id),
            });

            if (existingVariants.length === 1) {
                const singleVar = existingVariants[0];
                const isDefaultSimple = singleVar.isDefault && (!singleVar.optionValues || Object.keys(singleVar.optionValues).length === 0);
                if (isDefaultSimple) {
                    const variantSyncData: Record<string, unknown> = {};
                    if (updateData.sellPrice !== undefined) variantSyncData.sellPrice = updateData.sellPrice;
                    if (purchasePrice !== undefined) variantSyncData.purchasePrice = purchasePrice;
                    if (updateData.stock !== undefined) variantSyncData.stock = updateData.stock;
                    if (updateData.inventoryType !== undefined) variantSyncData.inventoryType = updateData.inventoryType;
                    if (updateData.featuredImageUrl !== undefined) variantSyncData.imageUrl = updateData.featuredImageUrl;

                    if (Object.keys(variantSyncData).length > 0) {
                        await db.update(productVariantsTable)
                            .set(variantSyncData)
                            .where(eq(productVariantsTable.id, singleVar.id));
                    }
                }
            } else if (existingVariants.length === 0) {
                const targetSlug = updateData.slug ?? existingProduct.slug;
                let defaultSku = `${targetSlug}-default`.toLowerCase();
                let counter = 1;
                while (await db.query.productVariantsTable.findFirst({ where: (v, { eq }) => eq(v.sku, defaultSku) })) {
                    defaultSku = `${targetSlug}-default-${counter}`.toLowerCase();
                    counter++;
                }

                await db.insert(productVariantsTable).values({
                    productId: existingProduct.id,
                    title: "Default",
                    sku: defaultSku,
                    optionValues: {},
                    signature: "default",
                    inventoryType: updateData.inventoryType ?? existingProduct.inventoryType ?? "discrete",
                    purchasePrice: purchasePrice ?? 0,
                    sellPrice: updateData.sellPrice ?? existingProduct.sellPrice,
                    stock: updateData.stock ?? existingProduct.stock ?? 0,
                    poolConsumptionRate: null,
                    isDefault: true,
                    isActive: true,
                    imageUrl: updateData.featuredImageUrl ?? existingProduct.featuredImageUrl ?? null,
                });
            }
        }

        const [product] = await db.update(productsTable)
            .set(productUpdateData)
            .where(eq(productsTable.id, existingProduct.id))
            .returning();

        return product;
    }
    throw new NotFoundError("Product not found");
};

export const deleteProductBySlug = async (slug: TProductSlug): Promise<TProductModel> => {
    let targetSlug = slug;
    const directExists = await db.query.productsTable.findFirst({
        where: (p, { eq, and, isNull }) => and(eq(p.slug, slug), isNull(p.deletedAt)),
        columns: { slug: true },
    });
    if (!directExists) {
        const redirect = await db.query.productSlugRedirectsTable.findFirst({
            where: (r, { eq }) => eq(r.sourceSlug, slug),
        });
        if (redirect) {
            targetSlug = redirect.targetSlug;
        }
    }

    const [product] = await db.update(productsTable)
        .set({ deletedAt: new Date() })
        .where(and(eq(productsTable.slug, targetSlug), isNull(productsTable.deletedAt)))
        .returning();

    if (!product) {
        throw new NotFoundError("Product not found");
    }
    return product;
};

export const restoreProductBySlug = async (slug: TProductSlug): Promise<TProductModel> => {
    let targetSlug = slug;
    const directExists = await db.query.productsTable.findFirst({
        where: (p, { eq, and, isNotNull }) => and(eq(p.slug, slug), isNotNull(p.deletedAt)),
        columns: { slug: true },
    });
    if (!directExists) {
        const redirect = await db.query.productSlugRedirectsTable.findFirst({
            where: (r, { eq }) => eq(r.sourceSlug, slug),
        });
        if (redirect) {
            targetSlug = redirect.targetSlug;
        }
    }

    const [product] = await db.update(productsTable)
        .set({ deletedAt: null })
        .where(and(eq(productsTable.slug, targetSlug), isNotNull(productsTable.deletedAt)))
        .returning();

    if (!product) {
        throw new NotFoundError("Product not found");
    }
    return product;
};

export const suggestProducts = async (query: TSuggestQuery): Promise<TProductSuggestions> => {
    const trimmed = query.q.trim();
    if (!trimmed) {
        return {
            products: [],
            categories: [],
            tags: [],
        };
    }

    const searchQuery = buildProductSearchQuery(trimmed);

    const productConditions = [
        isNull(productsTable.deletedAt),
        or(
            eq(productsTable.status, "published"),
            and(
                eq(productsTable.status, "scheduled"),
                lte(productsTable.publishedAt, sql`NOW()`)
            )
        )!,
    ];
    if (searchQuery) {
        productConditions.push(sql`${productsTable.searchVector} @@ ${searchQuery}`);
    } else {
        productConditions.push(sql`${productsTable.name} ILIKE ${`%${trimmed}%`}`);
    }

    const [initialProducts, initialCategories, matchedTags] = await Promise.all([
        db.query.productsTable.findMany({
            where: and(...productConditions),
            orderBy: searchQuery
                ? [desc(sql`ts_rank(${productsTable.searchVector}, ${searchQuery})`)]
                : [desc(productsTable.createdAt)],
            limit: Math.min(query.limit, 5),
            columns: {
                id: true,
                name: true,
                slug: true,
                sellPrice: true,
                featuredImageUrl: true,
            },
            with: {
                productCategories: {
                    with: {
                        category: true,
                    },
                },
            },
        }),
        db.query.categoriesTable.findMany({
            where: (cat, { ilike }) => ilike(cat.name, `%${trimmed}%`),
            limit: 3,
            columns: {
                id: true,
                name: true,
                slug: true,
            },
        }),
        db.execute(sql`
            SELECT DISTINCT tag
            FROM ${productsTable}, jsonb_array_elements_text(coalesce(${productsTable.tags}, '[]'::jsonb)) AS tag
            WHERE (${productsTable.status} = 'published' OR (${productsTable.status} = 'scheduled' AND ${productsTable.publishedAt} <= NOW()))
              AND ${productsTable.deletedAt} IS NULL
              AND tag ILIKE ${`%${trimmed}%`}
            LIMIT 3
        `),
    ]);

    let matchedProducts = initialProducts;
    let matchedCategories = initialCategories;

    if (matchedProducts.length === 0) {
        matchedProducts = await db.query.productsTable.findMany({
            where: and(
                isNull(productsTable.deletedAt),
                or(
                    eq(productsTable.status, "published"),
                    and(
                        eq(productsTable.status, "scheduled"),
                        lte(productsTable.publishedAt, sql`NOW()`)
                    )
                )!,
                sql`(${productsTable.name} % ${trimmed} OR word_similarity(${trimmed}, ${productsTable.name}) > 0.25)`
            ),
            orderBy: [desc(sql`greatest(similarity(${productsTable.name}, ${trimmed}), word_similarity(${trimmed}, ${productsTable.name}))`)],
            limit: Math.min(query.limit, 5),
            columns: {
                id: true,
                name: true,
                slug: true,
                sellPrice: true,
                featuredImageUrl: true,
            },
            with: {
                productCategories: {
                    with: {
                        category: true,
                    },
                },
            },
        });
    }

    if (matchedCategories.length === 0) {
        matchedCategories = await db.query.categoriesTable.findMany({
            where: sql`(${categoriesTable.name} % ${trimmed} OR word_similarity(${trimmed}, ${categoriesTable.name}) > 0.25)`,
            orderBy: [desc(sql`greatest(similarity(${categoriesTable.name}, ${trimmed}), word_similarity(${trimmed}, ${categoriesTable.name}))`)],
            limit: 3,
            columns: {
                id: true,
                name: true,
                slug: true,
            },
        });
    }

    const tags = (matchedTags.rows as Array<{ tag: string }>).map((r) => r.tag);

    return ProductSuggestionsSchema.parse({
        products: matchedProducts.map((p) => {
            const primaryCat = p.productCategories.find((pc) => pc.isPrimary)?.category?.name
                ?? p.productCategories[0]?.category?.name;
            return {
                id: p.id,
                name: p.name,
                slug: p.slug,
                category: primaryCat,
                sellPrice: Number(p.sellPrice),
                featuredImageUrl: p.featuredImageUrl,
            };
        }),
        categories: matchedCategories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
        })),
        tags,
    });
};

export const getRelatedProducts = async (slug: TProductSlug, limit: number = 8): Promise<TGetProductsPublic> => {
    const sourceProduct = await db.query.productsTable.findFirst({
        where: (product, { eq, and, or, lte, isNull }) =>
            and(
                eq(product.slug, slug),
                isNull(product.deletedAt),
                or(
                    eq(product.status, "published"),
                    and(
                        eq(product.status, "scheduled"),
                        lte(product.publishedAt, sql`NOW()`)
                    )
                )
            ),
        columns: {
            id: true,
            tags: true,
        },
        with: {
            productCategories: true,
        },
    });

    if (!sourceProduct) {
        throw new NotFoundError("Product not found");
    }

    const categoryIds = sourceProduct.productCategories.map((pc) => pc.categoryId);
    const primaryCategoryId = sourceProduct.productCategories.find((pc) => pc.isPrimary)?.categoryId ?? categoryIds[0];
    const tags = Array.isArray(sourceProduct.tags) ? (sourceProduct.tags as string[]) : [];

    const effectiveLimit = Math.min(Math.max(1, limit), 20);

    const hasCategories = categoryIds.length > 0;
    const hasTags = tags.length > 0;

    const catScoreSql = hasCategories
        ? sql`COALESCE((
            SELECT SUM(CASE WHEN pc.category_id = ${primaryCategoryId} THEN 5 ELSE 3 END)
            FROM ${productCategoriesTable} pc
            WHERE pc.product_id = ${productsTable.id} AND pc.category_id = ANY(${categoryIds})
          ), 0)`
        : sql`0`;

    const tagScoreSql = hasTags
        ? sql`COALESCE((
            SELECT count(*)::int
            FROM jsonb_array_elements_text(coalesce(${productsTable.tags}, '[]'::jsonb)) t
            WHERE t = ANY(${tags})
          ), 0)`
        : sql`0`;

    const stockScoreSql = sql`(CASE WHEN ${productsTable.stock} > 0 THEN 2 ELSE 0 END)`;

    const candidateIdsResult = await db.execute(sql`
        SELECT ${productsTable.id} AS id
        FROM ${productsTable}
        WHERE ${productsTable.id} != ${sourceProduct.id}
          AND ${productsTable.deletedAt} IS NULL
          AND (${productsTable.status} = 'published' OR (${productsTable.status} = 'scheduled' AND ${productsTable.publishedAt} <= NOW()))
        ORDER BY (${catScoreSql} + ${tagScoreSql} + ${stockScoreSql}) DESC,
                 ${productsTable.publishedAt} DESC NULLS LAST,
                 ${productsTable.createdAt} DESC
        LIMIT ${effectiveLimit};
    `);

    const candidateIds = (candidateIdsResult.rows as Array<{ id: string }>).map((r) => r.id);

    if (candidateIds.length === 0) {
        return [];
    }

    const relatedProducts = await db.query.productsTable.findMany({
        where: (product, { inArray }) => inArray(product.id, candidateIds),
        columns: {
            updatedAt: false,
            deletedAt: false,
            searchVector: false,
        },
        with: {
            productCategories: {
                with: {
                    category: true,
                },
            },
        },
    });

    const idOrderMap = new Map(candidateIds.map((id, index) => [id, index]));
    relatedProducts.sort((a, b) => (idOrderMap.get(a.id) ?? 0) - (idOrderMap.get(b.id) ?? 0));

    return GetProductsPublicSchema.parse(relatedProducts.map(mapProductCategories));
};

export const addVariantToProduct = async (
    productSlug: TProductSlug,
    input: TCreateProductVariantInput
): Promise<TProductVariant> => {
    const parsed = CreateProductVariantSchema.parse(input);

    const product = await db.query.productsTable.findFirst({
        where: (p, { eq, and, isNull }) => and(eq(p.slug, productSlug), isNull(p.deletedAt)),
        columns: { id: true, slug: true, stock: true, poolStock: true, inventoryType: true },
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }

    const signature = parsed.signature?.trim() || normalizeVariantSignature(parsed.optionValues);
    const title = parsed.title?.trim() || (parsed.optionValues && Object.keys(parsed.optionValues).length > 0 ? Object.values(parsed.optionValues).join(" / ") : "Default");
    const sku = (parsed.sku?.trim() || (parsed.optionValues && Object.keys(parsed.optionValues).length > 0
        ? `${product.slug}-${Object.values(parsed.optionValues).map((val) => slugify(val).replace(/^-+|-+$/g, "")).join("-")}`
        : `${product.slug}-default`
    )).toLowerCase();

    const existingSku = await db.query.productVariantsTable.findFirst({
        where: (v, { eq }) => eq(v.sku, sku),
        columns: { id: true },
    });
    if (existingSku) {
        throw new ConflictError(`Variant SKU '${sku}' is already in use`);
    }

    const existingSignature = await db.query.productVariantsTable.findFirst({
        where: (v, { eq, and }) =>
            and(
                eq(v.productId, product.id),
                eq(v.signature, signature)
            ),
        columns: { id: true },
    });
    if (existingSignature) {
        throw new ConflictError(`A variant with option signature '${signature}' already exists for this product`);
    }

    const existingVariants = await db.query.productVariantsTable.findMany({
        where: (v, { eq }) => eq(v.productId, product.id),
    });

    const isOnlyDefaultDummy = existingVariants.length === 1 &&
        existingVariants[0].isDefault &&
        (!existingVariants[0].optionValues || Object.keys(existingVariants[0].optionValues).length === 0);

    const hasNewOptionValues = parsed.optionValues && Object.keys(parsed.optionValues).length > 0;

    let isDefault = parsed.isDefault;
    if (isOnlyDefaultDummy && hasNewOptionValues) {
        await db.delete(productVariantsTable).where(eq(productVariantsTable.id, existingVariants[0].id));
        isDefault = true;
    } else if (isDefault) {
        await db
            .update(productVariantsTable)
            .set({ isDefault: false })
            .where(eq(productVariantsTable.productId, product.id));
    } else {
        const remainingCount = existingVariants.length;
        if (remainingCount === 0) {
            isDefault = true;
        }
    }

    const [variant] = await db
        .insert(productVariantsTable)
        .values({
            productId: product.id,
            title,
            sku,
            optionValues: parsed.optionValues ?? {},
            signature,
            inventoryType: parsed.inventoryType ?? null,
            purchasePrice: parsed.purchasePrice,
            sellPrice: parsed.sellPrice,
            stock: parsed.stock ?? 0,
            poolConsumptionRate: parsed.poolConsumptionRate != null ? parsed.poolConsumptionRate : null,
            isDefault,
            isActive: parsed.isActive ?? true,
            imageUrl: parsed.imageUrl ?? null,
        })
        .returning();

    await syncProductAggregateReadModel(db, product.id);

    const effectiveInvType = resolveEffectiveInventoryType(variant.inventoryType, product.inventoryType);
    const stockCalc = calculateVariantStock({
        masterPoolStock: Number(product.poolStock ?? 0),
        inventoryType: effectiveInvType,
        variantStock: Number(variant.stock),
        poolConsumptionRate: variant.poolConsumptionRate != null ? Number(variant.poolConsumptionRate) : null,
    });

    return ProductVariantSchema.parse({
        ...variant,
        optionValues: variant.optionValues ?? {},
        signature: variant.signature,
        inventoryType: effectiveInvType,
        purchasePrice: Number(variant.purchasePrice),
        sellPrice: Number(variant.sellPrice),
        stock: stockCalc.stock,
        isUnlimited: stockCalc.isUnlimited,
        ...(variant.poolConsumptionRate != null ? { poolConsumptionRate: Number(variant.poolConsumptionRate) } : {}),
    });
};

export const updateVariant = async (
    productSlug: TProductSlug,
    variantId: string,
    input: TUpdateProductVariantInput
): Promise<TProductVariant> => {
    const parsed = UpdateProductVariantSchema.parse(input);

    const product = await db.query.productsTable.findFirst({
        where: (p, { eq, and, isNull }) => and(eq(p.slug, productSlug), isNull(p.deletedAt)),
        columns: { id: true, slug: true, stock: true, poolStock: true, inventoryType: true },
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }

    const existingVariant = await db.query.productVariantsTable.findFirst({
        where: (v, { eq, and }) => and(eq(v.id, variantId), eq(v.productId, product.id)),
    });
    if (!existingVariant) {
        throw new NotFoundError("Variant not found on this product");
    }

    if (parsed.sku && parsed.sku !== existingVariant.sku) {
        const skuTaken = await db.query.productVariantsTable.findFirst({
            where: (v, { eq, and, ne }) => and(eq(v.sku, parsed.sku!), ne(v.id, variantId)),
            columns: { id: true },
        });
        if (skuTaken) {
            throw new ConflictError(`Variant SKU '${parsed.sku}' is already in use`);
        }
    }

    let nextSignature = existingVariant.signature;
    if (parsed.optionValues !== undefined || parsed.signature !== undefined) {
        nextSignature = parsed.signature?.trim() || normalizeVariantSignature(parsed.optionValues ?? existingVariant.optionValues);
        const signatureTaken = await db.query.productVariantsTable.findFirst({
            where: (v, { eq, and, ne }) =>
                and(
                    eq(v.productId, product.id),
                    eq(v.signature, nextSignature),
                    ne(v.id, variantId)
                ),
            columns: { id: true },
        });
        if (signatureTaken) {
            throw new ConflictError(`A variant with option signature '${nextSignature}' already exists for this product`);
        }
    }

    if (parsed.isDefault) {
        await db
            .update(productVariantsTable)
            .set({ isDefault: false })
            .where(eq(productVariantsTable.productId, product.id));
    }

    const [updated] = await db
        .update(productVariantsTable)
        .set({
            ...parsed,
            ...(nextSignature !== existingVariant.signature ? { signature: nextSignature } : {}),
        })
        .where(eq(productVariantsTable.id, variantId))
        .returning();

    await syncProductAggregateReadModel(db, product.id);

    const effectiveInvType = resolveEffectiveInventoryType(updated.inventoryType, product.inventoryType);
    const stockCalc = calculateVariantStock({
        masterPoolStock: Number(product.poolStock ?? 0),
        inventoryType: effectiveInvType,
        variantStock: Number(updated.stock),
        poolConsumptionRate: updated.poolConsumptionRate != null ? Number(updated.poolConsumptionRate) : null,
    });

    return ProductVariantSchema.parse({
        ...updated,
        optionValues: updated.optionValues ?? {},
        signature: updated.signature,
        inventoryType: effectiveInvType,
        purchasePrice: Number(updated.purchasePrice),
        sellPrice: Number(updated.sellPrice),
        stock: stockCalc.stock,
        isUnlimited: stockCalc.isUnlimited,
        ...(updated.poolConsumptionRate != null ? { poolConsumptionRate: Number(updated.poolConsumptionRate) } : {}),
    });
};

export const deleteVariant = async (
    productSlug: TProductSlug,
    variantId: string
): Promise<void> => {
    const product = await db.query.productsTable.findFirst({
        where: (p, { eq, and, isNull }) => and(eq(p.slug, productSlug), isNull(p.deletedAt)),
        columns: { id: true },
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }

    const existingVariant = await db.query.productVariantsTable.findFirst({
        where: (v, { eq, and }) => and(eq(v.id, variantId), eq(v.productId, product.id)),
    });
    if (!existingVariant) {
        throw new NotFoundError("Variant not found on this product");
    }

    const totalVariantCount = await db.$count(
        productVariantsTable,
        and(eq(productVariantsTable.productId, product.id), isNull(productVariantsTable.deletedAt))
    );
    if (totalVariantCount <= 1) {
        throw new BadRequestError("Cannot delete the only variant of a product. A product must have at least one variant.");
    }

    await db.update(productVariantsTable)
        .set({ deletedAt: new Date(), isActive: false, isDefault: false })
        .where(eq(productVariantsTable.id, variantId));

    if (existingVariant.isDefault) {
        const nextVariant = await db.query.productVariantsTable.findFirst({
            where: (v, { eq, and, isNull }) => and(eq(v.productId, product.id), isNull(v.deletedAt)),
            orderBy: (v, { asc }) => [asc(v.createdAt)],
        });
        if (nextVariant) {
            await db
                .update(productVariantsTable)
                .set({ isDefault: true })
                .where(eq(productVariantsTable.id, nextVariant.id));
        }
    }

    await syncProductAggregateReadModel(db, product.id);
};

export const createProductOption = async (
    productSlug: TProductSlug,
    input: TCreateProductOptionInput
): Promise<TProductOptionItem> => {
    const parsed = CreateProductOptionSchema.parse(input);
    const product = await db.query.productsTable.findFirst({
        where: (p, { eq, and, isNull }) => and(eq(p.slug, productSlug), isNull(p.deletedAt)),
        columns: { id: true },
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }

    const existingOption = await db.query.productOptionsTable.findFirst({
        where: (o, { eq, and }) => and(eq(o.productId, product.id), eq(o.name, parsed.name)),
    });
    if (existingOption) {
        throw new ConflictError(`Option '${parsed.name}' already exists for this product`);
    }

    const [option] = await db.insert(productOptionsTable).values({
        productId: product.id,
        name: parsed.name,
        position: parsed.position,
        variantTypeId: parsed.variantTypeId ?? null,
    }).returning();

    let values: TOptionValueItem[] = [];
    if (parsed.values && parsed.values.length > 0) {
        values = await db.insert(productOptionValuesTable).values(
            parsed.values.map((v, idx) => ({
                optionId: option.id,
                value: v.value,
                position: v.position ?? idx,
                swatchMeta: v.swatchMeta ?? null,
            }))
        ).returning();
    }

    return ProductOptionItemSchema.parse({
        id: option.id,
        productId: option.productId,
        variantTypeId: option.variantTypeId ?? null,
        name: option.name,
        position: option.position,
        values,
    });
};

export const updateProductOption = async (
    productSlug: TProductSlug,
    optionId: string,
    input: TUpdateProductOptionInput
): Promise<TProductOptionItem> => {
    const parsed = UpdateProductOptionSchema.parse(input);
    const product = await db.query.productsTable.findFirst({
        where: (p, { eq, and, isNull }) => and(eq(p.slug, productSlug), isNull(p.deletedAt)),
        columns: { id: true },
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }

    const existingOption = await db.query.productOptionsTable.findFirst({
        where: (o, { eq, and }) => and(eq(o.id, optionId), eq(o.productId, product.id)),
        with: { values: true },
    });
    if (!existingOption) {
        throw new NotFoundError("Option not found on this product");
    }

    if (parsed.name && parsed.name !== existingOption.name) {
        const nameTaken = await db.query.productOptionsTable.findFirst({
            where: (o, { eq, and, ne }) => and(eq(o.productId, product.id), eq(o.name, parsed.name!), ne(o.id, optionId)),
        });
        if (nameTaken) {
            throw new ConflictError(`Option '${parsed.name}' already exists for this product`);
        }
    }

    const [updated] = await db.update(productOptionsTable)
        .set(parsed)
        .where(eq(productOptionsTable.id, optionId))
        .returning();

    return ProductOptionItemSchema.parse({
        id: updated.id,
        productId: updated.productId,
        variantTypeId: updated.variantTypeId ?? null,
        name: updated.name,
        position: updated.position,
        values: existingOption.values ?? [],
    });
};

export const deleteProductOption = async (
    productSlug: TProductSlug,
    optionId: string
): Promise<void> => {
    const product = await db.query.productsTable.findFirst({
        where: (p, { eq, and, isNull }) => and(eq(p.slug, productSlug), isNull(p.deletedAt)),
        columns: { id: true },
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }

    const existingOption = await db.query.productOptionsTable.findFirst({
        where: (o, { eq, and }) => and(eq(o.id, optionId), eq(o.productId, product.id)),
    });
    if (!existingOption) {
        throw new NotFoundError("Option not found on this product");
    }

    const activeVariants = await db.query.productVariantsTable.findMany({
        where: (v, { eq, and }) => and(eq(v.productId, product.id), eq(v.isActive, true)),
        columns: { id: true, optionValues: true },
    });

    const isUsed = activeVariants.some(
        (v) => v.optionValues && typeof v.optionValues === "object" && existingOption.name in v.optionValues
    );
    if (isUsed) {
        throw new ConflictError(`Cannot delete option '${existingOption.name}' because it is in use by active variants. Delete or update the variants first.`);
    }

    await db.delete(productOptionsTable).where(eq(productOptionsTable.id, optionId));
};

export const createOptionValue = async (
    productSlug: TProductSlug,
    optionId: string,
    input: TCreateOptionValueInput
): Promise<TOptionValueItem> => {
    const parsed = CreateOptionValueSchema.parse(input);
    const product = await db.query.productsTable.findFirst({
        where: (p, { eq, and, isNull }) => and(eq(p.slug, productSlug), isNull(p.deletedAt)),
        columns: { id: true },
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }

    const option = await db.query.productOptionsTable.findFirst({
        where: (o, { eq, and }) => and(eq(o.id, optionId), eq(o.productId, product.id)),
    });
    if (!option) {
        throw new NotFoundError("Option not found on this product");
    }

    const existingValue = await db.query.productOptionValuesTable.findFirst({
        where: (ov, { eq, and }) => and(eq(ov.optionId, optionId), eq(ov.value, parsed.value)),
    });
    if (existingValue) {
        throw new ConflictError(`Option value '${parsed.value}' already exists for this option`);
    }

    const [value] = await db.insert(productOptionValuesTable).values({
        optionId,
        value: parsed.value,
        position: parsed.position,
        swatchMeta: parsed.swatchMeta ?? null,
    }).returning();

    return OptionValueItemSchema.parse(value);
};

export const updateOptionValue = async (
    productSlug: TProductSlug,
    optionId: string,
    valueId: string,
    input: TUpdateOptionValueInput
): Promise<TOptionValueItem> => {
    const parsed = UpdateOptionValueSchema.parse(input);
    const product = await db.query.productsTable.findFirst({
        where: (p, { eq, and, isNull }) => and(eq(p.slug, productSlug), isNull(p.deletedAt)),
        columns: { id: true },
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }

    const option = await db.query.productOptionsTable.findFirst({
        where: (o, { eq, and }) => and(eq(o.id, optionId), eq(o.productId, product.id)),
    });
    if (!option) {
        throw new NotFoundError("Option not found on this product");
    }

    const existingValue = await db.query.productOptionValuesTable.findFirst({
        where: (ov, { eq, and }) => and(eq(ov.id, valueId), eq(ov.optionId, optionId)),
    });
    if (!existingValue) {
        throw new NotFoundError("Option value not found");
    }

    if (parsed.value && parsed.value !== existingValue.value) {
        const valTaken = await db.query.productOptionValuesTable.findFirst({
            where: (ov, { eq, and, ne }) => and(eq(ov.optionId, optionId), eq(ov.value, parsed.value!), ne(ov.id, valueId)),
        });
        if (valTaken) {
            throw new ConflictError(`Option value '${parsed.value}' already exists for this option`);
        }
    }

    const [updated] = await db.update(productOptionValuesTable)
        .set(parsed)
        .where(eq(productOptionValuesTable.id, valueId))
        .returning();

    return OptionValueItemSchema.parse(updated);
};

export const deleteOptionValue = async (
    productSlug: TProductSlug,
    optionId: string,
    valueId: string
): Promise<void> => {
    const product = await db.query.productsTable.findFirst({
        where: (p, { eq, and, isNull }) => and(eq(p.slug, productSlug), isNull(p.deletedAt)),
        columns: { id: true },
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }

    const option = await db.query.productOptionsTable.findFirst({
        where: (o, { eq, and }) => and(eq(o.id, optionId), eq(o.productId, product.id)),
    });
    if (!option) {
        throw new NotFoundError("Option not found on this product");
    }

    const existingValue = await db.query.productOptionValuesTable.findFirst({
        where: (ov, { eq, and }) => and(eq(ov.id, valueId), eq(ov.optionId, optionId)),
    });
    if (!existingValue) {
        throw new NotFoundError("Option value not found");
    }

    const activeVariants = await db.query.productVariantsTable.findMany({
        where: (v, { eq, and }) => and(eq(v.productId, product.id), eq(v.isActive, true)),
        columns: { id: true, optionValues: true },
    });

    const isUsed = activeVariants.some(
        (v) => v.optionValues && typeof v.optionValues === "object" && v.optionValues[option.name] === existingValue.value
    );
    if (isUsed) {
        throw new ConflictError(`Cannot delete option value '${existingValue.value}' because it is in use by active variants. Delete or update the variants first.`);
    }

    await db.delete(productOptionValuesTable).where(eq(productOptionValuesTable.id, valueId));
};

export const generateVariantMatrix = async (
    productSlug: TProductSlug,
    input: TGenerateMatrixInput
) => {
    const parsed = GenerateMatrixInputSchema.parse(input);
    const product = await db.query.productsTable.findFirst({
        where: (p, { eq, and, isNull }) => and(eq(p.slug, productSlug), isNull(p.deletedAt)),
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }

    const permutations = generateCartesianPermutations(product.slug, parsed.options, parsed.skuPrefix);

    const defaultSell = parsed.defaultSellPrice ?? Number(product.sellPrice);
    const defaultPurchase = parsed.defaultPurchasePrice ?? 0;
    const defaultStock = parsed.defaultStock ?? Number(product.stock);
    const defaultInvType = parsed.defaultInventoryType ?? product.inventoryType ?? "discrete";

    if (parsed.preview) {
        return {
            preview: true,
            count: permutations.length,
            matrix: permutations.map((perm, idx) => ({
                title: perm.title,
                sku: perm.suggestedSku,
                optionValues: perm.optionValues,
                signature: perm.signature,
                sellPrice: defaultSell,
                purchasePrice: defaultPurchase,
                stock: defaultStock,
                inventoryType: defaultInvType,
                poolConsumptionRate: perm.poolConsumptionRate ?? parsed.defaultPoolConsumptionRate ?? null,
                isDefault: idx === 0,
            })),
        };
    }

    const createdVariants = await db.transaction(async (tx) => {
        for (let optIdx = 0; optIdx < parsed.options.length; optIdx++) {
            const opt = parsed.options[optIdx];
            let existingOption = await tx.query.productOptionsTable.findFirst({
                where: (o, { eq, and }) => and(eq(o.productId, product.id), eq(o.name, opt.name)),
            });

            if (!existingOption) {
                const [newOpt] = await tx.insert(productOptionsTable).values({
                    productId: product.id,
                    name: opt.name,
                    position: optIdx,
                    variantTypeId: opt.variantTypeId ?? null,
                }).returning();
                existingOption = newOpt;
            }

            for (let valIdx = 0; valIdx < opt.values.length; valIdx++) {
                const val = opt.values[valIdx];
                const existingVal = await tx.query.productOptionValuesTable.findFirst({
                    where: (ov, { eq, and }) => and(eq(ov.optionId, existingOption!.id), eq(ov.value, val.value)),
                });

                if (!existingVal) {
                    await tx.insert(productOptionValuesTable).values({
                        optionId: existingOption.id,
                        value: val.value,
                        position: valIdx,
                        swatchMeta: val.swatchMeta ?? null,
                    });
                }
            }
        }

        const existingVariants = await tx.query.productVariantsTable.findMany({
            where: (v, { eq }) => eq(v.productId, product.id),
        });

        const isOnlyDefaultDummy = existingVariants.length === 1 &&
            existingVariants[0].isDefault &&
            (!existingVariants[0].optionValues || Object.keys(existingVariants[0].optionValues).length === 0);

        if (isOnlyDefaultDummy) {
            await tx.delete(productVariantsTable).where(eq(productVariantsTable.id, existingVariants[0].id));
        }

        const existingDefault = isOnlyDefaultDummy ? null : await tx.query.productVariantsTable.findFirst({
            where: (v, { eq, and }) => and(eq(v.productId, product.id), eq(v.isDefault, true)),
        });

        const insertedVariants = [];
        for (let i = 0; i < permutations.length; i++) {
            const perm = permutations[i];
            const existing = await tx.query.productVariantsTable.findFirst({
                where: (v, { eq, and }) => and(eq(v.productId, product.id), eq(v.signature, perm.signature)),
            });

            if (existing) {
                insertedVariants.push(existing);
                continue;
            }

            let sku = perm.suggestedSku;
            let counter = 1;
            while (await tx.query.productVariantsTable.findFirst({ where: (v, { eq }) => eq(v.sku, sku) })) {
                sku = `${perm.suggestedSku}-${counter}`;
                counter++;
            }

            const isDefault = !existingDefault && i === 0;

            const [newVar] = await tx.insert(productVariantsTable).values({
                productId: product.id,
                title: perm.title,
                sku,
                optionValues: perm.optionValues,
                signature: perm.signature,
                inventoryType: defaultInvType,
                sellPrice: defaultSell,
                purchasePrice: defaultPurchase,
                stock: defaultStock,
                poolConsumptionRate: perm.poolConsumptionRate ?? parsed.defaultPoolConsumptionRate ?? null,
                isDefault,
                isActive: true,
            }).returning();

            insertedVariants.push(newVar);
        }

        await syncProductAggregateReadModel(tx, product.id);
        return insertedVariants;
    });

    return {
        preview: false,
        count: createdVariants.length,
        variants: createdVariants.map((v) => ({
            ...v,
            sellPrice: Number(v.sellPrice),
            purchasePrice: Number(v.purchasePrice),
            stock: Number(v.stock),
            poolConsumptionRate: v.poolConsumptionRate != null ? Number(v.poolConsumptionRate) : null,
        })),
    };
};

const productsActions = {
    getProducts,
    getProductBySlug,
    getAdminProducts,
    getAdminProductBySlug,
    createProduct,
    updateProductBySlug,
    deleteProductBySlug,
    restoreProductBySlug,
    suggestProducts,
    getRelatedProducts,
    getProductFacets,
    addVariantToProduct,
    updateVariant,
    deleteVariant,
    createProductOption,
    updateProductOption,
    deleteProductOption,
    createOptionValue,
    updateOptionValue,
    deleteOptionValue,
    generateVariantMatrix,
    syncProductAggregateReadModel,
    createVariantType,
    getVariantTypes,
    getVariantTypeById,
    updateVariantType,
    deleteVariantType,
};

export default productsActions;