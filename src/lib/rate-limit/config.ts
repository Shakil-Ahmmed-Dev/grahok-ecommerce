export interface RateLimitTier {
    name: string;
    limit: number;
    windowSeconds: number;
}

export const RATE_LIMIT_TIERS = {
    auth: {
        name: "auth",
        limit: 10,
        windowSeconds: 60,
    },
    checkout: {
        name: "checkout",
        limit: 20,
        windowSeconds: 60,
    },
    products: {
        name: "products",
        limit: 60,
        windowSeconds: 60,
    },
    admin: {
        name: "admin",
        limit: 120,
        windowSeconds: 60,
    },
    default: {
        name: "default",
        limit: 100,
        windowSeconds: 60,
    },
} as const satisfies Record<string, RateLimitTier>;

export const getRateLimitTier = (pathname: string): RateLimitTier => {
    if (pathname.startsWith("/api/v1/auth")) {
        return RATE_LIMIT_TIERS.auth;
    }
    if (pathname.startsWith("/api/v1/checkout")) {
        return RATE_LIMIT_TIERS.checkout;
    }
    if (pathname.startsWith("/api/v1/admin")) {
        return RATE_LIMIT_TIERS.admin;
    }
    if (pathname.startsWith("/api/v1/products")) {
        return RATE_LIMIT_TIERS.products;
    }
    return RATE_LIMIT_TIERS.default;
};
