import { CreateProductSchema, type TCreateProductInput } from "@/features/products/types";
import { slugify } from "@/lib/slug";
import { db } from "./index";
import {
    categoriesTable,
    customerAddressesTable,
    customerAuditLogsTable,
    customersTable,
    productCategoriesTable,
    productOptionsTable,
    productOptionValuesTable,
    productsTable,
    productVariantsTable,
    variantTypesTable,
    variantTypeValuesTable,
} from "./schemas/public";
import { normalizeVariantSignature } from "@/features/products/matrix";
import { syncProductAggregateReadModel } from "@/features/products/actions";
import { eq } from "drizzle-orm";

interface SeedProductItem extends Omit<TCreateProductInput, "categoryIds" | "primaryCategoryId"> {
    categorySlug: string;
    parentCategorySlug: string;
}

interface SeedVariantType {
    name: string;
    code: string;
    description: string;
    defaultInventoryType: "discrete" | "shared_pool" | "no_tracking";
    position: number;
    isActive: boolean;
    values: Array<{
        value: string;
        position: number;
        swatchMeta?: string | null;
        defaultConsumptionRate?: number | null;
    }>;
}

interface SeedCustomerAddress {
    recipientName: string;
    company?: string | null;
    phone: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state?: string | null;
    postalCode: string;
    countryCode: string;
    addressType: "shipping" | "billing" | "both";
    isDefaultShipping: boolean;
    isDefaultBilling: boolean;
}

interface SeedCustomerAuditLog {
    actorType: "customer" | "admin" | "system";
    action: string;
    changes: Record<string, unknown>;
}

interface SeedCustomerItem {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    customerType: "registered" | "guest";
    status: "active" | "suspended" | "archived";
    riskScore: number;
    adminNotes?: string | null;
    tags: string[];
    totalOrders: number;
    totalSpent: string;
    metadata?: Record<string, unknown>;
    addresses: SeedCustomerAddress[];
    auditLogs: SeedCustomerAuditLog[];
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

const seedVariantTypes: SeedVariantType[] = [
    {
        name: "Capacity",
        code: "capacity",
        description: "Container capacity and fluid volume",
        defaultInventoryType: "discrete",
        position: 0,
        isActive: true,
        values: [
            { value: "500ml", position: 0 },
            { value: "750ml", position: 1 },
            { value: "1000ml", position: 2 },
        ],
    },
    {
        name: "Color",
        code: "color",
        description: "Visual appearance colorways",
        defaultInventoryType: "discrete",
        position: 1,
        isActive: true,
        values: [
            { value: "Black", swatchMeta: "#000000", position: 0 },
            { value: "White", swatchMeta: "#FFFFFF", position: 1 },
        ],
    },
    {
        name: "Size",
        code: "size",
        description: "Apparel standard garment sizing",
        defaultInventoryType: "discrete",
        position: 2,
        isActive: true,
        values: [
            { value: "M", position: 0 },
            { value: "L", position: 1 },
        ],
    },
    {
        name: "Package Size",
        code: "package_size",
        description: "Bulk pantry and grain packaging portions",
        defaultInventoryType: "shared_pool",
        position: 3,
        isActive: true,
        values: [
            { value: "500g", position: 0, defaultConsumptionRate: 0.5 },
            { value: "1kg", position: 1, defaultConsumptionRate: 1.0 },
            { value: "5kg", position: 2, defaultConsumptionRate: 5.0 },
        ],
    },
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
        stock: "120",
        allowBackorder: false,
        weight: 0.25,
        packageLength: 20.5,
        packageWidth: 18.0,
        packageHeight: 8.5,
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
        stock: "45",
        allowBackorder: false,
        weight: 18.5,
        packageLength: 70.0,
        packageWidth: 65.0,
        packageHeight: 40.0,
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
        allowBackorder: false,
        weight: 0.35,
        packageLength: 8.0,
        packageWidth: 8.0,
        packageHeight: 28.0,
        options: [
            {
                name: "Capacity",
                values: [
                    { value: "500ml", position: 0 },
                    { value: "750ml", position: 1 },
                    { value: "1000ml", position: 2 },
                ],
            },
        ],
        variants: [
            {
                title: "500ml",
                optionValues: { Capacity: "500ml" },
                purchasePrice: 5.0,
                sellPrice: 12.99,
                stock: 100,
                allowBackorder: false,
                weight: 0.28,
                packageLength: 7.5,
                packageWidth: 7.5,
                packageHeight: 24.0,
                isDefault: false,
                isActive: true,
            },
            {
                title: "750ml",
                optionValues: { Capacity: "750ml" },
                purchasePrice: 6.5,
                sellPrice: 14.99,
                stock: 120,
                allowBackorder: false,
                weight: 0.35,
                packageLength: 8.0,
                packageWidth: 8.0,
                packageHeight: 28.0,
                isDefault: true,
                isActive: true,
            },
            {
                title: "1000ml",
                optionValues: { Capacity: "1000ml" },
                purchasePrice: 8.0,
                sellPrice: 18.99,
                stock: 80,
                allowBackorder: false,
                weight: 0.45,
                packageLength: 8.5,
                packageWidth: 8.5,
                packageHeight: 32.0,
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
        status: "published",
        publishedAt: new Date(),
        purchasePrice: "8.00",
        sellPrice: "19.99",
        stock: "200",
        allowBackorder: true,
        weight: 0.20,
        packageLength: 30.0,
        packageWidth: 25.0,
        packageHeight: 2.0,
        options: [
            {
                name: "Color",
                values: [
                    { value: "Black", swatchMeta: "#000000", position: 0 },
                    { value: "White", swatchMeta: "#FFFFFF", position: 1 },
                ],
            },
            {
                name: "Size",
                values: [
                    { value: "M", position: 0 },
                    { value: "L", position: 1 },
                ],
            },
        ],
        variants: [
            {
                title: "Black / M",
                optionValues: { Color: "Black", Size: "M" },
                purchasePrice: 8.0,
                sellPrice: 19.99,
                stock: 50,
                allowBackorder: true,
                weight: 0.18,
                packageLength: 30.0,
                packageWidth: 25.0,
                packageHeight: 2.0,
                isDefault: true,
                isActive: true,
            },
            {
                title: "Black / L",
                optionValues: { Color: "Black", Size: "L" },
                purchasePrice: 8.0,
                sellPrice: 19.99,
                stock: 50,
                allowBackorder: true,
                weight: 0.22,
                packageLength: 30.0,
                packageWidth: 25.0,
                packageHeight: 2.0,
                isDefault: false,
                isActive: true,
            },
            {
                title: "White / M",
                optionValues: { Color: "White", Size: "M" },
                purchasePrice: 8.0,
                sellPrice: 19.99,
                stock: 50,
                allowBackorder: true,
                weight: 0.18,
                packageLength: 30.0,
                packageWidth: 25.0,
                packageHeight: 2.0,
                isDefault: false,
                isActive: true,
            },
            {
                title: "White / L",
                optionValues: { Color: "White", Size: "L" },
                purchasePrice: 8.0,
                sellPrice: 19.99,
                stock: 50,
                allowBackorder: true,
                weight: 0.22,
                packageLength: 30.0,
                packageWidth: 25.0,
                packageHeight: 2.0,
                isDefault: false,
                isActive: true,
            },
        ],
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
        stock: "25",
        allowBackorder: false,
        weight: 14.5,
        packageLength: 135.0,
        packageWidth: 82.0,
        packageHeight: 14.0,
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
        stock: "150",
        allowBackorder: false,
        weight: 0.05,
        packageLength: 12.0,
        packageWidth: 8.0,
        packageHeight: 4.0,
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
        stock: "80",
        allowBackorder: false,
        weight: 1.2,
        packageLength: 46.0,
        packageWidth: 28.0,
        packageHeight: 7.0,
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
        stock: "500",
        allowBackorder: false,
        weight: 0.65,
        packageLength: 22.0,
        packageWidth: 22.0,
        packageHeight: 4.5,
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
        stock: "220",
        allowBackorder: false,
        weight: 0.22,
        packageLength: 15.0,
        packageWidth: 7.5,
        packageHeight: 2.5,
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
        stock: "340",
        allowBackorder: false,
        weight: 0.40,
        packageLength: 9.0,
        packageWidth: 9.0,
        packageHeight: 11.0,
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
        stock: "0",
        poolStock: "50",
        inventoryType: "shared_pool",
        allowBackorder: true,
        weight: 1.0,
        packageLength: 25.0,
        packageWidth: 15.0,
        packageHeight: 8.0,
        options: [
            {
                name: "Package Size",
                values: [
                    { value: "500g", position: 0 },
                    { value: "1kg", position: 1 },
                    { value: "5kg", position: 2 },
                ],
            },
        ],
        variants: [
            {
                title: "500g",
                optionValues: { "Package Size": "500g" },
                poolConsumptionRate: 0.5,
                inventoryType: "shared_pool",
                purchasePrice: 2.0,
                sellPrice: 2.99,
                stock: 0,
                allowBackorder: true,
                weight: 0.52,
                packageLength: 18.0,
                packageWidth: 12.0,
                packageHeight: 5.0,
                isDefault: false,
                isActive: true,
            },
            {
                title: "1kg",
                optionValues: { "Package Size": "1kg" },
                poolConsumptionRate: 1,
                inventoryType: "shared_pool",
                purchasePrice: 4.0,
                sellPrice: 5.5,
                stock: 0,
                allowBackorder: true,
                weight: 1.02,
                packageLength: 25.0,
                packageWidth: 15.0,
                packageHeight: 8.0,
                isDefault: true,
                isActive: true,
            },
            {
                title: "5kg",
                optionValues: { "Package Size": "5kg" },
                poolConsumptionRate: 5,
                inventoryType: "shared_pool",
                purchasePrice: 18.0,
                sellPrice: 24.99,
                stock: 0,
                allowBackorder: true,
                weight: 5.05,
                packageLength: 40.0,
                packageWidth: 28.0,
                packageHeight: 12.0,
                isDefault: false,
                isActive: true,
            },
        ],
    }
];

const seedCustomers: SeedCustomerItem[] = [
    {
        email: "shakilahmmedwakil.saw@gmail.com",
        firstName: "Shakil",
        lastName: "Ahmmed",
        phone: "+8801712345678",
        customerType: "registered",
        status: "active",
        riskScore: 0,
        adminNotes: "Platform administrator & VIP customer",
        tags: ["vip", "staff", "early-adopter"],
        totalOrders: 5,
        totalSpent: "499.50",
        metadata: { preferredContact: "email", loyaltyTier: "gold" },
        addresses: [
            {
                recipientName: "Shakil Ahmmed",
                company: "Grahok Inc.",
                phone: "+8801712345678",
                addressLine1: "House 12, Road 5, Dhanmondi",
                city: "Dhaka",
                postalCode: "1209",
                countryCode: "BD",
                addressType: "shipping",
                isDefaultShipping: true,
                isDefaultBilling: false,
            },
            {
                recipientName: "Shakil Ahmmed",
                phone: "+8801712345678",
                addressLine1: "House 12, Road 5, Dhanmondi",
                city: "Dhaka",
                postalCode: "1209",
                countryCode: "BD",
                addressType: "billing",
                isDefaultShipping: false,
                isDefaultBilling: true,
            },
        ],
        auditLogs: [
            {
                actorType: "system",
                action: "address_created",
                changes: { note: "Initial verified address creation" },
            },
        ],
    },
    {
        email: "jane.doe@example.com",
        firstName: "Jane",
        lastName: "Doe",
        phone: "+15552345678",
        customerType: "registered",
        status: "active",
        riskScore: 0,
        adminNotes: "Frequent buyer",
        tags: ["retail", "repeat-customer"],
        totalOrders: 3,
        totalSpent: "189.97",
        metadata: { source: "google-ads" },
        addresses: [
            {
                recipientName: "Jane Doe",
                company: "Acme Corp",
                phone: "+15552345678",
                addressLine1: "123 Market Street, Suite 400",
                city: "San Francisco",
                state: "CA",
                postalCode: "94105",
                countryCode: "US",
                addressType: "both",
                isDefaultShipping: true,
                isDefaultBilling: true,
            },
        ],
        auditLogs: [
            {
                actorType: "customer",
                action: "profile_updated",
                changes: { phone: "+15552345678" },
            },
        ],
    },
    {
        email: "alex.smith@example.com",
        firstName: "Alex",
        lastName: "Smith",
        phone: "+15559876543",
        customerType: "guest",
        status: "active",
        riskScore: 10,
        adminNotes: "One-off guest order",
        tags: ["guest-checkout"],
        totalOrders: 1,
        totalSpent: "29.99",
        metadata: { guestCheckoutIp: "192.168.1.100" },
        addresses: [
            {
                recipientName: "Alex Smith",
                phone: "+15559876543",
                addressLine1: "456 Broadway Ave",
                city: "New York",
                state: "NY",
                postalCode: "10001",
                countryCode: "US",
                addressType: "shipping",
                isDefaultShipping: true,
                isDefaultBilling: false,
            },
        ],
        auditLogs: [],
    },
    {
        email: "suspicious.user@example.com",
        firstName: "Robert",
        lastName: "Shady",
        phone: "+15551112233",
        customerType: "registered",
        status: "suspended",
        riskScore: 90,
        adminNotes: "Multiple chargeback warnings and suspicious transactions.",
        tags: ["high-risk", "flagged"],
        totalOrders: 0,
        totalSpent: "0.00",
        metadata: { flaggedReason: "chargeback_risk" },
        addresses: [],
        auditLogs: [
            {
                actorType: "admin",
                action: "risk_score_adjusted",
                changes: { previousScore: 0, newScore: 90, reason: "Chargeback disputes reported" },
            },
        ],
    },
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

    console.log("Seeding variant types and values...");
    const variantTypeMap = new Map<string, string>();

    for (const vt of seedVariantTypes) {
        let existing = await db.query.variantTypesTable.findFirst({
            where: (t, { eq }) => eq(t.code, vt.code),
        });

        if (!existing) {
            [existing] = await db.insert(variantTypesTable).values({
                name: vt.name,
                code: vt.code,
                description: vt.description,
                defaultInventoryType: vt.defaultInventoryType,
                position: vt.position,
                isActive: vt.isActive,
            }).returning();

            for (const val of vt.values) {
                await db.insert(variantTypeValuesTable).values({
                    variantTypeId: existing.id,
                    value: val.value,
                    position: val.position,
                    swatchMeta: val.swatchMeta ?? null,
                    defaultConsumptionRate: val.defaultConsumptionRate ?? null,
                });
            }
        }
        variantTypeMap.set(vt.name.toLowerCase(), existing.id);
    }

    console.log("Seeding products and linking categories...");
    for (const item of dummyProducts) {
        const { categorySlug, parentCategorySlug, ...productPayload } = item;
        const parsed = CreateProductSchema.parse(productPayload);
        const slug = slugify(parsed.slug ?? parsed.name);
        const { purchasePrice, categoryIds: _categoryIds, primaryCategoryId: _primaryCategoryId, options, variants, ...productInsertData } = parsed;
        void _categoryIds;
        void _primaryCategoryId;

        const initialSellPrice = variants && variants.length > 0
            ? Math.min(...variants.map((v) => Number(v.sellPrice)))
            : (parsed.sellPrice ?? 0);
        const initialStock = variants && variants.length > 0 && productInsertData.inventoryType === "discrete"
            ? variants.reduce((sum, v) => sum + Number(v.stock ?? 0), 0)
            : (parsed.stock ?? 0);

        let existingProduct = await db.query.productsTable.findFirst({
            where: (p, { eq }) => eq(p.slug, slug),
        });

        let productId: string;

        if (!existingProduct) {
            const [insertedProduct] = await db.insert(productsTable).values({
                ...productInsertData,
                sellPrice: initialSellPrice,
                stock: initialStock,
                slug,
            }).returning();

            existingProduct = insertedProduct;
            productId = insertedProduct.id;

            const childCatId = categoryMap.get(categorySlug);
            const parentCatId = categoryMap.get(parentCategorySlug);

            const categoryLinks: Array<{ productId: string; categoryId: string; isPrimary: boolean }> = [];
            if (childCatId) {
                categoryLinks.push({ productId, categoryId: childCatId, isPrimary: true });
            }
            if (parentCatId && parentCatId !== childCatId) {
                categoryLinks.push({ productId, categoryId: parentCatId, isPrimary: false });
            }

            if (categoryLinks.length > 0) {
                await db.insert(productCategoriesTable).values(categoryLinks);
            }

            if (options && options.length > 0) {
                for (let optIdx = 0; optIdx < options.length; optIdx++) {
                    const opt = options[optIdx];
                    const linkedVariantTypeId = variantTypeMap.get(opt.name.toLowerCase()) ?? opt.variantTypeId ?? null;
                    const [insertedOpt] = await db.insert(productOptionsTable).values({
                        productId,
                        name: opt.name,
                        position: opt.position ?? optIdx,
                        variantTypeId: linkedVariantTypeId,
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
                    const sku = (v.sku?.trim() || (v.optionValues && Object.keys(v.optionValues).length > 0
                        ? `${existingProduct.slug}-${Object.values(v.optionValues).map((val) => slugify(val).replace(/^-+|-+$/g, "")).join("-")}`
                        : `${existingProduct.slug}-default`
                    )).toLowerCase();
                    const isDefault = v.isDefault ?? (i === 0);
                    const variantInvType = v.inventoryType ?? existingProduct.inventoryType ?? "discrete";

                    await db.insert(productVariantsTable).values({
                        productId,
                        title,
                        sku,
                        optionValues: v.optionValues ?? {},
                        signature,
                        inventoryType: variantInvType,
                        allowBackorder: v.allowBackorder ?? existingProduct.allowBackorder ?? false,
                        purchasePrice: v.purchasePrice,
                        sellPrice: v.sellPrice,
                        stock: v.stock ?? 0,
                        poolConsumptionRate: v.poolConsumptionRate != null ? v.poolConsumptionRate : null,
                        weight: v.weight ?? (existingProduct.weight != null ? Number(existingProduct.weight) : null),
                        packageLength: v.packageLength ?? (existingProduct.packageLength != null ? Number(existingProduct.packageLength) : null),
                        packageWidth: v.packageWidth ?? (existingProduct.packageWidth != null ? Number(existingProduct.packageWidth) : null),
                        packageHeight: v.packageHeight ?? (existingProduct.packageHeight != null ? Number(existingProduct.packageHeight) : null),
                        isDefault,
                        isActive: v.isActive ?? true,
                        imageUrl: v.imageUrl ?? null,
                    });
                }
            } else {
                // Seed simple product default variant for canonical purchasable entity contract
                const defaultSku = `${existingProduct.slug}-default`.toLowerCase();
                const variantInvType = existingProduct.inventoryType ?? "discrete";

                await db.insert(productVariantsTable).values({
                    productId,
                    title: "Default",
                    sku: defaultSku,
                    optionValues: {},
                    signature: "default",
                    inventoryType: variantInvType,
                    allowBackorder: existingProduct.allowBackorder ?? false,
                    purchasePrice: purchasePrice ?? 0,
                    sellPrice: existingProduct.sellPrice,
                    stock: existingProduct.stock ?? 0,
                    poolConsumptionRate: null,
                    weight: existingProduct.weight != null ? Number(existingProduct.weight) : null,
                    packageLength: existingProduct.packageLength != null ? Number(existingProduct.packageLength) : null,
                    packageWidth: existingProduct.packageWidth != null ? Number(existingProduct.packageWidth) : null,
                    packageHeight: existingProduct.packageHeight != null ? Number(existingProduct.packageHeight) : null,
                    isDefault: true,
                    isActive: true,
                    imageUrl: existingProduct.featuredImageUrl ?? null,
                });
            }
        } else {
            // Update existing product with latest schema fields
            productId = existingProduct.id;
            await db.update(productsTable).set({
                allowBackorder: parsed.allowBackorder ?? false,
                weight: parsed.weight ?? null,
                packageLength: parsed.packageLength ?? null,
                packageWidth: parsed.packageWidth ?? null,
                packageHeight: parsed.packageHeight ?? null,
            }).where(eq(productsTable.id, productId));

            // Link variantTypeId to existing options if missing
            const existingOptions = await db.query.productOptionsTable.findMany({
                where: (o, { eq }) => eq(o.productId, productId),
            });
            for (const opt of existingOptions) {
                const linkedTypeId = variantTypeMap.get(opt.name.toLowerCase());
                if (linkedTypeId && !opt.variantTypeId) {
                    await db.update(productOptionsTable).set({
                        variantTypeId: linkedTypeId,
                    }).where(eq(productOptionsTable.id, opt.id));
                }
            }

            // Update variants with new schema fields
            const existingVariants = await db.query.productVariantsTable.findMany({
                where: (v, { eq }) => eq(v.productId, productId),
            });

            if (variants && variants.length > 0) {
                for (const v of variants) {
                    const signature = v.signature?.trim() || normalizeVariantSignature(v.optionValues);
                    const matchingVariant = existingVariants.find((ev) => ev.signature === signature);
                    if (matchingVariant) {
                        await db.update(productVariantsTable).set({
                            allowBackorder: v.allowBackorder ?? parsed.allowBackorder ?? false,
                            weight: v.weight ?? parsed.weight ?? null,
                            packageLength: v.packageLength ?? parsed.packageLength ?? null,
                            packageWidth: v.packageWidth ?? parsed.packageWidth ?? null,
                            packageHeight: v.packageHeight ?? parsed.packageHeight ?? null,
                        }).where(eq(productVariantsTable.id, matchingVariant.id));
                    }
                }
            } else {
                // Update default variant
                const defaultVariant = existingVariants.find((ev) => ev.signature === "default" || ev.isDefault);
                if (defaultVariant) {
                    await db.update(productVariantsTable).set({
                        allowBackorder: parsed.allowBackorder ?? false,
                        weight: parsed.weight ?? null,
                        packageLength: parsed.packageLength ?? null,
                        packageWidth: parsed.packageWidth ?? null,
                        packageHeight: parsed.packageHeight ?? null,
                    }).where(eq(productVariantsTable.id, defaultVariant.id));
                }
            }
        }
        await syncProductAggregateReadModel(db, productId);
    }
    console.log(`Synced ${dummyProducts.length} products with category associations, variants, logistics metrics, and backorders.`);

    console.log("Seeding customers, addresses, and audit logs...");
    const existingCustomers = await db.query.customersTable.findMany();

    // Check if auth user exists for primary registered customer
    const authAdminUser = await db.query.user.findFirst({
        where: (u, { eq }) => eq(u.email, "shakilahmmedwakil.saw@gmail.com"),
    });

    for (const cust of seedCustomers) {
        let existingCust = existingCustomers.find((c) => c.email.toLowerCase() === cust.email.toLowerCase());
        const authUserId = (cust.email === authAdminUser?.email) ? authAdminUser.id : null;

        if (!existingCust) {
            const [insertedCust] = await db.insert(customersTable).values({
                email: cust.email,
                authUserId,
                firstName: cust.firstName,
                lastName: cust.lastName,
                phone: cust.phone,
                customerType: cust.customerType,
                status: cust.status,
                riskScore: cust.riskScore,
                adminNotes: cust.adminNotes ?? null,
                tags: cust.tags,
                metadata: cust.metadata ?? {},
                totalOrders: cust.totalOrders,
                totalSpent: cust.totalSpent,
            }).returning();

            existingCust = insertedCust;

            for (const addr of cust.addresses) {
                await db.insert(customerAddressesTable).values({
                    customerId: insertedCust.id,
                    recipientName: addr.recipientName,
                    company: addr.company ?? null,
                    phone: addr.phone,
                    addressLine1: addr.addressLine1,
                    addressLine2: addr.addressLine2 ?? null,
                    city: addr.city,
                    state: addr.state ?? null,
                    postalCode: addr.postalCode,
                    countryCode: addr.countryCode,
                    addressType: addr.addressType,
                    isDefaultShipping: addr.isDefaultShipping,
                    isDefaultBilling: addr.isDefaultBilling,
                });
            }

            for (const log of cust.auditLogs) {
                await db.insert(customerAuditLogsTable).values({
                    customerId: insertedCust.id,
                    actorId: authUserId ?? "system",
                    actorType: log.actorType,
                    action: log.action,
                    changes: log.changes,
                });
            }
        }
    }
    console.log(`Synced ${seedCustomers.length} customers with addresses and audit logs.`);
    console.log("Database seed completed successfully! 🚀");
}

seed().catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
});
