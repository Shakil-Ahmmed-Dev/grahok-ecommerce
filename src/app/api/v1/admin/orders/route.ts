import { requireAdmin } from "@/features/auth/middlewares";
import checkoutActions from "@/features/checkout/actions";
import { AdminOrderListQuerySchema } from "@/features/checkout/types";
import { handleError, ok } from "@/lib/http";

export const GET = async (request: Request) => {
    try {
        await requireAdmin(request.headers);
        const url = new URL(request.url);

        const rawParams: Record<string, string> = {};
        url.searchParams.forEach((val, key) => {
            rawParams[key] = val;
        });

        const query = AdminOrderListQuerySchema.parse(rawParams);
        const orders = await checkoutActions.listOrdersAdmin(query);
        return ok(orders);
    } catch (err) {
        return handleError(err);
    }
};
