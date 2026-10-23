import checkoutActions from "@/features/checkout/actions";
import { CheckoutEstimateInputSchema } from "@/features/checkout/types";
import { handleError, ok } from "@/lib/http";

export const POST = async (request: Request) => {
    try {
        const body = await request.json();
        const validated = CheckoutEstimateInputSchema.parse(body);
        const estimate = await checkoutActions.estimateCheckout(validated);
        return ok(estimate);
    } catch (err) {
        return handleError(err);
    }
};
