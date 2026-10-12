import { CreateProductSchema, type TCreateProductInput } from "@/features/products/types";
import { slugify } from "@/lib/slug";
import { db } from "./index";
import { categoriesTable, productCategoriesTable, productsTable, productVariantsTable } from "./schemas/public";

interface SeedProductItem extends Omit<TCreateProductInput, "categoryIds" | "primaryCategoryId"> {
    categorySlug: string;
    parentCategorySlug: string;
}

const seedCategories = [
    { name: "Electronics", slug: "electronics", parentSlug: null },
    { name: "Audio", slug: "audio", parentSlug: "electronics" },
    { name: "TV & Video", slug: "tv-video", parentSlug: "electronics" },
    { name: "Wearables", slug: "wearables", parentSlug: "electronics" },
    { name: "Accessories", slug: "electronics-accessories", parentSlug: "electronics" },
    { name: "Furniture", slug: "furniture", parentSlug: null },
    { name: "Office Furniture", slug: "office-furniture", parentSlug: "furniture" },
    { name: "Home & Kitchen", slug: "home-kitchen", parentSlug: null },
    { name: "Drinkware", slug: "drinkware", parentSlug: "home-kitchen" },
    { name: "Cookware", slug: "cookware", parentSlug: "home-kitchen" },
    { name: "Home Fragrance", slug: "home-fragrance", parentSlug: "home-kitchen" },
    { name: "Grains & Staples", slug: "grains-staples", parentSlug: "home-kitchen" },
    { name: "Apparel", slug: "apparel", parentSlug: null },
    { name: "Tops", slug: "tops", parentSlug: "apparel" },
    { name: "Toys & Games", slug: "toys-games", parentSlug: null },
    { name: "Puzzles", slug: "puzzles", parentSlug: "toys-games" },
];

const dummyProducts: SeedProductItem[] = [
    {
        name: "Wireless Noise-Cancelling Headphones",
        slug: "wireless-noise-cancelling-headphones",
        parentCategorySlug: "electronics",
        categorySlug: "audio",
        tags: ["audio", "wireless", "headphones", "noise-cancelling"],
        shortDescription: "Industry-leading wireless noise-cancelling over-ear headphones with premium sound.",
        description: "Experience silence and acoustic fidelity with active noise cancellation, 30 hours of battery life, and ultra-comfortable earcups designed for all-day listening.",
        featuredImageUrl: "https://example.com/images/headphones-feature.jpg",
        images: [
            "https://example.com/images/headphones-1.jpg",
            "https://example.com/images/headphones-2.jpg"
        ],
        status: "published",
        publishedAt: new Date(),
        purchasePrice: "55.00",
        sellPrice: "99.99",
        stock: "120"
    },
    {
        name: "Ergonomic Office Chair",
        slug: "ergonomic-office-chair",
        parentCategorySlug: "furniture",
        categorySlug: "office-furniture",
        tags: ["chair", "office", "ergonomic"],
        shortDescription: "High-back mesh ergonomic desk chair with lumbar support and 3D armrests.",
        description: "Designed for 8+ hours of comfortable seating with breathable mesh, pneumatic seat adjustment, and tilt-lock mechanisms.",
        featuredImageUrl: "https://example.com/images/chair-feature.jpg",
        images: [
            "https://example.com/images/chair-1.jpg",
            "https://example.com/images/chair-2.jpg"
        ],
        status: "published",
        publishedAt: new Date(),
        purchasePrice: "120.00",
        sellPrice: "249.99",
        stock: "45"
    },
    {
        name: "Stainless Steel Water Bottle 750ml",
        slug: "stainless-steel-water-bottle-750ml",
        parentCategorySlug: "home-kitchen",
        categorySlug: "drinkware",
        tags: ["bottle", "stainless-steel", "water"],
        shortDescription: "Double-wall vacuum insulated stainless steel bottle keeping drinks cold for 24h.",
        description: "Eco-friendly, leak-proof, BPA-free stainless steel canteen engineered for fitness and outdoor adventures.",
        featuredImageUrl: "https://example.com/images/bottle-feature.jpg",
        images: [
            "https://example.com/images/bottle-1.jpg",
            "https://example.com/images/bottle-2.jpg"
        ],
        status: "published",
        publishedAt: new Date(),
        purchasePrice: "6.50",
        sellPrice: "14.99",
        stock: "300",
        variants: [
            {
                title: "500ml",
                weightValue: 500,
                weightUnit: "ml",
                purchasePrice: 5.0,
                sellPrice: 12.99,
                stock: 100,
                isDefault: false,
                isActive: true,
            },
            {
                title: "750ml",
                weightValue: 750,
                weightUnit: "ml",
                purchasePrice: 6.5,
                sellPrice: 14.99,
                stock: 120,
                isDefault: true,
                isActive: true,
            },
            {
                title: "1000ml",
                weightValue: 1000,
                weightUnit: "ml",
                purchasePrice: 8.0,
                sellPrice: 18.99,
                stock: 80,
                isDefault: false,
                isActive: true,
            },
        ],
    },
    {
        name: "Organic Cotton T-Shirt",
        slug: "organic-cotton-tshirt",
        parentCategorySlug: "apparel",
        categorySlug: "tops",
        tags: ["clothing", "organic", "tshirt"],
        shortDescription: "100% certified organic cotton crewneck tee with a soft, durable finish.",
        description: "Pre-shrunk, breathable everyday essential dyed with non-toxic botanical colors.",
        featuredImageUrl: "https://example.com/images/tshirt-feature.jpg",
        images: ["https://example.com/images/tshirt-1.jpg"],
        status: "draft",
        purchasePrice: "8.00",
        sellPrice: "19.99",
        stock: "200"
    },
    {
        name: "4K Ultra HD Smart TV 55 inch",
        slug: "4k-ultra-hd-smart-tv-55-inch",
        parentCategorySlug: "electronics",
        categorySlug: "tv-video",
        tags: ["tv", "4k", "smart-tv"],
        shortDescription: "Vibrant 55-inch 4K HDR smart television with built-in streaming apps.",
        description: "Cinema-grade visuals featuring Dolby Vision, HDR10+, and motion enhancement for ultra-smooth gaming and movies.",
        featuredImageUrl: "https://example.com/images/tv-feature.jpg",
        images: [
            "https://example.com/images/tv-1.jpg",
            "https://example.com/images/tv-2.jpg",
            "https://example.com/images/tv-3.jpg"
        ],
        status: "published",
        publishedAt: new Date(),
        purchasePrice: "350.00",
        sellPrice: "599.99",
        stock: "25"
    },
    {
        name: "Bluetooth Fitness Tracker",
        slug: "bluetooth-fitness-tracker",
        parentCategorySlug: "electronics",
        categorySlug: "wearables",
        tags: ["fitness", "wearable", "bluetooth"],
        shortDescription: "Waterproof fitness band with continuous heart rate and sleep tracking.",
        description: "Track 30+ sports modes, monitor SpO2, and enjoy 14-day battery life on a single magnetic charge.",
        featuredImageUrl: "https://example.com/images/tracker-feature.jpg",
        images: ["https://example.com/images/tracker-1.jpg"],
        status: "draft",
        purchasePrice: "15.00",
        sellPrice: "39.99",
        stock: "150"
    },
    {
        name: "Ceramic Non-Stick Frying Pan 10 inch",
        slug: "ceramic-non-stick-frying-pan-10-inch",
        parentCategorySlug: "home-kitchen",
        categorySlug: "cookware",
        tags: ["kitchen", "pan", "non-stick"],
        shortDescription: "Toxin-free mineral ceramic coating for effortless food release and cleanup.",
        description: "Even heat distribution on all stovetops including induction, oven-safe up to 450F.",
        featuredImageUrl: "https://example.com/images/pan-feature.jpg",
        images: ["https://example.com/images/pan-1.jpg"],
        status: "published",
        publishedAt: new Date(),
        purchasePrice: "9.00",
        sellPrice: "24.99",
        stock: "80"
    },
    {
        name: "Kids Wooden Puzzle Set",
        slug: "kids-wooden-puzzle-set",
        parentCategorySlug: "toys-games",
        categorySlug: "puzzles",
        tags: ["kids", "puzzle", "wooden"],
        shortDescription: "Eco-friendly educational wooden block puzzles for toddlers.",
        description: "Non-toxic water-based paints, smooth rounded edges, and vibrant colors supporting early cognitive development.",
        featuredImageUrl: "https://example.com/images/puzzle-feature.jpg",
        images: ["https://example.com/images/puzzle-1.jpg"],
        status: "draft",
        purchasePrice: "4.00",
        sellPrice: "12.99",
        stock: "500"
    },
    {
        name: "Portable Power Bank 10000mAh",
        slug: "portable-power-bank-10000mah",
        parentCategorySlug: "electronics",
        categorySlug: "electronics-accessories",
        tags: ["power", "battery", "portable"],
        shortDescription: "Ultra-slim 20W PD fast-charging battery pack with dual USB-C ports.",
        description: "Pocket-sized high-density polymer battery capable of charging modern smartphones to 50% in 30 minutes.",
        featuredImageUrl: "https://example.com/images/powerbank-feature.jpg",
        images: ["https://example.com/images/powerbank-1.jpg"],
        status: "published",
        publishedAt: new Date(),
        purchasePrice: "10.00",
        sellPrice: "29.99",
        stock: "220"
    },
    {
        name: "Handmade Soy Scented Candle - Lavender",
        slug: "handmade-soy-scented-candle-lavender",
        parentCategorySlug: "home-kitchen",
        categorySlug: "home-fragrance",
        tags: ["candle", "soy", "lavender"],
        shortDescription: "100% natural soy wax candle infused with organic French lavender essential oils.",
        description: "Clean-burning lead-free cotton wick providing 45+ hours of soothing aromatherapy burn time.",
        featuredImageUrl: "https://example.com/images/candle-feature.jpg",
        images: ["https://example.com/images/candle-1.jpg"],
        status: "published",
        publishedAt: new Date(),
        purchasePrice: "2.50",
        sellPrice: "9.99",
        stock: "340"
    },
    {
        name: "Premium Aromatic Basmati Rice",
        slug: "premium-aromatic-basmati-rice",
        parentCategorySlug: "home-kitchen",
        categorySlug: "grains-staples",
        tags: ["rice", "basmati", "grains", "staples", "organic"],
        shortDescription: "Aged long-grain royal basmati rice with exquisite aroma and fluffy texture.",
        description: "Sourced directly from Himalayan foothills, naturally aged for 2 years for authentic aroma and non-sticky elongated grains.",
        featuredImageUrl: "https://example.com/images/rice-feature.jpg",
        images: ["https://example.com/images/rice-1.jpg"],
        status: "published",
        publishedAt: new Date(),
        purchasePrice: "4.00",
        sellPrice: "5.50",
        stock: "50",
        inventoryType: "shared_pool",
        baseWeightUnit: "kg",
        variants: [
            {
                title: "500g",
                weightValue: 500,
                weightUnit: "g",
                purchasePrice: 2.0,
                sellPrice: 2.99,
                stock: 0,
                isDefault: false,
                isActive: true,
            },
            {
                title: "1kg",
                weightValue: 1,
                weightUnit: "kg",
                purchasePrice: 4.0,
                sellPrice: 5.5,
                stock: 0,
                isDefault: true,
                isActive: true,
            },
            {
                title: "5kg",
                weightValue: 5,
                weightUnit: "kg",
                purchasePrice: 18.0,
                sellPrice: 24.99,
                stock: 0,
                isDefault: false,
                isActive: true,
            },
        ],
    }
];

async function seed() {
    console.log("Seeding multi-level categories...");
    const categoryMap = new Map<string, string>();

    // 1. Seed root categories
    for (const cat of seedCategories.filter((c) => c.parentSlug === null)) {
        let existing = await db.query.categoriesTable.findFirst({
            where: (c, { eq }) => eq(c.slug, cat.slug),
        });
        if (!existing) {
            [existing] = await db.insert(categoriesTable).values({
                name: cat.name,
                slug: cat.slug,
                description: `${cat.name} category`,
            }).returning();
        }
        categoryMap.set(cat.slug, existing.id);
    }

    // 2. Seed child categories
    for (const cat of seedCategories.filter((c) => c.parentSlug !== null)) {
        let existing = await db.query.categoriesTable.findFirst({
            where: (c, { eq }) => eq(c.slug, cat.slug),
        });
        if (!existing) {
            const parentId = categoryMap.get(cat.parentSlug!);
            [existing] = await db.insert(categoriesTable).values({
                name: cat.name,
                slug: cat.slug,
                parentId: parentId ?? null,
                description: `${cat.name} subcategory`,
            }).returning();
        }
        categoryMap.set(cat.slug, existing.id);
    }

    console.log("Seeding products and linking categories...");
    const existingProducts = await db.query.productsTable.findMany();

    if (existingProducts.length === 0) {
        for (const item of dummyProducts) {
            const { categorySlug, parentCategorySlug, ...productPayload } = item;
            const parsed = CreateProductSchema.parse(productPayload);
            const slug = slugify(parsed.slug ?? parsed.name);
            const { categoryIds: _categoryIds, primaryCategoryId: _primaryCategoryId, variants, ...productInsertData } = parsed;
            void _categoryIds;
            void _primaryCategoryId;

            const [insertedProduct] = await db.insert(productsTable).values({
                ...productInsertData,
                slug,
            }).returning();

            const childCatId = categoryMap.get(categorySlug);
            const parentCatId = categoryMap.get(parentCategorySlug);

            const categoryLinks: Array<{ productId: string; categoryId: string; isPrimary: boolean }> = [];
            if (childCatId) {
                categoryLinks.push({ productId: insertedProduct.id, categoryId: childCatId, isPrimary: true });
            }
            if (parentCatId && parentCatId !== childCatId) {
                categoryLinks.push({ productId: insertedProduct.id, categoryId: parentCatId, isPrimary: false });
            }

            if (categoryLinks.length > 0) {
                await db.insert(productCategoriesTable).values(categoryLinks);
            }

            if (variants && variants.length > 0) {
                for (let i = 0; i < variants.length; i++) {
                    const v = variants[i];
                    const sku = v.sku?.trim() || `${insertedProduct.slug}-${v.weightValue}${v.weightUnit}`.toLowerCase();
                    const title = v.title?.trim() || `${v.weightValue}${v.weightUnit}`;
                    const isDefault = v.isDefault ?? (i === 0);

                    await db.insert(productVariantsTable).values({
                        productId: insertedProduct.id,
                        title,
                        weightValue: v.weightValue,
                        weightUnit: v.weightUnit,
                        sku,
                        purchasePrice: v.purchasePrice,
                        sellPrice: v.sellPrice,
                        stock: v.stock ?? 0,
                        poolConsumptionRate: v.poolConsumptionRate != null ? v.poolConsumptionRate : null,
                        isDefault,
                        isActive: v.isActive ?? true,
                        imageUrl: v.imageUrl ?? null,
                    });
                }
            }
        }
        console.log(`Inserted ${dummyProducts.length} products with category associations and variants.`);
    } else {
        console.log("Products table is already populated.");
    }
}

seed().catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
});
