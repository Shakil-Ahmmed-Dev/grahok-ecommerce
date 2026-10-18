import { slugify } from "@/lib/slug";

export interface OptionValueInput {
    value: string;
    swatchMeta?: string | null;
    defaultConsumptionRate?: number | null;
}

export interface OptionInput {
    name: string;
    variantTypeId?: string | null;
    values: OptionValueInput[];
}

export interface GeneratedVariantPermutation {
    optionValues: Record<string, string>;
    title: string;
    signature: string;
    suggestedSku: string;
    poolConsumptionRate?: number | null;
}

/**
 * Produces a deterministic, normalized signature string for a set of variant options.
 * Keys are sorted case-insensitively and values are trimmed and lowercased.
 * Example: { "Size": "XL", "Color": "Navy Blue" } -> "color=navy blue&size=xl"
 * If optionValues is empty, returns "default".
 */
export function normalizeVariantSignature(optionValues?: Record<string, string> | null): string {
    if (!optionValues || typeof optionValues !== "object") {
        return "default";
    }

    const entries = Object.entries(optionValues)
        .map(([k, v]) => [k.trim().toLowerCase(), String(v ?? "").trim().toLowerCase()] as const)
        .filter(([k, v]) => k.length > 0 && v.length > 0);

    if (entries.length === 0) {
        return "default";
    }

    entries.sort((a, b) => a[0].localeCompare(b[0]));

    return entries.map(([k, v]) => `${k}=${v}`).join("&");
}

/**
 * Computes the Cartesian product of multiple option axes.
 * Example:
 *   Color: [Red, Blue]
 *   Size: [S, M]
 * Produces 4 permutations:
 *   [ { Color: "Red", Size: "S" }, { Color: "Red", Size: "M" }, ... ]
 */
export function generateCartesianPermutations(
    productSlug: string,
    options: OptionInput[],
    skuPrefix?: string
): GeneratedVariantPermutation[] {
    const prefix = skuPrefix?.trim() || productSlug;
    const validOptions = options.filter(
        (opt) => opt.name.trim().length > 0 && opt.values && opt.values.length > 0
    );

    if (validOptions.length === 0) {
        return [
            {
                optionValues: {},
                title: "Default",
                signature: "default",
                suggestedSku: `${prefix}-default`.toLowerCase(),
                poolConsumptionRate: null,
            },
        ];
    }

    interface PartialCombo {
        values: Record<string, string>;
        consumptionRate?: number | null;
    }

    let combinations: PartialCombo[] = [{ values: {}, consumptionRate: null }];

    for (const opt of validOptions) {
        const optionName = opt.name.trim();
        const nextCombinations: PartialCombo[] = [];

        for (const current of combinations) {
            for (const val of opt.values) {
                const valueStr = val.value.trim();
                if (!valueStr) continue;

                const consumptionRate = val.defaultConsumptionRate != null && Number(val.defaultConsumptionRate) > 0
                    ? Number(val.defaultConsumptionRate)
                    : current.consumptionRate ?? null;

                nextCombinations.push({
                    values: {
                        ...current.values,
                        [optionName]: valueStr,
                    },
                    consumptionRate,
                });
            }
        }

        combinations = nextCombinations;
    }

    return combinations.map((combo) => {
        const title = Object.values(combo.values).join(" / ");
        const signature = normalizeVariantSignature(combo.values);

        const skuParts = Object.values(combo.values)
            .map((val) => slugify(val).replace(/^-+|-+$/g, ""))
            .filter(Boolean);

        const baseSku = skuParts.length > 0
            ? `${prefix}-${skuParts.join("-")}`
            : `${prefix}-default`;

        return {
            optionValues: combo.values,
            title,
            signature,
            suggestedSku: baseSku.toLowerCase(),
            poolConsumptionRate: combo.consumptionRate ?? null,
        };
    });
}

/**
 * Ensures unique SKU generation with collision resolution fallback suffix.
 */
export function resolveUniqueSku(
    candidateSku: string,
    isSkuTaken: (sku: string) => boolean | Promise<boolean>
): Promise<string> {
    return (async () => {
        let sku = candidateSku.trim().toLowerCase();
        let counter = 1;

        while (await isSkuTaken(sku)) {
            sku = `${candidateSku.trim().toLowerCase()}-${counter}`;
            counter++;
        }

        return sku;
    })();
}
