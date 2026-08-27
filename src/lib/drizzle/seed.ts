import { CreateProductSchema, type TCreateProductInput } from "@/features/products/types";
import { slugify } from "@/lib/slug";
import { db } from "./index";
import { productsTable } from "./schemas/public";

const dummyProducts: TCreateProductInput[] = [
    {
        name: "Wireless Noise-Cancelling Headphones",
        slug: "wireless-noise-cancelling-headphones",
        category: "Electronics",
        subcategory: "Audio",
        tags: ["audio", "wireless", "headphones", "noise-cancelling"],
        featuredImageUrl: "https://example.com/images/headphones-feature.jpg",
        images: [
            "https://example.com/images/headphones-1.jpg",
            "https://example.com/images/headphones-2.jpg"
        ],
        isActive: true,
        purchasePrice: "55.00",
        sellPrice: "99.99",
        stock: "120"
    },
    {
        name: "Ergonomic Office Chair",
        slug: "ergonomic-office-chair",
        category: "Furniture",
        subcategory: "Office",
        tags: ["chair", "office", "ergonomic"],
        featuredImageUrl: "https://example.com/images/chair-feature.jpg",
        images: [
            "https://example.com/images/chair-1.jpg",
            "https://example.com/images/chair-2.jpg"
        ],
        isActive: true,
        purchasePrice: "120.00",
        sellPrice: "249.99",
        stock: "45"
    },
    {
        name: "Stainless Steel Water Bottle 750ml",
        slug: "stainless-steel-water-bottle-750ml",
        category: "Home & Kitchen",
        subcategory: "Drinkware",
        tags: ["bottle", "stainless-steel", "water"],
        featuredImageUrl: "https://example.com/images/bottle-feature.jpg",
        images: [
            "https://example.com/images/bottle-1.jpg",
            "https://example.com/images/bottle-2.jpg"
        ],
        isActive: true,
        purchasePrice: "6.50",
        sellPrice: "14.99",
        stock: "300"
    },
    {
        name: "Organic Cotton T-Shirt",
        slug: "organic-cotton-tshirt",
        category: "Apparel",
        subcategory: "Tops",
        tags: ["clothing", "organic", "tshirt"],
        featuredImageUrl: "https://example.com/images/tshirt-feature.jpg",
        images: ["https://example.com/images/tshirt-1.jpg"],
        isActive: false,
        purchasePrice: "8.00",
        sellPrice: "19.99",
        stock: "200"
    },
    {
        name: "4K Ultra HD Smart TV 55 inch",
        slug: "4k-ultra-hd-smart-tv-55-inch",
        category: "Electronics",
        subcategory: "TV & Video",
        tags: ["tv", "4k", "smart-tv"],
        featuredImageUrl: "https://example.com/images/tv-feature.jpg",
        images: [
            "https://example.com/images/tv-1.jpg",
            "https://example.com/images/tv-2.jpg",
            "https://example.com/images/tv-3.jpg"
        ],
        isActive: true,
        purchasePrice: "350.00",
        sellPrice: "599.99",
        stock: "25"
    },
    {
        name: "Bluetooth Fitness Tracker",
        slug: "bluetooth-fitness-tracker",
        category: "Electronics",
        subcategory: "Wearables",
        tags: ["fitness", "wearable", "bluetooth"],
        featuredImageUrl: "https://example.com/images/tracker-feature.jpg",
        images: ["https://example.com/images/tracker-1.jpg"],
        isActive: false,
        purchasePrice: "15.00",
        sellPrice: "39.99",
        stock: "150"
    },
    {
        name: "Ceramic Non-Stick Frying Pan 10 inch",
        slug: "ceramic-non-stick-frying-pan-10-inch",
        category: "Home & Kitchen",
        subcategory: "Cookware",
        tags: ["kitchen", "pan", "non-stick"],
        featuredImageUrl: "https://example.com/images/pan-feature.jpg",
        images: ["https://example.com/images/pan-1.jpg"],
        isActive: true,
        purchasePrice: "9.00",
        sellPrice: "24.99",
        stock: "80"
    },
    {
        name: "Kids Wooden Puzzle Set",
        slug: "kids-wooden-puzzle-set",
        category: "Toys & Games",
        subcategory: "Puzzles",
        tags: ["kids", "puzzle", "wooden"],
        featuredImageUrl: "https://example.com/images/puzzle-feature.jpg",
        images: ["https://example.com/images/puzzle-1.jpg"],
        isActive: false,
        purchasePrice: "4.00",
        sellPrice: "12.99",
        stock: "500"
    },
    {
        name: "Portable Power Bank 10000mAh",
        slug: "portable-power-bank-10000mah",
        category: "Electronics",
        subcategory: "Accessories",
        tags: ["power", "battery", "portable"],
        featuredImageUrl: "https://example.com/images/powerbank-feature.jpg",
        images: ["https://example.com/images/powerbank-1.jpg"],
        isActive: true,
        purchasePrice: "10.00",
        sellPrice: "29.99",
        stock: "220"
    },
    {
        name: "Handmade Soy Scented Candle - Lavender",
        slug: "handmade-soy-scented-candle-lavender",
        category: "Home & Kitchen",
        subcategory: "Home Fragrance",
        tags: ["candle", "soy", "lavender"],
        featuredImageUrl: "https://example.com/images/candle-feature.jpg",
        images: ["https://example.com/images/candle-1.jpg"],
        isActive: true,
        purchasePrice: "2.50",
        sellPrice: "9.99",
        stock: "340"
    }
];

const parsedDummyProducts = dummyProducts.map((product) => {
    const parsedProduct = CreateProductSchema.parse(product);
    return {
        ...parsedProduct,
        slug: slugify(parsedProduct.slug ?? parsedProduct.name),
    };
});

const existingProducts = await db.query.productsTable.findMany();

if (existingProducts.length === 0) {
    const result = await db.insert(productsTable).values(parsedDummyProducts).returning();
    console.log(`Inserted ${result.length} products`, result);
} else {
    console.error(`Database is not empty`);
}
