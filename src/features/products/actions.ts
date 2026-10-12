import {
    AdminProductsListSchema,
    CreateProductVariantSchema,
    GetProductPublicSchema,
    GetProductSchema,
    GetProductsPublicSchema,
    ProductsListSchema,
    ProductSuggestionsSchema,
    ProductVariantSchema,
    UpdateProductVariantSchema,
    type TAdminProductQuery,
    type TAdminProductsList,
    type TPaginationMeta,
    type TProductQuery,
    type TProductsList,
    type TCreateProductOutput,
    type TCreateProductVariantInput,
    type TGetProduct,
    type TGetProductPublic,
    type TGetProductsPublic,
    type TProductModel,
    type TProductSlug,
    type TProductVariant,
    type TUpdateProductOutput,
    type TUpdateProductVariantInput,
    type TSuggestQuery,
    type TProductSuggestions,
} from "./types";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/error";
import { db } from "@/lib/drizzle";
import { categoriesTable, productCategoriesTable, productsTable, productVariantsTable } from "@/lib/drizzle/schemas/public";
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
    productCategories?: Array<{ isPrimary: boolean; category: { id: string; name: string; slug: string } }>;
    variants?: Array<{
        id: string;
        productId: string;
        title: string;
        weightValue: string | number;
        weightUnit: string;
        sku: string;
        purchasePrice?: string | number;
        sellPrice: string | number;
        stock: string | number;
        isDefault: boolean;
        isActive: boolean;
        imageUrl: string | null;
        createdAt?: Date | string;
        updatedAt?: Date | string;
    }>;
}>(product: T) {
    const { productCategories, variants, ...rest } = product;
    return {
        ...rest,
        categories: (productCategories ?? []).map((pc) => ({
            id: pc.category.id,
            name: pc.category.name,
            slug: pc.category.slug,
            isPrimary: pc.isPrimary,
        })),
        variants: (variants ?? []).map((v) => ({
            ...v,
            weightValue: Number(v.weightValue),
            sellPrice: Number(v.sellPrice),
            stock: Number(v.stock),
            ...(v.purchasePrice !== undefined ? { purchasePrice: Number(v.purchasePrice) } : {}),
        })),
    };
}

const getProducts = async (query: TProductQuery): Promise<TProductsList> => {
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
                purchasePrice: false,
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
                        purchasePrice: false,
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

const getProductBySlug = async (slug: TProductSlug): Promise<TGetProductPublic> => {
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
            purchasePrice: false,
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
            variants: {
                where: (variant, { eq }) => eq(variant.isActive, true),
                orderBy: (variant, { asc }) => [asc(variant.weightValue)],
            },
        },
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }
    return GetProductPublicSchema.parse(mapProductCategories(product));
};

const getAdminProductBySlug = async (slug: TProductSlug): Promise<TGetProduct> => {
    const product = await db.query.productsTable.findFirst({
        where: (product, { eq }) => {
            return eq(product.slug, slug);
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
            variants: {
                orderBy: (variant, { asc }) => [asc(variant.weightValue)],
            },
        },
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }
    return GetProductSchema.parse(mapProductCategories(product));
};

const getAdminProducts = async (query: TAdminProductQuery): Promise<TAdminProductsList> => {
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

const createProduct = async (data: TCreateProductOutput): Promise<TProductModel> => {
    if (data.status === "scheduled" && !data.publishedAt) {
        throw new BadRequestError("publishedAt is required when status is 'scheduled'");
    }
    if (data.status === "published" && !data.publishedAt) {
        data.publishedAt = new Date();
    }

    const { categoryIds, primaryCategoryId, variants, ...productInsertData } = data;

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

        if (!slugTaken) {
            break;
        }
        if (explicitSlug) {
            throw new ConflictError("A product with this slug already exists");
        }
        slug = `${baseSlug}-${attempt + 1}`;
        if (attempt === 10) {
            throw new ConflictError("Could not generate a unique slug");
        }
    }

    const [product] = await db.insert(productsTable).values({ ...productInsertData, slug }).returning();

    if (categoryIds && categoryIds.length > 0) {
        await db.insert(productCategoriesTable).values(
            categoryIds.map((catId, index) => ({
                productId: product.id,
                categoryId: catId,
                isPrimary: primaryCategoryId ? catId === primaryCategoryId : index === 0,
            }))
        );
    }

    if (variants && variants.length > 0) {
        for (let i = 0; i < variants.length; i++) {
            const v = variants[i];
            const sku = v.sku?.trim() || `${product.slug}-${v.weightValue}${v.weightUnit}`.toLowerCase();
            const title = v.title?.trim() || `${v.weightValue}${v.weightUnit}`;
            const isDefault = v.isDefault ?? (i === 0);

            await db.insert(productVariantsTable).values({
                productId: product.id,
                title,
                weightValue: v.weightValue,
                weightUnit: v.weightUnit,
                sku,
                purchasePrice: v.purchasePrice,
                sellPrice: v.sellPrice,
                stock: v.stock ?? 0,
                isDefault,
                isActive: v.isActive ?? true,
                imageUrl: v.imageUrl ?? null,
            });
        }
    }

    return product;
};

const updateProductBySlug = async (slug: TProductSlug, data: TUpdateProductOutput["data"]): Promise<TProductModel> => {
    const existingProduct = await db.query.productsTable.findFirst({
        where: (product, { eq, and, isNull }) => {
            return and(eq(product.slug, slug), isNull(product.deletedAt));
        },
    });
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

        if (data.slug && data.slug !== slug) {
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

            updateData = { ...updateData, slug: newSlug };
        }

        const { categoryIds, primaryCategoryId, variants, ...productUpdateData } = updateData;

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

        if (variants !== undefined) {
            await db.delete(productVariantsTable).where(eq(productVariantsTable.productId, existingProduct.id));
            if (variants.length > 0) {
                const targetSlug = updateData.slug ?? existingProduct.slug;
                for (let i = 0; i < variants.length; i++) {
                    const v = variants[i];
                    const sku = v.sku?.trim() || `${targetSlug}-${v.weightValue}${v.weightUnit}`.toLowerCase();
                    const title = v.title?.trim() || `${v.weightValue}${v.weightUnit}`;
                    const isDefault = v.isDefault ?? (i === 0);

                    await db.insert(productVariantsTable).values({
                        productId: existingProduct.id,
                        title,
                        weightValue: v.weightValue,
                        weightUnit: v.weightUnit,
                        sku,
                        purchasePrice: v.purchasePrice,
                        sellPrice: v.sellPrice,
                        stock: v.stock ?? 0,
                        isDefault,
                        isActive: v.isActive ?? true,
                        imageUrl: v.imageUrl ?? null,
                    });
                }
            }
        }

        const [product] = await db.update(productsTable)
            .set(productUpdateData)
            .where(and(eq(productsTable.slug, slug), isNull(productsTable.deletedAt)))
            .returning();

        return product;
    }
    throw new NotFoundError("Product not found");
};

const deleteProductBySlug = async (slug: TProductSlug): Promise<TProductModel> => {
    const [product] = await db.update(productsTable)
        .set({ deletedAt: new Date() })
        .where(and(eq(productsTable.slug, slug), isNull(productsTable.deletedAt)))
        .returning();

    if (!product) {
        throw new NotFoundError("Product not found");
    }
    return product;
};

const restoreProductBySlug = async (slug: TProductSlug): Promise<TProductModel> => {
    const [product] = await db.update(productsTable)
        .set({ deletedAt: null })
        .where(and(eq(productsTable.slug, slug), isNotNull(productsTable.deletedAt)))
        .returning();

    if (!product) {
        throw new NotFoundError("Product not found");
    }
    return product;
};

const suggestProducts = async (query: TSuggestQuery): Promise<TProductSuggestions> => {
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

    // Trigram fuzzy fallback for product suggestions if exact prefix search yielded 0 matches
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

    // Trigram fuzzy fallback for categories if prefix match yielded 0 matches
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

const getRelatedProducts = async (slug: TProductSlug, limit: number = 8): Promise<TGetProductsPublic> => {
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
            purchasePrice: false,
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

const addVariantToProduct = async (
    productSlug: TProductSlug,
    input: TCreateProductVariantInput
): Promise<TProductVariant> => {
    const parsed = CreateProductVariantSchema.parse(input);

    const product = await db.query.productsTable.findFirst({
        where: (p, { eq, and, isNull }) => and(eq(p.slug, productSlug), isNull(p.deletedAt)),
        columns: { id: true, slug: true },
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }

    const sku = parsed.sku?.trim() || `${product.slug}-${parsed.weightValue}${parsed.weightUnit}`.toLowerCase();
    const title = parsed.title?.trim() || `${parsed.weightValue}${parsed.weightUnit}`;

    const existingSku = await db.query.productVariantsTable.findFirst({
        where: (v, { eq }) => eq(v.sku, sku),
        columns: { id: true },
    });
    if (existingSku) {
        throw new ConflictError(`Variant SKU '${sku}' is already in use`);
    }

    const existingWeight = await db.query.productVariantsTable.findFirst({
        where: (v, { eq, and }) =>
            and(
                eq(v.productId, product.id),
                eq(v.weightValue, parsed.weightValue),
                eq(v.weightUnit, parsed.weightUnit)
            ),
        columns: { id: true },
    });
    if (existingWeight) {
        throw new ConflictError(`A variant with weight ${parsed.weightValue}${parsed.weightUnit} already exists for this product`);
    }

    let isDefault = parsed.isDefault;
    if (isDefault) {
        await db
            .update(productVariantsTable)
            .set({ isDefault: false })
            .where(eq(productVariantsTable.productId, product.id));
    } else {
        const existingCount = await db.$count(
            productVariantsTable,
            eq(productVariantsTable.productId, product.id)
        );
        if (existingCount === 0) {
            isDefault = true;
        }
    }

    const [variant] = await db
        .insert(productVariantsTable)
        .values({
            productId: product.id,
            title,
            weightValue: parsed.weightValue,
            weightUnit: parsed.weightUnit,
            sku,
            purchasePrice: parsed.purchasePrice,
            sellPrice: parsed.sellPrice,
            stock: parsed.stock,
            isDefault,
            isActive: parsed.isActive,
            imageUrl: parsed.imageUrl ?? null,
        })
        .returning();

    return ProductVariantSchema.parse({
        ...variant,
        weightValue: Number(variant.weightValue),
        purchasePrice: Number(variant.purchasePrice),
        sellPrice: Number(variant.sellPrice),
        stock: Number(variant.stock),
    });
};

const updateVariant = async (
    productSlug: TProductSlug,
    variantId: string,
    input: TUpdateProductVariantInput
): Promise<TProductVariant> => {
    const parsed = UpdateProductVariantSchema.parse(input);

    const product = await db.query.productsTable.findFirst({
        where: (p, { eq, and, isNull }) => and(eq(p.slug, productSlug), isNull(p.deletedAt)),
        columns: { id: true, slug: true },
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

    const targetWeightValue = parsed.weightValue ?? Number(existingVariant.weightValue);
    const targetWeightUnit = parsed.weightUnit ?? existingVariant.weightUnit;
    if (
        (parsed.weightValue !== undefined && parsed.weightValue !== Number(existingVariant.weightValue)) ||
        (parsed.weightUnit !== undefined && parsed.weightUnit !== existingVariant.weightUnit)
    ) {
        const weightTaken = await db.query.productVariantsTable.findFirst({
            where: (v, { eq, and, ne }) =>
                and(
                    eq(v.productId, product.id),
                    eq(v.weightValue, targetWeightValue),
                    eq(v.weightUnit, targetWeightUnit),
                    ne(v.id, variantId)
                ),
            columns: { id: true },
        });
        if (weightTaken) {
            throw new ConflictError(`A variant with weight ${targetWeightValue}${targetWeightUnit} already exists for this product`);
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
        .set(parsed)
        .where(eq(productVariantsTable.id, variantId))
        .returning();

    return ProductVariantSchema.parse({
        ...updated,
        weightValue: Number(updated.weightValue),
        purchasePrice: Number(updated.purchasePrice),
        sellPrice: Number(updated.sellPrice),
        stock: Number(updated.stock),
    });
};

const deleteVariant = async (
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

    await db.delete(productVariantsTable).where(eq(productVariantsTable.id, variantId));

    if (existingVariant.isDefault) {
        const nextVariant = await db.query.productVariantsTable.findFirst({
            where: (v, { eq }) => eq(v.productId, product.id),
            orderBy: (v, { asc }) => [asc(v.weightValue)],
        });
        if (nextVariant) {
            await db
                .update(productVariantsTable)
                .set({ isDefault: true })
                .where(eq(productVariantsTable.id, nextVariant.id));
        }
    }
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
};

export default productsActions;