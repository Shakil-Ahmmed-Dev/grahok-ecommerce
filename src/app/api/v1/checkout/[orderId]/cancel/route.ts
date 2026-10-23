import { requireAuthUser } from "@/features/auth/middlewares";
import checkoutActions from "@/features/checkout/actions";
import { OrderCancelInputSchema } from "@/features/checkout/types";
import { handleError, ok } from "@/lib/http";

interface RouteParams {
    params: Promise<{
        orderId: string;
    }>;
}

export const POST = async (request: Request, { params }: RouteParams) => {
    try {
        const user = await requireAuthUser(request.headers);
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
            authUserId: user.id,
            isAdmin: user.role === "admin",
            reason,
            clientIp,
            headers: request.headers,
        });

        return ok(cancelledOrder);
    } catch (err) {
        return handleError(err);
    }
};
