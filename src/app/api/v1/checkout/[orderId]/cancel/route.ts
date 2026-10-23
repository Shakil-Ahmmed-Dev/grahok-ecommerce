import authActions from "@/features/auth/actions";
import checkoutActions from "@/features/checkout/actions";
import { OrderCancelInputSchema } from "@/features/checkout/types";
import { UnauthorizedError } from "@/lib/error";
import { handleError, ok } from "@/lib/http";

interface RouteParams {
    params: Promise<{
        orderId: string;
    }>;
}

export const POST = async (request: Request, { params }: RouteParams) => {
    try {
        const user = await authActions.getCurrentUser(request.headers);
        const url = new URL(request.url);
        const guestAccessToken =
            url.searchParams.get("token") ??
            request.headers.get("x-order-token") ??
            undefined;

        if (!user && !guestAccessToken) {
            throw new UnauthorizedError("Authentication or order token is required to cancel this order");
        }

        const { orderId } = await params;

        let reason: string | undefined;
        try {
            const body = await request.json();
            const validated = OrderCancelInputSchema.parse(body);
            reason = validated.reason;
        } catch {
            // Reason body is optional
        }

        const forwarded = request.headers.get("x-forwarded-for");
        const clientIp = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") ?? undefined;

        const cancelledOrder = await checkoutActions.cancelOrder(orderId, {
            authUserId: user?.id,
            guestAccessToken,
            isAdmin: user?.role === "admin",
            reason,
            clientIp,
            headers: request.headers,
        });

        return ok(cancelledOrder);
    } catch (err) {
        return handleError(err);
    }
};
