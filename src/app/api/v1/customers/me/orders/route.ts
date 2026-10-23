import { requireAuthUser } from "@/features/auth/middlewares";
import checkoutActions from "@/features/checkout/actions";
import customerActions from "@/features/customers/actions";
import { CustomerOrderListQuerySchema } from "@/features/checkout/types";
import { handleError, ok } from "@/lib/http";

export const GET = async (request: Request) => {
    try {
        const user = await requireAuthUser(request.headers);
        const customer = await customerActions.getOrCreateCustomer(
            user.id,
            user.email,
            user.name,
            user.emailVerified
        );

        const url = new URL(request.url);
        const queryParams = {
            page: url.searchParams.get("page") ?? undefined,
            limit: url.searchParams.get("limit") ?? undefined,
            status: url.searchParams.get("status") ?? undefined,
        };

        const validatedQuery = CustomerOrderListQuerySchema.parse(queryParams);
        const orders = await checkoutActions.listCustomerOrders(customer.id, validatedQuery);

        return ok(orders);
    } catch (err) {
        return handleError(err);
    }
};
