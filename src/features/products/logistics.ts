export const DEFAULT_VOLUMETRIC_DIVISOR = 5000;

export interface LogisticsDimensions {
    packageLength?: number | null;
    packageWidth?: number | null;
    packageHeight?: number | null;
}

export interface LogisticsMetrics extends LogisticsDimensions {
    weight?: number | null;
}

export interface EffectiveLogisticsResult {
    weight: number | null;
    packageLength: number | null;
    packageWidth: number | null;
    packageHeight: number | null;
    volumetricWeight: number | null;
    chargeableWeight: number | null;
}

export interface ConsignmentItemLogistics {
    weight?: number | null;
    packageLength?: number | null;
    packageWidth?: number | null;
    packageHeight?: number | null;
    quantity: number;
}

export interface ConsignmentLogisticsResult {
    totalActualWeight: number;
    totalVolumeCm3: number;
    aggregateVolumetricWeight: number;
    chargeableWeight: number;
    pieceChargeableWeight: number;
    hasPhysicalGoods: boolean;
}

export const roundToDecimals = (value: number, decimals: number): number => {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
};

/**
 * Calculates volumetric (dimensional) weight from physical dimensions (in cm).
 * Standard formula: (Length * Width * Height) / Divisor.
 * Returns null if any dimension is missing or <= 0.
 */
export function calculateVolumetricWeight(
    dimensions?: LogisticsDimensions | null,
    divisor: number = DEFAULT_VOLUMETRIC_DIVISOR
): number | null {
    if (!dimensions || divisor <= 0) return null;
    const { packageLength, packageWidth, packageHeight } = dimensions;

    if (
        packageLength == null ||
        packageWidth == null ||
        packageHeight == null ||
        packageLength <= 0 ||
        packageWidth <= 0 ||
        packageHeight <= 0
    ) {
        return null;
    }

    const volume = packageLength * packageWidth * packageHeight;
    return roundToDecimals(volume / divisor, 3);
}

/**
 * Calculates the chargeable weight (the greater of actual scale weight and volumetric weight).
 * Returns null if neither weight is valid/positive.
 */
export function calculateChargeableWeight(
    actualWeight?: number | null,
    volumetricWeight?: number | null
): number | null {
    const validActual = actualWeight != null && actualWeight > 0 ? actualWeight : null;
    const validVolumetric = volumetricWeight != null && volumetricWeight > 0 ? volumetricWeight : null;

    if (validActual === null && validVolumetric === null) {
        return null;
    }

    if (validActual !== null && validVolumetric !== null) {
        return roundToDecimals(Math.max(validActual, validVolumetric), 3);
    }

    return roundToDecimals((validActual ?? validVolumetric)!, 3);
}

/**
 * Resolves effective logistics metrics for a variant with fallback to its parent product.
 * Dimensions follow an atomic fallback rule: if variant has complete dimensions (L, W, H > 0),
 * variant dimensions are used; otherwise if parent product has complete dimensions, product dimensions are used;
 * otherwise null.
 */
export function resolveEffectiveLogistics(
    variant?: Partial<LogisticsMetrics> | null,
    product?: Partial<LogisticsMetrics> | null
): EffectiveLogisticsResult {
    const rawWeight = variant?.weight != null ? variant.weight : product?.weight != null ? product.weight : null;
    const weight = rawWeight != null && Number(rawWeight) > 0 ? roundToDecimals(Number(rawWeight), 3) : null;

    const variantHasCompleteDims =
        variant?.packageLength != null && Number(variant.packageLength) > 0 &&
        variant?.packageWidth != null && Number(variant.packageWidth) > 0 &&
        variant?.packageHeight != null && Number(variant.packageHeight) > 0;

    const productHasCompleteDims =
        product?.packageLength != null && Number(product.packageLength) > 0 &&
        product?.packageWidth != null && Number(product.packageWidth) > 0 &&
        product?.packageHeight != null && Number(product.packageHeight) > 0;

    let packageLength: number | null = null;
    let packageWidth: number | null = null;
    let packageHeight: number | null = null;

    if (variantHasCompleteDims) {
        packageLength = roundToDecimals(Number(variant!.packageLength), 2);
        packageWidth = roundToDecimals(Number(variant!.packageWidth), 2);
        packageHeight = roundToDecimals(Number(variant!.packageHeight), 2);
    } else if (productHasCompleteDims) {
        packageLength = roundToDecimals(Number(product!.packageLength), 2);
        packageWidth = roundToDecimals(Number(product!.packageWidth), 2);
        packageHeight = roundToDecimals(Number(product!.packageHeight), 2);
    }

    const volumetricWeight = calculateVolumetricWeight({ packageLength, packageWidth, packageHeight });
    const chargeableWeight = calculateChargeableWeight(weight, volumetricWeight);

    return {
        weight,
        packageLength,
        packageWidth,
        packageHeight,
        volumetricWeight,
        chargeableWeight,
    };
}

/**
 * Calculates aggregate logistics for an entire consignment or cart.
 * Supports courier billing comparison: aggregate volumetric vs sum-of-pieces chargeable weight.
 */
export function calculateConsignmentLogistics(
    items: ConsignmentItemLogistics[],
    divisor: number = DEFAULT_VOLUMETRIC_DIVISOR
): ConsignmentLogisticsResult {
    let totalActualWeight = 0;
    let totalVolumeCm3 = 0;
    let pieceChargeableWeight = 0;

    for (const item of items) {
        const qty = item.quantity > 0 ? item.quantity : 0;
        if (qty === 0) continue;

        const itemWeight = item.weight != null && Number(item.weight) > 0 ? Number(item.weight) : 0;
        totalActualWeight += itemWeight * qty;

        const hasDims =
            item.packageLength != null && Number(item.packageLength) > 0 &&
            item.packageWidth != null && Number(item.packageWidth) > 0 &&
            item.packageHeight != null && Number(item.packageHeight) > 0;

        if (hasDims) {
            const singleVolume = Number(item.packageLength!) * Number(item.packageWidth!) * Number(item.packageHeight!);
            totalVolumeCm3 += singleVolume * qty;

            const singleVolumetricWeight = calculateVolumetricWeight(
                {
                    packageLength: Number(item.packageLength),
                    packageWidth: Number(item.packageWidth),
                    packageHeight: Number(item.packageHeight),
                },
                divisor
            );

            const singleChargeable = calculateChargeableWeight(
                itemWeight > 0 ? itemWeight : null,
                singleVolumetricWeight
            );

            if (singleChargeable != null) {
                pieceChargeableWeight += singleChargeable * qty;
            }
        } else if (itemWeight > 0) {
            pieceChargeableWeight += itemWeight * qty;
        }
    }

    const roundedActualWeight = roundToDecimals(totalActualWeight, 3);
    const roundedTotalVolumeCm3 = roundToDecimals(totalVolumeCm3, 2);
    const aggregateVolumetricWeight = divisor > 0 && roundedTotalVolumeCm3 > 0
        ? roundToDecimals(roundedTotalVolumeCm3 / divisor, 3)
        : 0;

    const chargeableWeight = roundToDecimals(
        Math.max(roundedActualWeight, aggregateVolumetricWeight),
        3
    );

    const roundedPieceChargeableWeight = roundToDecimals(pieceChargeableWeight, 3);
    const hasPhysicalGoods = roundedActualWeight > 0 || roundedTotalVolumeCm3 > 0;

    return {
        totalActualWeight: roundedActualWeight,
        totalVolumeCm3: roundedTotalVolumeCm3,
        aggregateVolumetricWeight,
        chargeableWeight,
        pieceChargeableWeight: roundedPieceChargeableWeight,
        hasPhysicalGoods,
    };
}
