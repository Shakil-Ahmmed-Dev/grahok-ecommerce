import { type TInventoryType, type TWeightUnit } from "./constants";

// Conversion factors relative to standard base units
// Mass base: grams (g)
const MASS_TO_GRAMS: Partial<Record<TWeightUnit, number>> = {
    mg: 0.001,
    g: 1,
    kg: 1000,
    oz: 28.3495,
    lb: 453.592,
};

// Volume base: milliliters (ml)
const VOLUME_TO_ML: Partial<Record<TWeightUnit, number>> = {
    ml: 1,
    l: 1000,
};

// Count base: pieces (pcs)
const COUNT_TO_PCS: Partial<Record<TWeightUnit, number>> = {
    pcs: 1,
};

/**
 * Converts a numeric value from one weight/volume/count unit to another within the same dimension.
 * Returns null if the units are from different physical dimensions without an explicit conversion factor.
 */
export function convertWeightUnit(
    value: number,
    fromUnit: TWeightUnit,
    toUnit: TWeightUnit
): number | null {
    if (fromUnit === toUnit) {
        return value;
    }

    if (fromUnit in MASS_TO_GRAMS && toUnit in MASS_TO_GRAMS) {
        const inGrams = value * MASS_TO_GRAMS[fromUnit]!;
        return inGrams / MASS_TO_GRAMS[toUnit]!;
    }

    if (fromUnit in VOLUME_TO_ML && toUnit in VOLUME_TO_ML) {
        const inMl = value * VOLUME_TO_ML[fromUnit]!;
        return inMl / VOLUME_TO_ML[toUnit]!;
    }

    if (fromUnit in COUNT_TO_PCS && toUnit in COUNT_TO_PCS) {
        const inPcs = value * COUNT_TO_PCS[fromUnit]!;
        return inPcs / COUNT_TO_PCS[toUnit]!;
    }

    return null;
}

export interface CalculateVariantStockParams {
    masterStock: number;
    inventoryType: TInventoryType;
    variantStock: number;
    weightValue: number;
    weightUnit: TWeightUnit;
    baseWeightUnit?: TWeightUnit | null;
    poolConsumptionRate?: number | null;
}

/**
 * Calculates effective available stock for a product variant.
 * - For 'discrete' inventory, returns the variant's own standalone stock count.
 * - For 'shared_pool' inventory, dynamically calculates how many packaged units can be served
 *   from the master product stock pool based on unit conversion or explicit poolConsumptionRate.
 */
export function calculateVariantStock({
    masterStock,
    inventoryType,
    variantStock,
    weightValue,
    weightUnit,
    baseWeightUnit,
    poolConsumptionRate,
}: CalculateVariantStockParams): number {
    if (inventoryType !== "shared_pool") {
        return variantStock;
    }

    if (masterStock <= 0) {
        return 0;
    }

    // 1. Explicit consumption rate override takes precedence
    if (poolConsumptionRate != null && poolConsumptionRate > 0) {
        return Math.floor(masterStock / poolConsumptionRate);
    }

    // 2. Unit conversion to master pool unit
    if (baseWeightUnit) {
        const rate = convertWeightUnit(weightValue, weightUnit, baseWeightUnit);
        if (rate != null && rate > 0) {
            return Math.floor(masterStock / rate);
        }
    }

    // 3. Fallback: weightValue if units match or conversion is direct
    if (weightValue > 0) {
        return Math.floor(masterStock / weightValue);
    }

    return 0;
}
