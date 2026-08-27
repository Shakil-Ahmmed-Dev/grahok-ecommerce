import { createHash } from "crypto";

export const slugify = (value: string): string => {
    const normalized = value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    return normalized
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
};

export const ensureSlug = (source: string): string => {
    const base = slugify(source);
    if (base) {
        return base;
    }
    const hash = createHash("sha256").update(source).digest("hex").slice(0, 8);
    return `product-${hash}`;
};