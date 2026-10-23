import authActions from "@/features/auth/actions";
import checkoutActions from "@/features/checkout/actions";
import { handleError, ok } from "@/lib/http";

interface RouteParams {
    params: Promise<{
        orderId: string;
    }>;
}

export const GET = async (request: Request, { params }: RouteParams) => {
    try {
        const { orderId } = await params;
        const user = await authActions.getCurrentUser(request.headers);

        const url = new URL(request.url);
        const guestAccessToken =
            url.searchParams.get("token") ??
            request.headers.get("x-order-token") ??
            undefined;

        const order = await checkoutActions.getOrderById(orderId, {
            authUserId: user?.id,
            isAdmin: user?.role === "admin",
            guestAccessToken,
        });

        return ok(order);
    } catch (err) {
        return handleError(err);
    }
};
